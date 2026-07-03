-- ============================================================
-- Coze AI 默认配置种子数据
-- 将此文件中的 agent_id / workflow_id 替换为你的实际值后执行
-- ============================================================

-- 为所有已有课程绑定默认 AI 助教 Agent + Workflow
-- 如果课程已有绑定则更新，没有则插入
INSERT INTO ai_assistant_bind (course_id, coze_bot_id, workflow_id, assistant_name, assistant_avatar, welcome_message, system_prompt, is_active)
SELECT 
  c.id,
  '7658214917564596233',   -- 你的 Agent ID (Bot ID)
  '765822217184069266',    -- 你的 Workflow ID
  'AI助教',
  NULL,
  '您好，我是本课程的AI助教，有什么可以帮助您的？',
  '你是一位专业的AI助教，请根据课程资料帮助学生解答问题。回答应准确、简洁、有教育意义。',
  1
FROM course c
WHERE c.is_deleted = 0
ON DUPLICATE KEY UPDATE
  coze_bot_id = VALUES(coze_bot_id),
  workflow_id = VALUES(workflow_id),
  is_active = 1;
