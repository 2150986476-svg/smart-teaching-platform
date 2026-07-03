-- ============================================================
-- AI 智能教学平台 - MySQL 数据库建表脚本
-- 版本: V1.0
-- 数据库: MySQL 8.0+
-- 字符集: utf8mb4
-- ============================================================

-- 创建数据库（如需要）
-- CREATE DATABASE IF NOT EXISTS ai_teaching_platform
--   DEFAULT CHARACTER SET utf8mb4
--   DEFAULT COLLATE utf8mb4_unicode_ci;
-- USE ai_teaching_platform;

-- ============================================================
-- 1. 用户表 (sys_user)
--    存储教师、学生、助教、管理员等所有用户信息
-- ============================================================
DROP TABLE IF EXISTS sys_user;
CREATE TABLE sys_user (
    id              BIGINT          AUTO_INCREMENT  PRIMARY KEY         COMMENT '主键ID',
    username        VARCHAR(50)     NOT NULL                            COMMENT '登录名（教师工号/学生学号）',
    password        VARCHAR(255)    NOT NULL                            COMMENT 'bcrypt加密密码',
    real_name       VARCHAR(50)     NOT NULL                            COMMENT '真实姓名',
    role            ENUM('teacher','student','assistant','admin')
                                    NOT NULL                            COMMENT '角色：teacher教师/student学生/assistant助教/admin管理员',
    email           VARCHAR(100)    DEFAULT NULL                        COMMENT '邮箱（教师/管理员必填）',
    phone           VARCHAR(20)     DEFAULT NULL                        COMMENT '手机号',
    avatar          VARCHAR(255)    DEFAULT NULL                        COMMENT '头像URL',
    gender          TINYINT         DEFAULT 0                           COMMENT '性别：0未知 1男 2女',
    department      VARCHAR(100)    DEFAULT NULL                        COMMENT '所属院系/部门',
    class_name      VARCHAR(100)    DEFAULT NULL                        COMMENT '班级（学生专用）',
    status          TINYINT         DEFAULT 1                           COMMENT '状态：0禁用 1正常',
    first_login     TINYINT         DEFAULT 1                           COMMENT '是否首次登录：0否 1是',
    last_login_at   DATETIME        DEFAULT NULL                        COMMENT '最后登录时间',
    last_login_ip   VARCHAR(50)     DEFAULT NULL                        COMMENT '最后登录IP',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP  COMMENT '创建时间',
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    UNIQUE KEY uk_username (username),
    INDEX idx_role (role),
    INDEX idx_department (department),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表 - 存储所有用户账号信息';

-- ============================================================
-- 2. 课程表 (course)
--    存储教师创建的课程信息
-- ============================================================
DROP TABLE IF EXISTS course;
CREATE TABLE course (
    id              BIGINT          AUTO_INCREMENT  PRIMARY KEY         COMMENT '主键ID',
    teacher_id      BIGINT          NOT NULL                            COMMENT '所属教师ID（关联sys_user）',
    name            VARCHAR(100)    NOT NULL                            COMMENT '课程名称',
    description     TEXT                                                COMMENT '课程描述（支持富文本）',
    cover_image     VARCHAR(255)    DEFAULT NULL                        COMMENT '封面图片URL',
    semester        VARCHAR(50)     DEFAULT NULL                        COMMENT '开课学期，如"2026-2027-1"',
    status          TINYINT         DEFAULT 0                           COMMENT '状态：0待发布 1已发布 2已结束',
    class_info      VARCHAR(200)    DEFAULT NULL                        COMMENT '上课班级信息，如"计算机学院2024级1班"',
    is_deleted      TINYINT         DEFAULT 0                           COMMENT '软删除标记：0未删除 1已删除',
    deleted_at      DATETIME        DEFAULT NULL                        COMMENT '删除时间',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP  COMMENT '创建时间',
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_teacher_id (teacher_id),
    INDEX idx_status (status),
    INDEX idx_semester (semester),
    CONSTRAINT fk_course_teacher FOREIGN KEY (teacher_id) REFERENCES sys_user(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='课程表 - 存储课程基本信息';

-- ============================================================
-- 3. 选课表 (course_enrollment)
--    学生与课程的关联关系（多对多）
-- ============================================================
DROP TABLE IF EXISTS course_enrollment;
CREATE TABLE course_enrollment (
    id              BIGINT          AUTO_INCREMENT  PRIMARY KEY         COMMENT '主键ID',
    course_id       BIGINT          NOT NULL                            COMMENT '课程ID',
    student_id      BIGINT          NOT NULL                            COMMENT '学生ID（关联sys_user）',
    enrolled_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP  COMMENT '加入课程时间',
    is_active       TINYINT         DEFAULT 1                           COMMENT '是否在读：0退课 1在读',
    quit_at         DATETIME        DEFAULT NULL                        COMMENT '退课时间',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP  COMMENT '创建时间',
    UNIQUE KEY uk_course_student (course_id, student_id),
    INDEX idx_student_id (student_id),
    INDEX idx_is_active (is_active),
    CONSTRAINT fk_enrollment_course FOREIGN KEY (course_id) REFERENCES course(id) ON DELETE CASCADE,
    CONSTRAINT fk_enrollment_student FOREIGN KEY (student_id) REFERENCES sys_user(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='选课表 - 学生与课程的多对多关系';

-- ============================================================
-- 4. 课程资料表 (course_material)
--    存储教师上传的课程资料文件信息
-- ============================================================
DROP TABLE IF EXISTS course_material;
CREATE TABLE course_material (
    id              BIGINT          AUTO_INCREMENT  PRIMARY KEY         COMMENT '主键ID',
    course_id       BIGINT          NOT NULL                            COMMENT '所属课程ID',
    file_name       VARCHAR(255)    NOT NULL                            COMMENT '原始文件名',
    file_type       VARCHAR(20)     NOT NULL                            COMMENT '文件类型：pdf/docx/pptx/md/txt',
    file_size       BIGINT          DEFAULT 0                           COMMENT '文件大小（字节）',
    file_url        VARCHAR(500)    NOT NULL                            COMMENT '文件存储路径（MinIO）',
    file_md5        VARCHAR(64)     DEFAULT NULL                        COMMENT '文件MD5校验值（用于去重）',
    coze_doc_id     VARCHAR(100)    DEFAULT NULL                        COMMENT 'Coze知识库中的文档ID',
    parse_status    ENUM('pending','processing','completed','failed')
                                    DEFAULT 'pending'                   COMMENT 'Coze解析状态：pending待处理/processing解析中/completed已完成/failed失败',
    parse_message   VARCHAR(500)    DEFAULT NULL                        COMMENT '解析失败原因',
    page_count      INT             DEFAULT 0                           COMMENT '文档页数（PDF/PPT）',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP  COMMENT '上传时间',
    INDEX idx_course_id (course_id),
    INDEX idx_parse_status (parse_status),
    INDEX idx_file_type (file_type),
    CONSTRAINT fk_material_course FOREIGN KEY (course_id) REFERENCES course(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='课程资料表 - 存储上传的文件信息';

-- ============================================================
-- 5. Coze知识库绑定表 (coze_knowledge_base)
--    课程与Coze知识库的绑定关系（一对一）
-- ============================================================
DROP TABLE IF EXISTS coze_knowledge_base;
CREATE TABLE coze_knowledge_base (
    id                  BIGINT          AUTO_INCREMENT  PRIMARY KEY     COMMENT '主键ID',
    course_id           BIGINT          NOT NULL                        COMMENT '课程ID（一对一）',
    coze_dataset_id     VARCHAR(100)    NOT NULL                        COMMENT 'Coze知识库ID（Coze返回）',
    coze_dataset_name   VARCHAR(200)    DEFAULT NULL                    COMMENT 'Coze知识库名称',
    knowledge_id        VARCHAR(100)    DEFAULT NULL                    COMMENT 'Coze Knowledge资源ID',
    status              ENUM('creating','ready','failed','syncing')
                                        DEFAULT 'creating'              COMMENT '状态：creating创建中/ready已就绪/failed失败/syncing同步中',
    fail_reason         VARCHAR(500)    DEFAULT NULL                    COMMENT '创建失败原因',
    last_sync_time      DATETIME        DEFAULT NULL                    COMMENT '最后同步时间',
    sync_status         ENUM('idle','syncing','success','failed')
                                        DEFAULT 'idle'                  COMMENT '同步状态：idle空闲/syncing同步中/success成功/failed失败',
    chunk_size          INT             DEFAULT 800                     COMMENT '知识库分块大小',
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    synced_at           DATETIME        DEFAULT NULL                    COMMENT '最后同步时间（旧字段）',
    UNIQUE KEY uk_course_id (course_id),
    CONSTRAINT fk_kb_course FOREIGN KEY (course_id) REFERENCES course(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Coze知识库绑定表 - 课程与Coze知识库一对一关联';

-- ============================================================
-- 6. AI助教绑定表 (ai_assistant_bind)
--    课程与Coze Bot的绑定关系（一对一）
-- ============================================================
DROP TABLE IF EXISTS ai_assistant_bind;
CREATE TABLE ai_assistant_bind (
    id                  BIGINT          AUTO_INCREMENT  PRIMARY KEY     COMMENT '主键ID',
    course_id           BIGINT          NOT NULL                        COMMENT '课程ID（一对一）',
    coze_bot_id         VARCHAR(100)    NOT NULL                        COMMENT 'Coze Bot ID',
    workflow_id         VARCHAR(100)    DEFAULT NULL                    COMMENT 'Coze Workflow ID（出题工作流）',
    assistant_name      VARCHAR(50)     DEFAULT 'AI助教'                 COMMENT '助教名称',
    assistant_avatar    VARCHAR(255)    DEFAULT NULL                    COMMENT '助教头像URL',
    welcome_message     VARCHAR(500)    DEFAULT '您好，我是本课程的AI助教，有什么可以帮助您的？' COMMENT '欢迎语',
    system_prompt       TEXT                                            COMMENT '自定义系统提示词（覆盖默认）',
    temperature         DECIMAL(3,2)    DEFAULT 0.70                    COMMENT '回答温度参数（0-1）',
    max_tokens          INT             DEFAULT 2048                    COMMENT '最大回复Token数',
    is_active           TINYINT         DEFAULT 1                       COMMENT '是否启用：0禁用 1启用',
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    UNIQUE KEY uk_course_id (course_id),
    CONSTRAINT fk_assistant_course FOREIGN KEY (course_id) REFERENCES course(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI助教绑定表 - 课程与Coze Bot一对一关联（含Workflow出题配置）';

-- ============================================================
-- 7. 知识点表 (knowledge_point)
--    课程的树形知识点结构
-- ============================================================
DROP TABLE IF EXISTS knowledge_point;
CREATE TABLE knowledge_point (
    id              BIGINT          AUTO_INCREMENT  PRIMARY KEY         COMMENT '主键ID',
    course_id       BIGINT          NOT NULL                            COMMENT '所属课程ID',
    parent_id       BIGINT          DEFAULT NULL                        COMMENT '父知识点ID（NULL为根节点）',
    name            VARCHAR(100)    NOT NULL                            COMMENT '知识点名称',
    description     TEXT                                                COMMENT '知识点描述',
    weight          DECIMAL(5,2)    DEFAULT 1.00                        COMMENT '权重（用于计算总评分）',
    sort_order      INT             DEFAULT 0                           COMMENT '排序序号',
    level           INT             DEFAULT 1                           COMMENT '层级深度（从1开始）',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP  COMMENT '创建时间',
    INDEX idx_course_id (course_id),
    INDEX idx_parent_id (parent_id),
    CONSTRAINT fk_kp_course FOREIGN KEY (course_id) REFERENCES course(id) ON DELETE CASCADE,
    CONSTRAINT fk_kp_parent FOREIGN KEY (parent_id) REFERENCES knowledge_point(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='知识点表 - 课程的树形知识点结构';

-- ============================================================
-- 8. 对话会话表 (chat_session)
--    学生与AI助教的对话会话分组
-- ============================================================
DROP TABLE IF EXISTS chat_session;
CREATE TABLE chat_session (
    id              BIGINT          AUTO_INCREMENT  PRIMARY KEY         COMMENT '主键ID',
    session_id      VARCHAR(100)    NOT NULL                            COMMENT '会话唯一标识（UUID）',
    course_id       BIGINT          NOT NULL                            COMMENT '课程ID',
    student_id      BIGINT          NOT NULL                            COMMENT '学生ID',
    title           VARCHAR(200)    DEFAULT NULL                        COMMENT '会话标题（自动从首条消息生成）',
    message_count   INT             DEFAULT 0                           COMMENT '消息总数',
    is_deleted      TINYINT         DEFAULT 0                           COMMENT '是否删除：0否 1是',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP  COMMENT '创建时间',
    updated_at      DATETIME        DEFAULT NULL                        COMMENT '最后消息时间',
    INDEX idx_course_student (course_id, student_id),
    UNIQUE KEY uk_session_id (session_id),
    INDEX idx_updated_at (updated_at),
    CONSTRAINT fk_session_course FOREIGN KEY (course_id) REFERENCES course(id) ON DELETE CASCADE,
    CONSTRAINT fk_session_student FOREIGN KEY (student_id) REFERENCES sys_user(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='对话会话表 - 学生AI对话的会话分组';

-- ============================================================
-- 9. 对话记录表 (chat_record)
--    学生与AI助教的单条对话记录
-- ============================================================
DROP TABLE IF EXISTS chat_record;
CREATE TABLE chat_record (
    id              BIGINT          AUTO_INCREMENT  PRIMARY KEY         COMMENT '主键ID',
    session_id      VARCHAR(100)    NOT NULL                            COMMENT '所属会话ID',
    course_id       BIGINT          NOT NULL                            COMMENT '课程ID',
    student_id      BIGINT          NOT NULL                            COMMENT '学生ID',
    role            ENUM('user','assistant','system')
                                    NOT NULL                            COMMENT '发言角色：user学生/assistantAI助教/system系统',
    content         TEXT            NOT NULL                            COMMENT '对话内容',
    metadata        JSON            DEFAULT NULL                        COMMENT '元数据（引用来源、置信度等）',
    token_count     INT             DEFAULT 0                           COMMENT '消耗Token数',
    rating          TINYINT         DEFAULT NULL                        COMMENT '学生满意度评价（1-5）',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP  COMMENT '发送时间',
    INDEX idx_session (session_id),
    INDEX idx_course_student (course_id, student_id),
    INDEX idx_created_at (created_at),
    INDEX idx_rating (rating),
    CONSTRAINT fk_record_session FOREIGN KEY (session_id) REFERENCES chat_session(session_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='对话记录表 - AI问答的逐条对话记录';

-- ============================================================
-- 10. 答题批次表 (quiz_batch)
--     每次生成的10道选择题为一批次
-- ============================================================
DROP TABLE IF EXISTS quiz_batch;
CREATE TABLE quiz_batch (
    id                  BIGINT          AUTO_INCREMENT  PRIMARY KEY     COMMENT '主键ID',
    batch_id            VARCHAR(100)    NOT NULL                        COMMENT '批次唯一标识（UUID）',
    course_id           BIGINT          NOT NULL                        COMMENT '课程ID',
    student_id          BIGINT          NOT NULL                        COMMENT '学生ID',
    difficulty          ENUM('easy','medium','hard','mixed')
                                        DEFAULT 'mixed'                 COMMENT '难度：easy容易/medium中等/hard困难/mixed混合',
    question_count      INT             DEFAULT 10                      COMMENT '题目总数量',
    correct_count       INT             DEFAULT 0                       COMMENT '正确数量',
    total_time_spent    INT             DEFAULT 0                       COMMENT '总用时（秒）',
    score               DECIMAL(5,2)    DEFAULT 0.00                    COMMENT '得分（正确数/总数×100）',
    status              ENUM('generated','in_progress','completed')
                                        DEFAULT 'generated'             COMMENT '状态：generated已生成/in_progress答题中/completed已完成',
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    completed_at        DATETIME        DEFAULT NULL                    COMMENT '完成时间',
    UNIQUE KEY uk_batch_id (batch_id),
    INDEX idx_course_student (course_id, student_id),
    INDEX idx_status (status),
    CONSTRAINT fk_batch_course FOREIGN KEY (course_id) REFERENCES course(id) ON DELETE CASCADE,
    CONSTRAINT fk_batch_student FOREIGN KEY (student_id) REFERENCES sys_user(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='答题批次表 - 每次答题为一批次（通常10题）';

-- ============================================================
-- 11. 答题记录表 (quiz_record)
--     每道题的详细答题记录
-- ============================================================
DROP TABLE IF EXISTS quiz_record;
CREATE TABLE quiz_record (
    id                  BIGINT          AUTO_INCREMENT  PRIMARY KEY     COMMENT '主键ID',
    batch_id            VARCHAR(100)    NOT NULL                        COMMENT '所属答题批次ID',
    course_id           BIGINT          NOT NULL                        COMMENT '课程ID',
    student_id          BIGINT          NOT NULL                        COMMENT '学生ID',
    question_index      INT             DEFAULT 0                       COMMENT '题目序号（在批次中的位置）',
    question_content    JSON            NOT NULL                        COMMENT '题目内容JSON（含题干、选项A/B/C/D）',
    student_answer      VARCHAR(10)     DEFAULT NULL                    COMMENT '学生选择的答案选项（如"A"）',
    correct_answer      VARCHAR(10)     NOT NULL                        COMMENT '正确答案选项（如"C"）',
    is_correct          TINYINT         DEFAULT NULL                    COMMENT '是否正确：0错误 1正确',
    is_flagged          TINYINT         DEFAULT 0                       COMMENT '是否标记存疑',
    time_spent          INT             DEFAULT 0                       COMMENT '本题用时（秒）',
    difficulty          ENUM('easy','medium','hard')
                                        DEFAULT 'medium'                COMMENT '题目难度',
    knowledge_points    JSON            DEFAULT NULL                    COMMENT '关联知识点标签数组，如["神经网络","反向传播"]',
    explanation         TEXT                                            COMMENT '答案解析',
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '答题时间',
    INDEX idx_batch (batch_id),
    INDEX idx_course_student (course_id, student_id),
    INDEX idx_is_correct (is_correct),
    INDEX idx_difficulty (difficulty),
    CONSTRAINT fk_record_batch FOREIGN KEY (batch_id) REFERENCES quiz_batch(batch_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='答题记录表 - 每道选择题的作答明细';

-- ============================================================
-- 12. 错题本表 (wrong_question_book)
--     自动收集的学生错题，支持反复练习
-- ============================================================
DROP TABLE IF EXISTS wrong_question_book;
CREATE TABLE wrong_question_book (
    id                  BIGINT          AUTO_INCREMENT  PRIMARY KEY     COMMENT '主键ID',
    student_id          BIGINT          NOT NULL                        COMMENT '学生ID',
    course_id           BIGINT          NOT NULL                        COMMENT '课程ID',
    quiz_record_id      BIGINT          NOT NULL                        COMMENT '源答题记录ID',
    question_content    JSON            NOT NULL                        COMMENT '题目内容JSON',
    correct_answer      VARCHAR(10)     NOT NULL                        COMMENT '正确答案',
    student_answer      VARCHAR(10)     NOT NULL                        COMMENT '当时错误答案',
    difficulty          ENUM('easy','medium','hard')
                                        DEFAULT 'medium'                COMMENT '题目难度',
    knowledge_points    JSON            DEFAULT NULL                    COMMENT '关联知识点',
    wrong_count         INT             DEFAULT 1                       COMMENT '累计错误次数',
    last_wrong_at       DATETIME        DEFAULT NULL                    COMMENT '最近一次错误时间',
    mastered            TINYINT         DEFAULT 0                       COMMENT '是否已掌握：0未掌握 1已掌握',
    mastered_at         DATETIME        DEFAULT NULL                    COMMENT '掌握时间',
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '首次加入错题本时间',
    INDEX idx_student_course (student_id, course_id),
    INDEX idx_mastered (mastered),
    INDEX idx_wrong_count (wrong_count DESC),
    CONSTRAINT fk_wrong_student FOREIGN KEY (student_id) REFERENCES sys_user(id) ON DELETE CASCADE,
    CONSTRAINT fk_wrong_course FOREIGN KEY (course_id) REFERENCES course(id) ON DELETE CASCADE,
    CONSTRAINT fk_wrong_record FOREIGN KEY (quiz_record_id) REFERENCES quiz_record(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='错题本表 - 学生错题自动收集';

-- ============================================================
-- 13. 能力维度配置表 (ability_dimension)
--     雷达图的能力维度定义（可配置）
-- ============================================================
DROP TABLE IF EXISTS ability_dimension;
CREATE TABLE ability_dimension (
    id              BIGINT          AUTO_INCREMENT  PRIMARY KEY         COMMENT '主键ID',
    code            VARCHAR(50)     NOT NULL                            COMMENT '维度编码（如knowledge_breadth）',
    name            VARCHAR(100)    NOT NULL                            COMMENT '维度显示名称（如"知识广度"）',
    description     TEXT                                                COMMENT '维度描述',
    icon            VARCHAR(50)     DEFAULT NULL                        COMMENT '维度图标名称',
    sort_order      INT             DEFAULT 0                           COMMENT '排序序号',
    is_active       TINYINT         DEFAULT 1                           COMMENT '是否启用：0禁用 1启用',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP  COMMENT '创建时间',
    UNIQUE KEY uk_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='能力维度配置表 - 雷达图评估维度定义';

-- ============================================================
-- 14. 能力评估表 (ability_assessment)
--     学生各维度能力评分（时间序列）
-- ============================================================
DROP TABLE IF EXISTS ability_assessment;
CREATE TABLE ability_assessment (
    id              BIGINT          AUTO_INCREMENT  PRIMARY KEY         COMMENT '主键ID',
    student_id      BIGINT          NOT NULL                            COMMENT '学生ID',
    course_id       BIGINT          NOT NULL                            COMMENT '课程ID',
    dimension_code  VARCHAR(50)     NOT NULL                            COMMENT '能力维度编码',
    score           DECIMAL(5,2)    NOT NULL                            COMMENT '评分（0.00-100.00）',
    assess_date     DATE            NOT NULL                            COMMENT '评估日期',
    source          ENUM('auto','manual')
                                    DEFAULT 'auto'                      COMMENT '评分来源：auto自动/manual手动',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP  COMMENT '创建时间',
    INDEX idx_student_course (student_id, course_id),
    INDEX idx_student_date (student_id, assess_date),
    INDEX idx_assess_date (assess_date),
    UNIQUE KEY uk_student_dim_date (student_id, course_id, dimension_code, assess_date),
    CONSTRAINT fk_assess_student FOREIGN KEY (student_id) REFERENCES sys_user(id) ON DELETE CASCADE,
    CONSTRAINT fk_assess_course FOREIGN KEY (course_id) REFERENCES course(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='能力评估表 - 学生各能力维度评分历史';

-- ============================================================
-- 15. 排行榜表 (leaderboard)
--     课程内学生综合排名数据（每日快照）
-- ============================================================
DROP TABLE IF EXISTS leaderboard;
CREATE TABLE leaderboard (
    id                  BIGINT          AUTO_INCREMENT  PRIMARY KEY     COMMENT '主键ID',
    course_id           BIGINT          NOT NULL                        COMMENT '课程ID',
    student_id          BIGINT          NOT NULL                        COMMENT '学生ID',
    total_quiz_count    INT             DEFAULT 0                       COMMENT '答题总次数',
    total_questions     INT             DEFAULT 0                       COMMENT '答题总题数',
    correct_count       INT             DEFAULT 0                       COMMENT '正确总题数',
    correct_rate        DECIMAL(5,2)    DEFAULT 0.00                    COMMENT '正确率（%）',
    total_chat_count    INT             DEFAULT 0                       COMMENT '提问总次数',
    total_study_hours   DECIMAL(8,2)    DEFAULT 0.00                    COMMENT '学习总时长（小时，按对话活跃估算）',
    knowledge_coverage  DECIMAL(5,2)    DEFAULT 0.00                    COMMENT '知识点覆盖率（%）',
    average_score       DECIMAL(5,2)    DEFAULT 0.00                    COMMENT '平均得分',
    composite_score     DECIMAL(5,2)    DEFAULT 0.00                    COMMENT '综合评分（加权计算）',
    rank_score          DECIMAL(10,2)   DEFAULT 0.00                    COMMENT '排位分值（排序依据）',
    rank_position       INT             DEFAULT NULL                    COMMENT '当前排名（名次）',
    rank_change         INT             DEFAULT 0                       COMMENT '排名变化：正数上升/负数下降/0不变',
    stat_date           DATE            NOT NULL                        COMMENT '统计日期',
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at          DATETIME        DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_course_date (course_id, stat_date),
    INDEX idx_rank_score (rank_score DESC),
    UNIQUE KEY uk_course_student_date (course_id, student_id, stat_date),
    CONSTRAINT fk_rank_course FOREIGN KEY (course_id) REFERENCES course(id) ON DELETE CASCADE,
    CONSTRAINT fk_rank_student FOREIGN KEY (student_id) REFERENCES sys_user(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='排行榜表 - 课程内学生排名快照';

-- ============================================================
-- 16. 系统配置表 (system_config)
--     系统级配置参数
-- ============================================================
DROP TABLE IF EXISTS system_config;
CREATE TABLE system_config (
    id              BIGINT          AUTO_INCREMENT  PRIMARY KEY         COMMENT '主键ID',
    config_key      VARCHAR(100)    NOT NULL                            COMMENT '配置键',
    config_value    TEXT            NOT NULL                            COMMENT '配置值',
    description     VARCHAR(500)    DEFAULT NULL                        COMMENT '配置说明',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP  COMMENT '创建时间',
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    UNIQUE KEY uk_config_key (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统配置表 - 全局配置参数';

-- ============================================================
-- 初始化数据
-- ============================================================

-- 默认能力维度
INSERT INTO ability_dimension (code, name, description, sort_order) VALUES
('knowledge_breadth',  '知识广度',     '学生对课程各章节知识的覆盖程度', 1),
('depth',              '理解深度',     '学生对核心概念的深入理解能力',   2),
('application',        '应用能力',     '学生运用知识解决实际问题的能力', 3),
('analysis',           '问题分析',     '学生分析复杂问题并拆解的能力',   4),
('continuous_learning','持续学习',     '学生主动提问、持续学习的表现',   5);

-- 默认系统配置
INSERT INTO system_config (config_key, config_value, description) VALUES
('default_password',     '123456',   '学生账号初始默认密码'),
('password_min_length',  '6',        '密码最小长度要求'),
('quiz_question_count',  '10',       '每次生成选择题数量'),
('session_timeout',      '86400',    'JWT Token过期时间（秒）'),
('file_max_size',        '52428800', '单文件上传最大字节（50MB）'),
('coze_api_timeout',     '30000',    'Coze API调用超时时间（毫秒）'),
('leaderboard_auto_refresh', '1',    '排行榜是否自动刷新：0否 1是');

-- ============================================================
-- 17. 课程资料文件表 (course_file)
--     存储教师上传的课程教学资料
-- ============================================================
DROP TABLE IF EXISTS course_file;
CREATE TABLE course_file (
    id              BIGINT          AUTO_INCREMENT  PRIMARY KEY         COMMENT '主键ID',
    course_id       BIGINT          NOT NULL                            COMMENT '课程ID',
    file_name       VARCHAR(255)    NOT NULL                            COMMENT '原始文件名',
    file_path       VARCHAR(500)    NOT NULL                            COMMENT '服务器存储路径',
    file_size       BIGINT          NOT NULL DEFAULT 0                  COMMENT '文件大小（字节）',
    file_type       VARCHAR(20)     NOT NULL                            COMMENT '文件类型：pdf/docx/pptx/md/txt',
    upload_time     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP  COMMENT '上传时间',
    created_by      BIGINT          NOT NULL                            COMMENT '上传者ID（关联sys_user）',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP  COMMENT '创建时间',
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_course_id (course_id),
    INDEX idx_file_type (file_type),
    CONSTRAINT fk_cf_course FOREIGN KEY (course_id) REFERENCES course(id) ON DELETE CASCADE,
    CONSTRAINT fk_cf_user FOREIGN KEY (created_by) REFERENCES sys_user(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='课程资料文件表 - 教学资料上传记录';

-- ============================================================
-- 建表完成，共 17 张表
-- ============================================================
