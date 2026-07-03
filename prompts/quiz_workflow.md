# Coze Workflow ②：自动出题

> 适用场景：平台后端触发，基于课程知识库自动生成选择题
> 触发方式：API 调用（非对话界面）

---

## 一、工作流概述

| 项目 | 说明 |
|------|------|
| **工作流名称** | 自动出题 - 选择题生成 |
| **触发方式** | API 调用（由平台后端定时/按需触发） |
| **核心模型** | Coze 最新旗舰模型 |
| **输出方式** | 同步返回 JSON |

---

## 二、工作流节点图

```
┌─────────────┐
│  ① 开始节点  │ ← 接收API请求参数
└──────┬──────┘
       ↓
┌─────────────┐
│  ② 参数校验  │ ← Code: 校验difficulty、count合法性
└──────┬──────┘
       ↓
┌─────────────┐
│  ③ 知识库扫描 │ ← Knowledge: 扫描知识库获取内容摘要
└──────┬──────┘
       ↓
┌─────────────┐
│  ④ 内容分析  │ ← Code: 提取知识点列表，判断内容是否充足
└──────┬──────┘
       ↓
┌─────────────┐
│  ┌──────┐   │
│  │ ⑤ 条件  │  ← 分支：内容是否充足？
│  └┬──┬──┘   │
│   ↓   ↓     │
│  ⑥   ⑦     │
└─────────────┘
  ↓           ↓
 ⑦ LLM出题   ⑧ 错误返回
  ↓           ↓
┌─────────────┐
│  ⑨ JSON校验  │ ← Code: 校验LLM输出的JSON格式
└──────┬──────┘
       ↓
┌─────────────┐
│  ┌──────┐   │
│  │ ⑩ 条件  │  ← 分支：JSON校验是否通过？
│  └┬──┬──┘   │
│   ↓   ↓     │
│  ⑪   ⑫     │
└─────────────┘
  ↓           ↓
 ⑪ 结束(成功)  ⑫ 重试LLM
              ↓
          ┌──────┐
          │ ⑬ 条件 │ ← 重试>2次则放弃
          └──┬───┘
          ↓       ↓
        ⑪结束   ⑭错误结束
```

---

## 三、节点详细设计

### 节点①：开始节点（Start）

**输入参数：**

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `course_id` | String | 是 | — | 课程ID，用于定位知识库 |
| `difficulty` | String | 否 | "mixed" | 难度：easy / medium / hard / mixed |
| `count` | Number | 否 | 10 | 题目数量，最大20 |
| `knowledge_points` | Array | 否 | [] | 指定知识点范围（空则全部） |

### 节点②：参数校验（Code 节点）

**节点类型：** Code（JavaScript）
**用途：** 校验输入参数合法性

```javascript
// 输入：course_id, difficulty, count, knowledge_points
// 输出：validated_params

function main({course_id, difficulty, count, knowledge_points}) {
  const errors = [];

  // 校验course_id
  if (!course_id) {
    errors.push({field: "course_id", message: "课程ID不能为空"});
  }

  // 校验difficulty
  const valid_difficulties = ["easy", "medium", "hard", "mixed"];
  if (difficulty && !valid_difficulties.includes(difficulty)) {
    errors.push({field: "difficulty", message: "无效的难度值，可选: easy/medium/hard/mixed"});
  }

  // 校验count
  const parsed_count = parseInt(count) || 10;
  if (parsed_count < 1 || parsed_count > 20) {
    errors.push({field: "count", message: "题目数量必须在1-20之间"});
  }

  if (errors.length > 0) {
    return {
      is_valid: false,
      errors: errors,
      params: null
    };
  }

  return {
    is_valid: true,
    errors: [],
    params: {
      course_id: course_id,
      difficulty: difficulty || "mixed",
      count: Math.min(Math.max(parsed_count, 1), 20),
      knowledge_points: knowledge_points || []
    }
  };
}
```

**条件分支：**
- `validated_params.is_valid === false` → 直接跳转到**结束节点**，返回参数错误

### 节点③：知识库扫描（Knowledge 节点）

**节点类型：** 知识库检索（Knowledge）
**用途：** 扫描课程知识库，获取内容摘要和知识点分布

**配置参数：**

| 参数 | 设置 |
|------|------|
| 关联知识库 | {{course_id}} 对应的Coze知识库 |
| 检索方式 | 全库扫描（按章节分段） |
| 检索条数 | 20 条（覆盖各章节） |
| 返回内容 | 文本片段 + 来源信息 |

**特殊策略：**
- 使用空字符串或通用提示词（如"请列出本课程的所有章节和核心概念"）来触发全库扫描
- 或者预先配置知识库的目录/摘要信息

**输出JSON：**
```json
{
  "content_chunks": [
    {
      "content": "1.1 人工智能的定义...",
      "source": "第一章-引言.pdf",
      "chapter": "第一章"
    },
    {
      "content": "2.1 机器学习的分类...",
      "source": "第二章-机器学习基础.pdf",
      "chapter": "第二章"
    }
  ],
  "total_chunks": 20,
  "covered_chapters": ["第一章", "第二章", "第三章", "第四章"]
}
```

### 节点④：内容分析（Code 节点）

**节点类型：** Code（JavaScript）
**用途：** 分析知识库内容，提取知识点列表，判断内容是否充足

```javascript
// 输入：validated_params, knowledge_scan_result
// 输出：content_analysis

function main({validated_params, knowledge_scan_result}) {
  const chunks = knowledge_scan_result.content_chunks || [];
  const chapters = knowledge_scan_result.covered_chapters || [];

  // 提取知识点关键词（从知识片段中抽取）
  const knowledge_points = [];
  const keyword_patterns = [
    /(.{2,20}(?:算法|模型|方法|理论|原理|定义|分类|特征|应用))/g
  ];

  chunks.forEach(chunk => {
    keyword_patterns.forEach(pattern => {
      const matches = chunk.content.match(pattern);
      if (matches) {
        matches.forEach(m => {
          const trimmed = m.trim();
          if (trimmed.length >= 4 && !knowledge_points.includes(trimmed)) {
            knowledge_points.push(trimmed);
          }
        });
      }
    });
  });

  // 判断内容是否充足
  const min_chunks_required = Math.ceil(validated_params.count / 2);
  const is_sufficient = chunks.length >= min_chunks_required;

  // 构建内容摘要（前馈给LLM）
  const content_summary = chunks.map(c => {
    return `【${c.source}】\n${c.content.substring(0, 300)}`;
  }).join("\n\n");

  return {
    is_sufficient: is_sufficient,
    content_summary: content_summary,
    knowledge_points: knowledge_points.slice(0, 30),
    chapter_coverage: chapters,
    total_chunks: chunks.length,
    reason: is_sufficient ? null : `知识库内容不足（${chunks.length}段，需≥${min_chunks_required}段）`
  };
}
```

### 节点⑤：条件分支

**分支逻辑：**
- `content_analysis.is_sufficient === true` → 进入节点⑦（LLM出题）
- `content_analysis.is_sufficient === false` → 进入节点⑥（错误返回）

### 节点⑥：内容不足错误返回（Code 节点）

**节点类型：** Code（JavaScript）

```javascript
function main({content_analysis}) {
  return {
    error: {
      code: "INSUFFICIENT_CONTENT",
      message: content_analysis.reason || "课程资料内容不足以生成题目，请先上传更多课程资料"
    }
  };
}
```

### 节点⑦：LLM出题（LLM 节点）

**节点类型：** LLM（大语言模型）
**用途：** 基于课程内容生成选择题

**配置参数：**

| 参数 | 设置 |
|------|------|
| 模型 | Coze 最新旗舰模型 |
| 温度 | 0.8（适度创造性，避免题目雷同） |
| 最大Token | 4096 |
| 回复格式 | 文本（JSON格式） |

**System Prompt：**
```
你是一位专业的课程测评设计师，擅长根据教学内容生成高质量的选择题。
你的任务是根据课程知识库中的内容，生成严谨、有区分度、覆盖核心知识点的选择题。
```

**User Prompt：**
```
## 课程内容摘要
以下是从课程知识库中提取的内容：

{{content_analysis.content_summary}}

## 识别到的知识点
{{content_analysis.knowledge_points.join("、")}}

## 出题要求
- 难度：{{validated_params.params.difficulty}}
- 题目数量：{{validated_params.params.count}}
- 覆盖章节：尽量覆盖以下章节：{{content_analysis.chapter_coverage.join("、")}}
{% if validated_params.params.knowledge_points.length > 0 %}
- 出题范围限制在以下知识点：{{validated_params.params.knowledge_points.join("、")}}
{% endif %}

## 输出格式要求
你必须严格按照以下JSON格式输出，不要包含任何额外的文字说明：

{
  "difficulty": "{{validated_params.params.difficulty}}",
  "questions": [
    {
      "index": 1,
      "stem": "题干的完整文本，以问号结尾",
      "options": {
        "A": "选项A",
        "B": "选项B",
        "C": "选项C",
        "D": "选项D"
      },
      "correctAnswer": "A",
      "difficulty": "easy|medium|hard",
      "knowledgePoints": ["知识点1", "知识点2"],
      "explanation": "答案解析：为什么对、为什么错、知识点回顾"
    }
  ]
}

## 质量规则
1. 每道题有且只有一个正确答案
2. 干扰项必须有迷惑性
3. 同一批题目不能考点重复
4. 不要使用"以上都是"或"以上都不是"作为选项
5. 不要使用否定式题干（如"以下哪个不是"）
6. 每题必须标注1-2个知识点标签
7. 每题必须附带详细解析
```

### 节点⑧：JSON校验（Code 节点）

**节点类型：** Code（JavaScript）
**用途：** 校验LLM输出的JSON格式是否正确

```javascript
// 输入：llm_output（LLM节点的输出文本）
// 输出：validation_result

function main({llm_output}) {
  const errors = [];

  // 尝试解析JSON
  let parsed;
  try {
    // 去除可能的代码块标记
    let jsonStr = llm_output.trim();
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.substring(7);
    }
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.substring(3);
    }
    if (jsonStr.endsWith("```")) {
      jsonStr = jsonStr.substring(0, jsonStr.length - 3);
    }
    parsed = JSON.parse(jsonStr.trim());
  } catch (e) {
    return {
      is_valid: false,
      errors: [{field: "json_parse", message: "LLM输出不是有效的JSON格式"}],
      parsed: null,
      retry_needed: true
    };
  }

  // 校验结构
  if (!parsed.questions || !Array.isArray(parsed.questions)) {
    errors.push({field: "questions", message: "缺少questions数组"});
    return {is_valid: false, errors, parsed: null, retry_needed: true};
  }

  if (parsed.questions.length === 0) {
    errors.push({field: "questions", message: "questions数组为空"});
    return {is_valid: false, errors, parsed: null, retry_needed: true};
  }

  // 逐题校验
  parsed.questions.forEach((q, i) => {
    if (!q.stem) errors.push({field: `q[${i}].stem`, message: "题干为空"});
    if (!q.options) errors.push({field: `q[${i}].options`, message: "选项为空"});
    if (q.options) {
      ["A","B","C","D"].forEach(k => {
        if (!q.options[k]) errors.push({field: `q[${i}].options.${k}`, message: `选项${k}为空`});
      });
    }
    if (!["A","B","C","D"].includes(q.correctAnswer)) {
      errors.push({field: `q[${i}].correctAnswer`, message: "正确答案必须是A/B/C/D"});
    }
    if (!q.explanation) errors.push({field: `q[${i}].explanation`, message: "解析为空"});
  });

  return {
    is_valid: errors.length === 0,
    errors: errors,
    parsed: parsed,
    retry_needed: errors.length > 2 // 错误太多才重试
  };
}
```

### 节点⑨：条件分支（重试逻辑）

**分支逻辑：**
- `validation_result.is_valid === true` → 进入节点⑪（成功结束）
- `validation_result.is_valid === false && validation_result.retry_needed === true` → 进入节点⑫（重试LLM）
- `validation_result.is_valid === false && validation_result.retry_needed === false` → 进入节点⑭（错误结束）

### 节点⑩：重试LLM（LLM 节点）

**节点类型：** LLM
**用途：** 使用修正指令重新生成

**配置：** 同节点⑦，但增加以下修正指令：
```
注意：你上次生成的JSON格式有误，具体错误如下：
{{validation_result.errors.map(e => e.field + ": " + e.message).join("\n")}}

请严格按照JSON格式重新生成，确保：
1. 输出的内容必须是一个完整的、合法的JSON对象
2. 不要包含任何额外的文字、代码块标记或注释
3. 所有字符串必须使用双引号
```

**重试计数器：** 在Workflow变量中维护 `retry_count`
- 第1次失败 → 重试（进入节点⑩）
- 第2次失败 → 不再重试，进入节点⑭

### 节点⑪：成功结束（End）

**输出参数：**

| 参数名 | 类型 | 说明 |
|--------|------|------|
| `code` | Number | 200 |
| `message` | String | "success" |
| `data.batch_id` | String | 本次生成的批次ID |
| `data.difficulty` | String | 出题难度 |
| `data.questions` | Array | 题目数组（不含答案，供学生答题用） |
| `data.questions_full` | Array | 完整题目数组（含答案和解析，供服务端存储） |
| `data.created_at` | String | 生成时间 |

### 节点⑫：错误结束（End）

**输出参数：**

| 参数名 | 类型 | 说明 |
|--------|------|------|
| `code` | Number | 业务错误码 |
| `message` | String | 错误描述 |
| `error.code` | String | 错误码标识 |
| `error.message` | String | 详细错误信息 |

---

## 四、完整输入/输出JSON示例

### 请求输入

```json
{
  "course_id": "1001",
  "difficulty": "mixed",
  "count": 10,
  "knowledge_points": []
}
```

### 成功响应输出

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "batch_id": "quiz-batch-uuid-20260703-001",
    "difficulty": "mixed",
    "questions": [
      {
        "index": 1,
        "stem": "以下哪个是监督学习的典型算法？",
        "options": {
          "A": "K-Means聚类",
          "B": "线性回归",
          "C": "主成分分析(PCA)",
          "D": "Apriori算法"
        }
      }
    ],
    "questions_full": [
      {
        "index": 1,
        "stem": "以下哪个是监督学习的典型算法？",
        "options": {
          "A": "K-Means聚类",
          "B": "线性回归",
          "C": "主成分分析(PCA)",
          "D": "Apriori算法"
        },
        "correctAnswer": "B",
        "difficulty": "easy",
        "knowledgePoints": ["监督学习", "线性回归"],
        "explanation": "线性回归是监督学习的经典算法，它使用标注数据（带标签的训练样本）来学习从输入到输出的映射关系。K-Means和PCA是无监督学习算法，Apriori是关联规则挖掘算法。"
      }
    ],
    "created_at": "2026-07-03T12:00:00Z"
  }
}
```

### 内容不足响应

```json
{
  "code": 400,
  "message": "课程资料内容不足以生成题目",
  "error": {
    "code": "INSUFFICIENT_CONTENT",
    "message": "当前知识库仅包含3段内容，至少需要5段才能生成10道题目。请先上传更多课程资料（PDF/Word/PPT等）。"
  }
}
```

### 参数校验失败响应

```json
{
  "code": 400,
  "message": "参数校验失败",
  "error": {
    "code": "PARAM_INVALID",
    "message": "题目数量必须在1-20之间"
  }
}
```

### JSON生成失败响应（重试后仍失败）

```json
{
  "code": 500,
  "message": "题目生成失败",
  "error": {
    "code": "GENERATION_FAILED",
    "message": "AI出题服务异常，请稍后重试。如果问题持续，请联系管理员。"
  }
}
```

---

## 五、错误处理

| 错误场景 | 检测节点 | 处理方式 | 错误码 |
|----------|----------|----------|--------|
| 参数缺失/无效 | 节点② | 直接返回 | PARAM_INVALID |
| 知识库为空 | 节点④ | 返回INSUFFICIENT_CONTENT | INSUFFICIENT_CONTENT |
| 知识库检索失败 | 节点③ | 重试1次，失败则返回 | KB_RETRIEVAL_FAILED |
| LLM输出JSON格式错误 | 节点⑧ | 重试最多2次 | GENERATION_FAILED |
| LLM生成超时 | 节点⑦ | 超时设为30秒，超时则重试 | LLM_TIMEOUT |
| 重试超过次数 | 节点⑩→条件 | 放弃，返回错误 | MAX_RETRY_EXCEEDED |
| 生成的题目数量不足 | 节点⑧ | 如果少于要求数量的50%，重试 | INSUFFICIENT_QUESTIONS |

---

## 六、性能指标

| 指标 | 目标值 |
|------|--------|
| 端到端响应时间（10题） | ≤ 8 秒 |
| JSON格式正确率 | ≥ 95% |
| 首次生成成功率 | ≥ 85% |
| 含重试后的成功率 | ≥ 98% |
| 题目可用率（通过质量校验） | ≥ 90% |
