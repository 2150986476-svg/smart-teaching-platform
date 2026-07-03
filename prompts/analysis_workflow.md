# Coze Workflow ③：学习分析

> 适用场景：平台后端触发，基于学生行为数据生成多维能力评估报告
> 触发方式：API 调用（非对话界面）

---

## 一、工作流概述

| 项目 | 说明 |
|------|------|
| **工作流名称** | 学习分析 - 学生能力评估 |
| **触发方式** | API 调用（由平台后端定时任务或按需触发） |
| **核心模型** | Coze 最新旗舰模型 |
| **输出方式** | 同步返回 JSON |

---

## 二、工作流节点图

```
┌─────────────┐
│  ① 开始节点  │ ← 接收学生行为数据JSON
└──────┬──────┘
       ↓
┌─────────────┐
│  ② 数据校验  │ ← Code: 校验数据完整性和合法性
└──────┬──────┘
       ↓
┌─────────────┐
│  ┌──────┐   │
│  │ ③ 条件  │  ← 分支：数据是否充足？
│  └──┬──┘   │
│     ↓      │
│    ④       │
└─────────────┘
  ↓
┌─────────────┐
│  ④ 数据预处理 │ ← Code: 计算衍生指标，格式化输入
└──────┬──────┘
       ↓
┌─────────────┐
│  ┌──────┐   │
│  │ ⑤ 条件  │  ← 分支：活跃天数是否达标？
│  └──┬──┘   │
│   ↓   ↓   │
│  ⑥   ⑦   │
└──────────┘
  ↓       ↓
 ⑧ LLM评估  ⑨ 简化评估
  ↓       ↓
┌─────────────┐
│ ⑩ JSON校验  │ ← Code: 校验LLM输出JSON格式
└──────┬──────┘
       ↓
┌─────────────┐
│  ┌──────┐   │
│  │ ⑪ 条件  │  ← 分支：校验通过？
│  └──┬──┘   │
│   ↓   ↓   │
│  ⑫   ⑬   │
└──────────┘
  ↓       ↓
 ⑫ 结束(成功)  ⑫ 结束(失败/默认值)
```

---

## 三、节点详细设计

### 节点①：开始节点（Start）

**输入参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `student_id` | String | 是 | 学生ID |
| `course_id` | String | 是 | 课程ID |
| `quiz_data` | Object | 是 | 答题统计数据 |
| `chat_data` | Object | 是 | 对话统计数据 |
| `assessment_date` | String | 否 | 评估日期，默认当天 |

**quiz_data 结构：**

```json
{
  "total_batches": 5,
  "total_questions": 50,
  "correct_count": 38,
  "difficulty_breakdown": {
    "easy": {"total": 20, "correct": 18},
    "medium": {"total": 20, "correct": 14},
    "hard": {"total": 10, "correct": 6}
  },
  "knowledge_point_mastery": [
    {"name": "机器学习", "total": 10, "correct": 8},
    {"name": "深度学习", "total": 15, "correct": 10},
    {"name": "自然语言处理", "total": 5, "correct": 2},
    {"name": "强化学习", "total": 8, "correct": 5},
    {"name": "计算机视觉", "total": 12, "correct": 9}
  ],
  "average_time_per_question": 45,
  "time_distribution": {
    "under_30s": 15,
    "30s_to_60s": 25,
    "over_60s": 10
  }
}
```

**chat_data 结构：**

```json
{
  "total_sessions": 10,
  "total_messages": 45,
  "total_days_active": 12,
  "average_messages_per_session": 4.5,
  "first_session_date": "2026-06-20",
  "last_session_date": "2026-07-03"
}
```

### 节点②：数据校验（Code 节点）

**节点类型：** Code（JavaScript）
**用途：** 校验输入数据的完整性和合法性

```javascript
// 输入：student_id, course_id, quiz_data, chat_data, assessment_date
// 输出：validation

function main({student_id, course_id, quiz_data, chat_data, assessment_date}) {
  const errors = [];

  // 必填字段校验
  if (!student_id) errors.push("student_id 不能为空");
  if (!course_id) errors.push("course_id 不能为空");

  // quiz_data校验
  if (quiz_data) {
    if (typeof quiz_data.total_questions !== 'number') {
      errors.push("quiz_data.total_questions 必须为数字");
    }
    if (typeof quiz_data.correct_count !== 'number') {
      errors.push("quiz_data.correct_count 必须为数字");
    }
  }

  // chat_data校验
  if (chat_data) {
    if (typeof chat_data.total_messages !== 'number') {
      errors.push("chat_data.total_messages 必须为数字");
    }
  }

  // 判断数据量
  const total_questions = quiz_data?.total_questions || 0;
  const total_messages = chat_data?.total_messages || 0;
  const has_sufficient_data = total_questions >= 5 || total_messages >= 10;
  const total_days_active = chat_data?.total_days_active || 0;
  const has_enough_activity = total_days_active >= 3;

  return {
    is_valid: errors.length === 0,
    errors: errors,
    has_sufficient_data: has_sufficient_data,
    has_enough_activity: has_enough_activity,
    data_quality_note: has_sufficient_data
      ? null
      : "数据不足（答题<5题且对话<10条），评分仅供参考"
  };
}
```

### 节点③：条件分支

**分支逻辑：**
- `validation.is_valid === false` → 直接返回参数错误
- `validation.is_valid === true` → 进入节点④

### 节点④：数据预处理（Code 节点）

**节点类型：** Code（JavaScript）
**用途：** 计算衍生指标，格式化输入数据供LLM使用

```javascript
// 输入：student_id, course_id, quiz_data, chat_data, assessment_date, validation
// 输出：processed_data

function main({student_id, course_id, quiz_data, chat_data, assessment_date, validation}) {
  const result = {};

  // --- 基本信息 ---
  result.student_id = student_id;
  result.course_id = course_id;
  result.assessment_date = assessment_date || new Date().toISOString().split('T')[0];

  // --- 计算答题衍生指标 ---
  if (quiz_data) {
    const q = quiz_data;
    result.total_questions = q.total_questions || 0;
    result.correct_count = q.correct_count || 0;
    result.correct_rate = result.total_questions > 0
      ? parseFloat(((result.correct_count / result.total_questions) * 100).toFixed(2))
      : 0;

    // 按难度计算正确率
    const db = q.difficulty_breakdown || {};
    const easy_rate = db.easy?.total > 0
      ? parseFloat(((db.easy.correct / db.easy.total) * 100).toFixed(2)) : null;
    const medium_rate = db.medium?.total > 0
      ? parseFloat(((db.medium.correct / db.medium.total) * 100).toFixed(2)) : null;
    const hard_rate = db.hard?.total > 0
      ? parseFloat(((db.hard.correct / db.hard.total) * 100).toFixed(2)) : null;

    result.difficulty_analysis = { easy_rate, medium_rate, hard_rate };

    // 知识点掌握度分析
    const kp = q.knowledge_point_mastery || [];
    result.knowledge_mastery = kp.map(k => ({
      name: k.name,
      total: k.total,
      correct: k.correct,
      rate: k.total > 0 ? parseFloat(((k.correct / k.total) * 100).toFixed(2)) : 0
    }));

    // 识别薄弱点（正确率<60%）
    result.weak_points = result.knowledge_mastery
      .filter(k => k.rate < 60)
      .map(k => k.name);

    // 识别优势点（正确率>=80%且总题数>=3）
    result.strength_points = result.knowledge_mastery
      .filter(k => k.rate >= 80 && k.total >= 3)
      .map(k => k.name);

    // 用时分析
    result.avg_time = q.average_time_per_question || 0;
    const td = q.time_distribution || {};
    result.time_analysis = {
      quick: td.under_30s || 0,
      normal: td["30s_to_60s"] || 0,
      slow: td.over_60s || 0
    };
  }

  // --- 计算对话衍生指标 ---
  if (chat_data) {
    const c = chat_data;
    result.total_sessions = c.total_sessions || 0;
    result.total_messages = c.total_messages || 0;
    result.total_days_active = c.total_days_active || 0;
    result.avg_messages_per_session = c.average_messages_per_session || 0;

    // 计算学习跨度（天）
    if (c.first_session_date && c.last_session_date) {
      const first = new Date(c.first_session_date);
      const last = new Date(c.last_session_date);
      const span_days = Math.ceil((last - first) / (1000 * 60 * 60 * 24)) + 1;
      result.study_span_days = span_days;

      // 学习频率（活跃天数/总跨度天数）
      result.study_frequency = span_days > 0
        ? parseFloat(((c.total_days_active / span_days) * 100).toFixed(2))
        : 0;
    } else {
      result.study_span_days = 0;
      result.study_frequency = 0;
    }
  }

  // --- 标记数据质量 ---
  result.data_quality_note = validation.data_quality_note;

  return result;
}
```

**条件分支（节点⑤）：**

- `processed_data.total_days_active >= 3 且 processed_data.total_questions >= 5` → 进入节点⑧（LLM完整评估）
- `processed_data.total_days_active < 3 或 processed_data.total_questions < 5` → 进入节点⑨（简化评估）

### 节点⑥→⑦：LLM评估（简化版 — Code 节点）

**节点类型：** Code（JavaScript）
**用途：** 当数据量较少时，走简化版规则评估

```javascript
// 输入：processed_data
// 输出：assessment_result

function main({processed_data}) {
  const p = processed_data;
  const dims = ["knowledge_breadth", "depth", "application", "analysis", "continuous_learning"];
  const scores = {};

  // 简化版：基于已有数据进行保守评估，向中位数50靠拢
  if (p.correct_rate > 0) {
    // 根据总正确率估算各维度（做保守处理）
    const base = p.correct_rate * 0.5 + 25; // 将正确率压缩到25-75范围

    // 如果有知识点覆盖数据
    if (p.knowledge_mastery && p.knowledge_mastery.length > 0) {
      const avg_rate = p.knowledge_mastery.reduce((s, k) => s + k.rate, 0) / p.knowledge_mastery.length;
      scores.knowledge_breadth = parseFloat((avg_rate * 0.4 + 30).toFixed(2));
    } else {
      scores.knowledge_breadth = parseFloat((base * 0.6).toFixed(2));
    }

    scores.depth = parseFloat((base * 0.8).toFixed(2));
    scores.application = parseFloat((base * 0.7).toFixed(2));
    scores.analysis = parseFloat((base * 0.7).toFixed(2));

    // 持续学习：如果有活跃数据
    if (p.study_frequency > 0) {
      scores.continuous_learning = parseFloat(Math.min(p.study_frequency, 100).toFixed(2));
    } else {
      scores.continuous_learning = 50;
    }
  } else {
    // 无答题数据，全部分数设为50（样本不足）
    dims.forEach(d => scores[d] = 50);
  }

  return buildAssessmentResult(p, scores, true);
}

// 公共函数：构建评估结果
function buildAssessmentResult(processed, scores, is_simplified) {
  const overall = parseFloat(
    (scores.knowledge_breadth * 0.20 +
     scores.depth * 0.25 +
     scores.application * 0.20 +
     scores.analysis * 0.20 +
     scores.continuous_learning * 0.15).toFixed(2)
  );

  return {
    student_id: processed.student_id,
    course_id: processed.course_id,
    assess_date: processed.assessment_date,
    is_simplified: is_simplified,
    dimensions: [
      {code: "knowledge_breadth",  score: scores.knowledge_breadth,  rationale: "数据不足，该评分为保守估计", suggestions: "建议多做练习以获取更准确的评估"},
      {code: "depth",              score: scores.depth,              rationale: "数据不足，该评分为保守估计", suggestions: "建议多做中等以上难度题目"},
      {code: "application",        score: scores.application,        rationale: "数据不足，该评分为保守估计", suggestions: "建议多练习应用题"},
      {code: "analysis",           score: scores.analysis,           rationale: "数据不足，该评分为保守估计", suggestions: "建议尝试更多困难题目"},
      {code: "continuous_learning",score: scores.continuous_learning,rationale: "基于活跃天数的初步评估",     suggestions: "建议保持规律学习"}
    ],
    overall_score: overall,
    overall_level: getLevel(overall),
    strengths: processed.strength_points || [],
    weaknesses: processed.weak_points || [],
    summary: `由于学习数据较少（答题${processed.total_questions}题，活跃${processed.total_days_active}天），当前评分为保守估计。建议继续学习以获得更精确的能力分析。`,
    data_sufficient: false
  };
}

function getLevel(score) {
  if (score >= 90) return "优秀";
  if (score >= 75) return "良好";
  if (score >= 60) return "中等";
  if (score >= 40) return "待提高";
  return "需关注";
}
```

### 节点⑧：LLM完整评估（LLM 节点）

**节点类型：** LLM（大语言模型）
**用途：** 基于充足的数据进行全面的多维度能力评估

**配置参数：**

| 参数 | 设置 |
|------|------|
| 模型 | Coze 最新旗舰模型 |
| 温度 | 0.3（低温度确保评估稳定性和一致性） |
| 最大Token | 4096 |
| 回复格式 | 文本（JSON格式） |

**System Prompt：**
```
你是一位资深的教育数据分析师，专长于学习分析和能力评估。
你的任务是基于学生的学习行为数据，从多个维度客观评估学生的学习能力。
评分必须基于输入数据，不能主观臆断。
不要对学生进行人格评价。
不要与其他学生进行直接比较。
不要预测学生的未来成绩或能力上限。
```

**User Prompt：**
```
请根据以下学生学习数据进行5个维度的能力评估。

## 学生基本信息
- 学生ID：{{processed_data.student_id}}
- 课程ID：{{processed_data.course_id}}
- 评估日期：{{processed_data.assessment_date}}

## 答题数据
- 答题总数：{{processed_data.total_questions}}
- 正确率：{{processed_data.correct_rate}}%
- 容易题正确率：{{processed_data.difficulty_analysis.easy_rate}}%
- 中等题正确率：{{processed_data.difficulty_analysis.medium_rate}}%
- 困难题正确率：{{processed_data.difficulty_analysis.hard_rate}}%
- 平均每题用时：{{processed_data.avg_time}}秒

## 知识点掌握情况
{% for kp in processed_data.knowledge_mastery %}
- {{kp.name}}：{{kp.correct}}/{{kp.total}}（{{kp.rate}}%）{% if kp.rate < 60 %} ⚠️薄弱点{% endif %}
{% endfor %}

## 对话数据
- 总对话数：{{processed_data.total_sessions}}
- 总消息数：{{processed_data.total_messages}}
- 活跃天数：{{processed_data.total_days_active}}
- 学习跨度：{{processed_data.study_span_days}}天
- 学习频率：{{processed_data.study_frequency}}%

## 评估维度及权重
1. 知识广度（权重20%）：考察知识点覆盖范围
2. 理解深度（权重25%）：考察中等/困难题正确率
3. 应用能力（权重20%）：考察应用类知识点掌握度
4. 问题分析（权重20%）：考察困难题应对策略
5. 持续学习（权重15%）：考察学习频率和规律性

## 评分规则
- 各维度评分范围：0-100分
- 综合评分 = knowledge_breadth×0.20 + depth×0.25 + application×0.20 + analysis×0.20 + continuous_learning×0.15
- 等级：90-100优秀 / 75-89良好 / 60-74中等 / 40-59待提高 / 0-39需关注

## 输出要求
严格按照以下JSON格式输出，不要包含任何额外文字：

{
  "student_id": "{{processed_data.student_id}}",
  "course_id": "{{processed_data.course_id}}",
  "assess_date": "{{processed_data.assessment_date}}",
  "dimensions": [
    {
      "code": "knowledge_breadth",
      "score": 数值,
      "rationale": "基于数据的评分理由",
      "suggestions": "可操作的学习建议"
    }
  ],
  "overall_score": 综合评分,
  "overall_level": "等级名称",
  "strengths": ["优势点列表"],
  "weaknesses": ["薄弱点列表"],
  "summary": "综合评估总结（50-100字）"
}
```

### 节点⑩：JSON校验（Code 节点）

**节点类型：** Code（JavaScript）
**用途：** 校验LLM评分输出的JSON格式

```javascript
// 输入：llm_result（LLM节点的输出文本）
// 输出：validation

function main({llm_result}) {
  let parsed;
  try {
    let str = llm_result.trim();
    if (str.startsWith("```json")) str = str.substring(7);
    if (str.startsWith("```")) str = str.substring(3);
    if (str.endsWith("```")) str = str.substring(0, str.length - 3);
    parsed = JSON.parse(str.trim());
  } catch (e) {
    return {is_valid: false, parsed: null, error: "JSON解析失败"};
  }

  const errors = [];
  const expected_codes = ["knowledge_breadth", "depth", "application", "analysis", "continuous_learning"];

  if (!parsed.dimensions || parsed.dimensions.length !== 5) {
    errors.push("dimensions必须包含5个维度");
  } else {
    const codes = parsed.dimensions.map(d => d.code);
    expected_codes.forEach(code => {
      if (!codes.includes(code)) errors.push(`缺少维度: ${code}`);
    });
    parsed.dimensions.forEach((d, i) => {
      if (typeof d.score !== 'number' || d.score < 0 || d.score > 100) {
        errors.push(`dimensions[${i}].score 必须在0-100之间`);
      }
      if (!d.rationale) errors.push(`dimensions[${i}].rationale 不能为空`);
      if (!d.suggestions) errors.push(`dimensions[${i}].suggestions 不能为空`);
    });
  }

  if (typeof parsed.overall_score !== 'number') errors.push("overall_score必须为数字");
  if (!parsed.overall_level) errors.push("overall_level不能为空");

  return {
    is_valid: errors.length === 0,
    errors: errors,
    parsed: parsed
  };
}
```

### 节点⑪：条件分支

**分支逻辑：**
- `validation.is_valid === true` → 进入节点⑫（成功结束）
- `validation.is_valid === false` → 进入节点⑬（降级处理）

### 节点⑫：降级处理（Code 节点）

**节点类型：** Code（JavaScript）
**用途：** 当LLM评估结果格式不正确时，使用规则引擎生成默认评估

```javascript
// 输入：processed_data, validation
// 输出：fallback_result

function main({processed_data, validation}) {
  // 使用规则引擎计算各维度分数
  const p = processed_data;

  // 知识广度：基于知识点覆盖率和题目分布
  const kp_count = p.knowledge_mastery ? p.knowledge_mastery.length : 0;
  const breadth = kp_count > 0
    ? Math.min(p.knowledge_mastery.filter(k => k.rate >= 50).length / kp_count * 100, 90)
    : 50;

  // 理解深度：基于中等+困难题正确率
  const depth = p.difficulty_analysis.medium_rate && p.difficulty_analysis.hard_rate
    ? (p.difficulty_analysis.medium_rate * 0.6 + p.difficulty_analysis.hard_rate * 0.4)
    : p.correct_rate;

  // 应用能力：基于整体正确率估算
  const application = p.correct_rate * 0.8;

  // 问题分析：基于困难题正确率和用时
  const analysis = p.difficulty_analysis.hard_rate
    ? (p.difficulty_analysis.hard_rate * 0.7 + (p.avg_time > 30 ? 15 : 5))
    : p.correct_rate * 0.7;

  // 持续学习
  const continuous = Math.min(p.study_frequency || 50, 100);

  const scores = {
    knowledge_breadth: parseFloat(breadth.toFixed(2)),
    depth: parseFloat(depth.toFixed(2)),
    application: parseFloat(application.toFixed(2)),
    analysis: parseFloat(analysis.toFixed(2)),
    continuous_learning: parseFloat(continuous.toFixed(2))
  };

  return buildAssessmentResult(p, scores, false);
}
```

### 节点⑬：成功结束（End）

**输出参数：**

| 参数名 | 类型 | 说明 |
|--------|------|------|
| `code` | Number | 200 |
| `message` | String | "success" |
| `data.student_id` | String | 学生ID |
| `data.course_id` | String | 课程ID |
| `data.assess_date` | String | 评估日期 |
| `data.dimensions` | Array | 5个维度的评分详情 |
| `data.overall_score` | Number | 综合评分 |
| `data.overall_level` | String | 能力等级 |
| `data.strengths` | Array | 优势列表 |
| `data.weaknesses` | Array | 薄弱点列表 |
| `data.summary` | String | 综合评语 |
| `data.data_sufficient` | Boolean | 数据是否充足 |

### 节点⑭：错误结束（End）

**输出参数：**

| 参数名 | 类型 | 说明 |
|--------|------|------|
| `code` | Number | 400/500 |
| `message` | String | 错误描述 |
| `error.code` | String | 错误码 |
| `error.message` | String | 详细错误信息 |

---

## 四、完整输入/输出JSON示例

### 请求输入

```json
{
  "student_id": "S2024001",
  "course_id": "C1001",
  "quiz_data": {
    "total_batches": 8,
    "total_questions": 80,
    "correct_count": 62,
    "difficulty_breakdown": {
      "easy": {"total": 30, "correct": 28},
      "medium": {"total": 35, "correct": 25},
      "hard": {"total": 15, "correct": 9}
    },
    "knowledge_point_mastery": [
      {"name": "机器学习", "total": 20, "correct": 17},
      {"name": "深度学习", "total": 25, "correct": 18},
      {"name": "自然语言处理", "total": 15, "correct": 8},
      {"name": "强化学习", "total": 10, "correct": 7},
      {"name": "计算机视觉", "total": 10, "correct": 9}
    ],
    "average_time_per_question": 42,
    "time_distribution": {
      "under_30s": 25,
      "30s_to_60s": 40,
      "over_60s": 15
    }
  },
  "chat_data": {
    "total_sessions": 15,
    "total_messages": 68,
    "total_days_active": 18,
    "average_messages_per_session": 4.5,
    "first_session_date": "2026-06-15",
    "last_session_date": "2026-07-03"
  },
  "assessment_date": "2026-07-03"
}
```

### 成功响应输出

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "student_id": "S2024001",
    "course_id": "C1001",
    "assess_date": "2026-07-03",
    "is_simplified": false,
    "data_sufficient": true,
    "dimensions": [
      {
        "code": "knowledge_breadth",
        "score": 82.00,
        "rationale": "该学生覆盖了课程5个核心知识点区域，其中4个掌握良好（≥80%），仅自然语言处理偏弱（53%），知识广度良好。",
        "suggestions": "建议加强自然语言处理相关章节的学习，该知识点掌握率仅53%，低于其他维度。"
      },
      {
        "code": "depth",
        "score": 73.50,
        "rationale": "中等题正确率71.4%，困难题正确率60%，中高难度综合表现中等偏上。对话中有多轮追问记录，表明有深入理解的意愿。",
        "suggestions": "建议在核心概念上多做深入思考，尝试向自己提出为什么和是什么的问题。"
      },
      {
        "code": "application",
        "score": 78.00,
        "rationale": "应用类知识点（计算机视觉90%、机器学习85%）掌握较好，但对话中较少涉及实际应用场景的提问。",
        "suggestions": "建议多关注知识点在实际工程中的应用场景，尝试完成课后实践项目。"
      },
      {
        "code": "analysis",
        "score": 70.00,
        "rationale": "困难题正确率60%，在难题上平均用时约80秒，相较于简单题（25秒）投入了更多思考时间，解题策略合理。",
        "suggestions": "面对复杂题目时，建议先画思维导图列出关键信息，再逐步推导。"
      },
      {
        "code": "continuous_learning",
        "score": 85.00,
        "rationale": "过去19天中有18天有学习记录（频率94.7%），学习间隔均匀，无考前突击痕迹，展现出优秀的持续学习习惯。",
        "suggestions": "保持当前的学习节奏，可适当增加复习性学习以巩固长期记忆。"
      }
    ],
    "overall_score": 77.38,
    "overall_level": "良好",
    "strengths": ["持续学习", "知识广度", "计算机视觉"],
    "weaknesses": ["自然语言处理"],
    "summary": "该学生总体表现良好，学习习惯优秀（18/19天活跃），知识覆盖广泛。在自然语言处理方面存在明显薄弱点（掌握率53%），建议针对性加强。学习中高难度题目的应对策略合理，建议继续保持深入思考的习惯。"
  }
}
```

### 数据不足时的响应

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "student_id": "S2024001",
    "course_id": "C1001",
    "assess_date": "2026-07-03",
    "is_simplified": true,
    "data_sufficient": false,
    "dimensions": [
      {
        "code": "knowledge_breadth",
        "score": 55.00,
        "rationale": "数据不足，该评分为保守估计。学生仅有3道答题记录，知识点覆盖范围不明确。",
        "suggestions": "建议多做练习以获取更准确的评估，至少完成5次答题。"
      }
    ],
    "overall_score": 52.50,
    "overall_level": "待提高",
    "strengths": [],
    "weaknesses": [],
    "summary": "由于学习数据较少（答题3题，活跃2天），当前评分为保守估计。建议继续学习并完成更多练习以获得精确的能力分析。"
  }
}
```

### 参数错误响应

```json
{
  "code": 400,
  "message": "参数校验失败",
  "error": {
    "code": "PARAM_INVALID",
    "message": "student_id 不能为空"
  }
}
```

---

## 五、错误处理

| 错误场景 | 检测节点 | 处理方式 | 错误码 |
|----------|----------|----------|--------|
| 参数缺失 | 节点② | 直接返回 | PARAM_INVALID |
| 参数类型错误 | 节点② | 直接返回 | PARAM_TYPE_ERROR |
| 无答题记录且无对话记录 | 节点③ | 返回数据不足提示 | INSUFFICIENT_DATA |
| LLM评估JSON格式错误 | 节点⑩ | 降级为规则引擎评估（非报错） | — |
| LLM评估超时 | 节点⑧ | 超时设为30秒，超时则进入降级 | — |
| LLM评估内容不完整（缺维度） | 节点⑩ | 降级为规则引擎 | — |
| 规则引擎计算异常 | 节点⑫ | 返回默认保底值 | ENGINE_FALLBACK |

---

## 六、性能指标

| 指标 | 目标值 |
|------|--------|
| 端到端响应时间（完整评估） | ≤ 10 秒 |
| 端到端响应时间（简化评估） | ≤ 2 秒 |
| LLM评估成功率 | ≥ 90% |
| 含降级后的总成功率 | ≥ 99% |
| 各维度评分0-100范围合规率 | 100% |

---

## 七、调用方式与频次建议

| 触发方式 | 频次 | 说明 |
|----------|------|------|
| 学生答题完成后 | 每次 | 实时更新能力评分 |
| 每日凌晨定时任务 | 每天1次 | 生成所有活跃学生的日快照 |
| 教师手动触发 | 按需 | 查看特定学生的当前评估 |
| 学生首次登录后 | 1次 | 初始化基准评估 |
