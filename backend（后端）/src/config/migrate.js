/**
 * 数据库自动迁移脚本
 * 在服务启动时检查并创建表，安全可重复执行（IF NOT EXISTS / INSERT IGNORE）
 */
const fs = require('fs')
const path = require('path')
const pool = require('./db')

async function runMigration() {
  try {
    console.log('[Migration] 开始检查数据库表...')

    // 读取原始 DDL 文件
    const sqlPath = path.join(__dirname, '../../database/ai_teaching_platform_ddl.sql')
    
    // 如果当前目录找不到（Railway 目录结构不同），尝试其他路径
    const altPath = path.join(__dirname, '../../../database/ai_teaching_platform_ddl.sql')
    
    let sql
    if (fs.existsSync(sqlPath)) {
      sql = fs.readFileSync(sqlPath, 'utf8')
    } else if (fs.existsSync(altPath)) {
      sql = fs.readFileSync(altPath, 'utf8')
    } else {
      console.warn('[Migration] DDL 文件未找到，使用内联 SQL')
      sql = getInlineSQL()
    }

    // 转换为安全 SQL
    const safeSQL = convertToSafeSQL(sql)

    // 按分号分割，逐个执行
    const statements = safeSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    const connection = await pool.getConnection()
    try {
      for (const stmt of statements) {
        try {
          await connection.execute(stmt)
        } catch (stmtErr) {
          // 忽略索引/约束已存在的错误
          if (!stmtErr.message.includes('Duplicate') && !stmtErr.message.includes('already exists')) {
            console.warn('[Migration] 语句执行失败:', stmtErr.message.substring(0, 100))
          }
        }
      }
      console.log('[Migration] 数据库表检查完成 ✓')

      // 种子数据
      await seedUsers(connection)
    } finally {
      connection.release()
    }
  } catch (err) {
    console.error('[Migration] 迁移失败:', err.message)
    throw err
  }
}

function convertToSafeSQL(sql) {
  // 移除注释行
  let result = sql
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n')

  // 移除 DROP TABLE IF EXISTS 行（改为不删除旧数据）
  result = result.replace(/DROP\s+TABLE\s+IF\s+EXISTS\s+\w+\s*;/gi, '')

  // CREATE TABLE → CREATE TABLE IF NOT EXISTS
  result = result.replace(/CREATE\s+TABLE\s+(\w+)/gi, 'CREATE TABLE IF NOT EXISTS $1')

  // INSERT INTO → INSERT IGNORE INTO（防止重复种子数据）
  result = result.replace(/INSERT\s+INTO\s+/gi, 'INSERT IGNORE INTO ')

  // UNIQUE KEY → 保持不变（IF NOT EXISTS 已保证不重复创建表，不会报错）
  
  return result
}

function getInlineSQL() {
  // 最精简的表结构：只创建最核心的表
  return `
CREATE TABLE IF NOT EXISTS sys_user (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    real_name VARCHAR(50) NOT NULL,
    role ENUM('teacher','student','assistant','admin') NOT NULL,
    email VARCHAR(100) DEFAULT NULL,
    phone VARCHAR(20) DEFAULT NULL,
    avatar VARCHAR(255) DEFAULT NULL,
    gender TINYINT DEFAULT 0,
    department VARCHAR(100) DEFAULT NULL,
    class_name VARCHAR(100) DEFAULT NULL,
    status TINYINT DEFAULT 1,
    first_login TINYINT DEFAULT 1,
    last_login_at DATETIME DEFAULT NULL,
    last_login_ip VARCHAR(50) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS course (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    teacher_id BIGINT NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    cover_image VARCHAR(255) DEFAULT NULL,
    semester VARCHAR(50) DEFAULT NULL,
    status TINYINT DEFAULT 0,
    class_info VARCHAR(200) DEFAULT NULL,
    is_deleted TINYINT DEFAULT 0,
    deleted_at DATETIME DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES sys_user(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS course_enrollment (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    course_id BIGINT NOT NULL,
    student_id BIGINT NOT NULL,
    enrolled_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active TINYINT DEFAULT 1,
    quit_at DATETIME DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_course_student (course_id, student_id),
    FOREIGN KEY (course_id) REFERENCES course(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES sys_user(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS course_material (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    course_id BIGINT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(20) NOT NULL,
    file_size BIGINT DEFAULT 0,
    file_url VARCHAR(500) NOT NULL,
    file_md5 VARCHAR(64) DEFAULT NULL,
    coze_doc_id VARCHAR(100) DEFAULT NULL,
    parse_status ENUM('pending','processing','completed','failed') DEFAULT 'pending',
    parse_message VARCHAR(500) DEFAULT NULL,
    page_count INT DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES course(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS coze_knowledge_base (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    course_id BIGINT NOT NULL UNIQUE,
    coze_dataset_id VARCHAR(100) NOT NULL,
    coze_dataset_name VARCHAR(200) DEFAULT NULL,
    knowledge_id VARCHAR(100) DEFAULT NULL,
    status ENUM('creating','ready','failed','syncing') DEFAULT 'creating',
    fail_reason VARCHAR(500) DEFAULT NULL,
    last_sync_time DATETIME DEFAULT NULL,
    sync_status ENUM('idle','syncing','success','failed') DEFAULT 'idle',
    chunk_size INT DEFAULT 800,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    synced_at DATETIME DEFAULT NULL,
    FOREIGN KEY (course_id) REFERENCES course(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_assistant_bind (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    course_id BIGINT NOT NULL UNIQUE,
    coze_bot_id VARCHAR(100) NOT NULL,
    workflow_id VARCHAR(100) DEFAULT NULL,
    assistant_name VARCHAR(50) DEFAULT 'AI助教',
    assistant_avatar VARCHAR(255) DEFAULT NULL,
    welcome_message VARCHAR(500) DEFAULT '您好，我是本课程的AI助教，有什么可以帮助您的？',
    system_prompt TEXT,
    temperature DECIMAL(3,2) DEFAULT 0.70,
    max_tokens INT DEFAULT 2048,
    is_active TINYINT DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES course(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS knowledge_point (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    course_id BIGINT NOT NULL,
    parent_id BIGINT DEFAULT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    weight DECIMAL(5,2) DEFAULT 1.00,
    sort_order INT DEFAULT 0,
    level INT DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES course(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_session (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(100) NOT NULL UNIQUE,
    course_id BIGINT NOT NULL,
    student_id BIGINT NOT NULL,
    title VARCHAR(200) DEFAULT NULL,
    message_count INT DEFAULT 0,
    is_deleted TINYINT DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT NULL,
    FOREIGN KEY (course_id) REFERENCES course(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES sys_user(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_record (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(100) NOT NULL,
    course_id BIGINT NOT NULL,
    student_id BIGINT NOT NULL,
    role ENUM('user','assistant','system') NOT NULL,
    content TEXT NOT NULL,
    metadata JSON DEFAULT NULL,
    token_count INT DEFAULT 0,
    rating TINYINT DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES chat_session(session_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quiz_batch (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    batch_id VARCHAR(100) NOT NULL UNIQUE,
    course_id BIGINT NOT NULL,
    student_id BIGINT NOT NULL,
    difficulty ENUM('easy','medium','hard','mixed') DEFAULT 'mixed',
    question_count INT DEFAULT 10,
    correct_count INT DEFAULT 0,
    total_time_spent INT DEFAULT 0,
    score DECIMAL(5,2) DEFAULT 0.00,
    status ENUM('generated','in_progress','completed') DEFAULT 'generated',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME DEFAULT NULL,
    FOREIGN KEY (course_id) REFERENCES course(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES sys_user(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quiz_record (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    batch_id VARCHAR(100) NOT NULL,
    course_id BIGINT NOT NULL,
    student_id BIGINT NOT NULL,
    question_index INT DEFAULT 0,
    question_content JSON NOT NULL,
    student_answer VARCHAR(10) DEFAULT NULL,
    correct_answer VARCHAR(10) NOT NULL,
    is_correct TINYINT DEFAULT NULL,
    is_flagged TINYINT DEFAULT 0,
    time_spent INT DEFAULT 0,
    difficulty ENUM('easy','medium','hard') DEFAULT 'medium',
    knowledge_points JSON DEFAULT NULL,
    explanation TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES quiz_batch(batch_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wrong_question_book (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    student_id BIGINT NOT NULL,
    course_id BIGINT NOT NULL,
    quiz_record_id BIGINT NOT NULL,
    question_content JSON NOT NULL,
    correct_answer VARCHAR(10) NOT NULL,
    student_answer VARCHAR(10) NOT NULL,
    difficulty ENUM('easy','medium','hard') DEFAULT 'medium',
    knowledge_points JSON DEFAULT NULL,
    wrong_count INT DEFAULT 1,
    last_wrong_at DATETIME DEFAULT NULL,
    mastered TINYINT DEFAULT 0,
    mastered_at DATETIME DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES sys_user(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES course(id) ON DELETE CASCADE,
    FOREIGN KEY (quiz_record_id) REFERENCES quiz_record(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ability_dimension (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50) DEFAULT NULL,
    sort_order INT DEFAULT 0,
    is_active TINYINT DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ability_assessment (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    student_id BIGINT NOT NULL,
    course_id BIGINT NOT NULL,
    dimension_code VARCHAR(50) NOT NULL,
    score DECIMAL(5,2) NOT NULL,
    assess_date DATE NOT NULL,
    source ENUM('auto','manual') DEFAULT 'auto',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_student_dim_date (student_id, course_id, dimension_code, assess_date),
    FOREIGN KEY (student_id) REFERENCES sys_user(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES course(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS leaderboard (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    course_id BIGINT NOT NULL,
    student_id BIGINT NOT NULL,
    total_quiz_count INT DEFAULT 0,
    total_questions INT DEFAULT 0,
    correct_count INT DEFAULT 0,
    correct_rate DECIMAL(5,2) DEFAULT 0.00,
    total_chat_count INT DEFAULT 0,
    total_study_hours DECIMAL(8,2) DEFAULT 0.00,
    knowledge_coverage DECIMAL(5,2) DEFAULT 0.00,
    average_score DECIMAL(5,2) DEFAULT 0.00,
    composite_score DECIMAL(5,2) DEFAULT 0.00,
    rank_score DECIMAL(10,2) DEFAULT 0.00,
    rank_position INT DEFAULT NULL,
    rank_change INT DEFAULT 0,
    stat_date DATE NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_course_student_date (course_id, student_id, stat_date),
    FOREIGN KEY (course_id) REFERENCES course(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES sys_user(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS system_config (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_value TEXT NOT NULL,
    description VARCHAR(500) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS course_file (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    course_id BIGINT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL DEFAULT 0,
    file_type VARCHAR(20) NOT NULL,
    upload_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES course(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES sys_user(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS operation_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    operator_id BIGINT NOT NULL,
    operator_name VARCHAR(50) NOT NULL,
    operator_role VARCHAR(20) NOT NULL,
    action VARCHAR(50) NOT NULL,
    target_type VARCHAR(50) DEFAULT NULL,
    target_id BIGINT DEFAULT NULL,
    target_name VARCHAR(200) DEFAULT NULL,
    detail VARCHAR(1000) DEFAULT NULL,
    ip_address VARCHAR(50) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (operator_id) REFERENCES sys_user(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 默认能力维度
INSERT IGNORE INTO ability_dimension (code, name, description, sort_order) VALUES
('knowledge_breadth', '知识广度', '学生对课程各章节知识的覆盖程度', 1),
('depth', '理解深度', '学生对核心概念的深入理解能力', 2),
('application', '应用能力', '学生运用知识解决实际问题的能力', 3),
('analysis', '问题分析', '学生分析复杂问题并拆解的能力', 4),
('continuous_learning', '持续学习', '学生主动提问、持续学习的表现', 5);

-- 默认系统配置
INSERT IGNORE INTO system_config (config_key, config_value, description) VALUES
('default_password', '123456', '学生账号初始默认密码'),
('password_min_length', '6', '密码最小长度要求'),
('quiz_question_count', '10', '每次生成选择题数量'),
('session_timeout', '86400', 'JWT Token过期时间（秒）'),
('file_max_size', '52428800', '单文件上传最大字节（50MB）'),
('coze_api_timeout', '30000', 'Coze API调用超时时间（毫秒）'),
('leaderboard_auto_refresh', '1', '排行榜是否自动刷新：0否 1是');
`
}

async function seedUsers(connection) {
  try {
    const bcrypt = require('bcryptjs')
    const hash = await bcrypt.hash('123456', 10)

    const users = [
      ["admin", hash, "系统管理员", "admin", "admin@example.com", "技术部", null],
      ["T001",  hash, "张老师",   "teacher", "zhang@example.com", "计算机学院", null],
      ["S001",  hash, "李明",     "student", null, null, "计算机学院2024级1班"],
      ["S002",  hash, "王小红",   "student", null, null, "计算机学院2024级1班"],
    ]

    for (const u of users) {
      await connection.execute(
        `INSERT IGNORE INTO sys_user (username, password, real_name, role, email, department, class_name)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        u
      )
    }

    // 创建示例课程
    const [teacherRows] = await connection.execute(
      `SELECT id FROM sys_user WHERE username = 'T001' AND role = 'teacher'`
    )

    if (teacherRows.length > 0) {
      const teacherId = teacherRows[0].id
      await connection.execute(
        `INSERT IGNORE INTO course (id, teacher_id, name, description, semester, status, class_info)
         VALUES (1, ?, '人工智能导论', '介绍人工智能的基本概念、算法和应用', '2026-2027-1', 1, '计算机学院2024级1班')`,
        [teacherId]
      )
    }

    // 学生选课
    const [studentRows] = await connection.execute(
      `SELECT id FROM sys_user WHERE role = 'student'`
    )
    if (studentRows.length > 0) {
      for (const s of studentRows) {
        await connection.execute(
          `INSERT IGNORE INTO course_enrollment (course_id, student_id) VALUES (1, ?)`,
          [s.id]
        )
      }
    }

    // 绑定 AI 助教
    await connection.execute(
      `INSERT IGNORE INTO ai_assistant_bind (course_id, coze_bot_id, workflow_id, assistant_name, is_active)
       VALUES (1, '7658214917564596233', '765822217184069266', 'AI助教', 1)`
    )

    console.log('[Migration] 种子数据插入完成 ✓')
  } catch (e) {
    console.warn('[Migration] 种子数据跳过:', e.message.substring(0, 100))
  }
}

module.exports = runMigration
