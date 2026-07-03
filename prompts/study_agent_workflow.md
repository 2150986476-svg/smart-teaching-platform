# Coze Workflow ①：AI学习助教

> 适用场景：学生通过对话界面向课程AI助教提问
> 触发方式：对话触发（绑定知识库）

---

## 一、工作流概述

| 项目 | 说明 |
|------|------|
| **工作流名称** | AI学习助教 - 课程问答 |
| **触发方式** | 对话触发（Bot绑定知识库） |
| **核心模型** | Coze 最新旗舰模型 |
| **输入来源** | 学生对话窗口 + 系统变量（course_id, session_id） |

---

## 二、工作流节点图

```
┌─────────────┐
│  ① 开始节点  │ ← 接收学生问题和系统上下文
└──────┬──────┘
       ↓
┌─────────────┐
│  ② 变量提取  │ ← Code: 解析session_id、course_id、历史消息
└──────┬──────┘
       ↓
┌─────────────┐
│  ③ 权限校验  │ ← Code: 校验学生是否有权访问该课程
└──────┬──────┘
       ↓
┌─────────────┐
│  ④ 知识库检索 │ ← Knowledge: RAG检索课程知识库
└──────┬──────┘
       ↓
┌─────────────┐
│  ⑤ 上下文组装 │ ← Code: 组装历史+检索结果+system prompt
└──────┬──────┘
       ↓
┌─────────────┐
│  ⑥ LLM回答   │ ← LLM: 生成最终回答（流式输出）
└──────┬──────┘
       ↓
┌─────────────┐
│  ⑦ 结束节点  │ ← 输出回答文本 + 引用来源
└─────────────┘
```

---

## 三、节点详细设计

### 节点①：开始节点（Start）

**输入参数：**

| 参数名 | 类型 | 来源 | 说明 |
|--------|------|------|------|
| `question` | String | 用户输入 | 学生提问的文本内容 |
| `course_id` | String | 系统变量（Bot参数） | 当前课程ID，由平台启动Bot时传入 |
| `student_id` | String | 系统变量（Bot参数） | 当前学生ID，由平台启动Bot时传入 |
| `session_id` | String | 系统变量（Bot参数） | 对话会话ID，用于维持上下文 |
| `history_messages` | Array | 对话历史 | 当前会话的前N轮对话（由Coze自动管理） |

### 节点②：变量提取（Code 节点）

**节点类型：** Code（JavaScript）
**用途：** 从系统变量和历史消息中提取结构化数据

```javascript
// 输入：question, course_id, student_id, session_id, history_messages
// 输出：parsed_input

function main({question, course_id, student_id, session_id, history_messages}) {
  // 将历史消息格式化为LLM可读的上下文
  let history_context = "";
  if (history_messages && history_messages.length > 0) {
    const recent = history_messages.slice(-6); // 保留最近6轮
    history_context = recent.map(msg => {
      const role = msg.role === 'user' ? '学生' : 'AI助教';
      return `${role}: ${msg.content}`;
    }).join("\n");
  }

  return {
    question: question.trim(),
    course_id: course_id,
    student_id: student_id,
    session_id: session_id,
    history_context: history_context,
    history_count: history_messages ? history_messages.length : 0
  };
}
```

**输出JSON：**
```json
{
  "question": "什么是反向传播算法？",
  "course_id": "1001",
  "student_id": "2024001",
  "session_id": "session-uuid-xxx",
  "history_context": "学生: 你好\nAI助教: 你好！有什么可以帮助你的？",
  "history_count": 2
}
```

### 节点③：权限校验（Code 节点）

**节点类型：** Code（JavaScript）
**用途：** 校验学生是否有权限向该课程提问（是否在选课名单中）

```javascript
// 输入：parsed_input（节点②的输出）
// 输出：auth_result

function main({parsed_input}) {
  // 注意：此处的校验为轻量级检查
  // 完整的权限校验已在平台后端API完成
  // Coze Workflow中主要做参数合法性检查
  
  const errors = [];
  
  if (!parsed_input.question) {
    errors.push("问题内容不能为空");
  }
  if (parsed_input.question.length > 2000) {
    errors.push("问题内容超过2000字限制");
  }
  if (!parsed_input.course_id) {
    errors.push("缺少课程ID");
  }
  
  if (errors.length > 0) {
    return {
      is_valid: false,
      error_code: "PARAM_INVALID",
      error_message: errors.join("；")
    };
  }
  
  return {
    is_valid: true,
    error_code: null,
    error_message: null
  };
}
```

**条件分支：**
- 如果 `auth_result.is_valid === false` → 直接跳转到**结束节点**，返回错误信息
- 如果 `auth_result.is_valid === true` → 进入节点④

### 节点④：知识库检索（Knowledge 节点）

**节点类型：** 知识库检索（Knowledge）
**用途：** 基于学生问题，在课程知识库中检索相关文档片段

**配置参数：**

| 参数 | 设置 |
|------|------|
| 关联知识库 | {{course_id}} 对应的Coze知识库（动态绑定） |
| 检索方式 | 向量检索 + 关键词混合检索 |
| 检索条数 | 5 条 |
| 匹配阈值 | 0.65 |
| 返回内容 | 文本片段 + 来源文件名 |

**输出JSON：**
```json
{
  "knowledge_chunks": [
    {
      "content": "反向传播（Backpropagation）是训练神经网络的核心算法，通过链式法则计算损失函数对各层权重的梯度...",
      "source": "第三章-神经网络.pdf",
      "score": 0.92,
      "page": 45
    },
    {
      "content": "反向传播算法主要分为两个阶段：前向传播计算损失，反向传播计算梯度...",
      "source": "讲义-深度学习基础.docx",
      "score": 0.87,
      "page": null
    }
  ],
  "total_chunks": 5,
  "has_result": true
}
```

### 节点⑤：上下文组装（Code 节点）

**节点类型：** Code（JavaScript）
**用途：** 将历史对话 + 检索结果 + 系统指令组装为LLM的完整Prompt

```javascript
// 输入：parsed_input, knowledge_result
// 输出：llm_input

function main({parsed_input, knowledge_result}) {
  // 格式化知识库检索结果
  let knowledge_text = "";
  if (knowledge_result.knowledge_chunks && knowledge_result.knowledge_chunks.length > 0) {
    knowledge_text = "以下是从课程资料中检索到的相关内容：\n\n";
    knowledge_result.knowledge_chunks.forEach((chunk, index) => {
      knowledge_text += `【资料 ${index + 1}】来自《${chunk.source}》\n`;
      knowledge_text += chunk.content + "\n\n";
    });
  } else {
    knowledge_text = "【提示】课程知识库中没有检索到与问题直接相关的内容。\n";
  }

  return {
    system_prompt: `你是一位专业、耐心、善于引导的大学课程AI助教。
你的回答必须严格基于课程知识库中的内容。
如果知识库中没有相关信息，请明确告知学生"课程资料中没有覆盖这个问题"。
回答结束后，主动提供一个追问方向帮助深入学习。`,
    history_context: parsed_input.history_context,
    knowledge_context: knowledge_text,
    question: parsed_input.question,
    has_knowledge: knowledge_result.has_result
  };
}
```

**输出JSON：**
```json
{
  "system_prompt": "...",
  "history_context": "...",
  "knowledge_context": "以下是从课程资料中检索到的相关内容：\n\n【资料 1】来自《第三章-神经网络.pdf》\n反向传播...",
  "question": "什么是反向传播算法？",
  "has_knowledge": true
}
```

### 节点⑥：LLM回答（LLM 节点）

**节点类型：** LLM（大语言模型）
**用途：** 生成最终的回答

**配置参数：**

| 参数 | 设置 |
|------|------|
| 模型 | Coze 最新旗舰模型 |
| 温度 | 0.7 |
| 最大Token | 2048 |
| 回复格式 | 流式输出 |
| System Prompt | 取自 `llm_input.system_prompt` |

**Prompt模板：**
```
{{llm_input.system_prompt}}

## 历史对话
{{llm_input.history_context}}

## 检索到的课程资料
{{llm_input.knowledge_context}}

## 学生当前问题
{{llm_input.question}}

请基于以上课程资料回答学生的问题。如果资料中没有相关信息，请如实告知。
回答结束后提供一个追问方向。
```

### 节点⑦：结束节点（End）

**输出参数：**

| 参数名 | 类型 | 说明 |
|--------|------|------|
| `answer` | String | AI助教的回答文本 |
| `references` | Array | 引用来源列表 |
| `has_knowledge` | Boolean | 是否检索到相关知识 |
| `token_consumed` | Number | 本次消耗的Token数 |

---

## 四、完整输入/输出JSON示例

### 请求输入

```json
{
  "question": "什么是反向传播算法？请举个具体例子",
  "course_id": "1001",
  "student_id": "2024001",
  "session_id": "session-abc-123",
  "history_messages": [
    {"role": "user", "content": "你好"},
    {"role": "assistant", "content": "你好！我是AI助教，有什么可以帮助你的？"}
  ]
}
```

### 成功响应输出

```json
{
  "answer": "反向传播（Backpropagation）是训练神经网络的核心算法。简单来说，它通过计算预测值与真实值之间的误差，将这个误差从输出层反向传播到输入层，逐层调整神经元的权重。\n\n**举个例子：** 假设我们要教神经网络识别猫和狗。\n1. 前向传播：网络看到一张图片，输出\"60%是猫，40%是狗\"\n2. 计算误差：正确答案是猫，但网络输出概率不够高\n3. 反向传播：误差从输出层往回传，告诉每一层\"你这里贡献了X%的错误\"\n4. 权重更新：每层根据传回来的信息调整自己的参数\n\n下次同样的图片，网络的识别准确率就会提升。\n\n【引用自：第三章-神经网络.pdf — 3.2节 反向传播算法】\n\n你想深入了解反向传播的数学原理吗？",
  "references": [
    {"source": "第三章-神经网络.pdf", "section": "3.2节 反向传播算法"},
    {"source": "讲义-深度学习基础.docx", "section": "2.3节"}
  ],
  "has_knowledge": true,
  "token_consumed": 512
}
```

### 无相关知识时的响应

```json
{
  "answer": "抱歉，课程资料中没有覆盖"反向传播算法"这个具体问题。我建议你可以：\n1. 查阅课程第三章关于神经网络的基础内容\n2. 在课堂上向老师请教这个问题\n3. 先了解前向传播的基本概念，这会帮助你理解反向传播",
  "references": [],
  "has_knowledge": false,
  "token_consumed": 128
}
```

### 参数校验失败响应

```json
{
  "answer": null,
  "error": {
    "code": "PARAM_INVALID",
    "message": "问题内容不能为空"
  },
  "references": [],
  "has_knowledge": false,
  "token_consumed": 0
}
```

---

## 五、错误处理

| 错误场景 | 检测节点 | 处理方式 | 返回信息 |
|----------|----------|----------|----------|
| 问题为空 | 节点③ | 直接返回 | error_code: PARAM_INVALID |
| 问题超长 | 节点③ | 截断至2000字 | 自动截断，继续处理 |
| 知识库未绑定 | 节点④ | 跳过检索，使用通用回复 | has_knowledge: false |
| 知识库检索超时 | 节点④ | 重试1次，超时则跳过 | has_knowledge: false |
| LLM生成失败 | 节点⑥ | 重试1次 | 返回"服务暂时不可用" |
| 会话ID无效 | 节点② | 创建新会话ID | 重新开始对话上下文 |

---

## 六、性能指标

| 指标 | 目标值 |
|------|--------|
| 端到端响应时间（P50） | ≤ 3 秒 |
| 端到端响应时间（P95） | ≤ 5 秒 |
| 知识库检索召回率 | ≥ 90% |
| LLM生成成功率 | ≥ 99% |
| 引用准确率 | ≥ 95% |
