# 智慧教学平台 (SmartTeachingPlatform)

## 技术栈

### 前端
- Vue 3
- Vite
- Element Plus
- Axios
- ECharts / Vue-ECharts
- Vue Router
- Pinia

### 后端
- Node.js
- Express
- MySQL (mysql2)

## 项目结构

```
SmartTeachingPlatform/
├── frontend（前端）/          # 前端项目
│   ├── src/
│   │   ├── api/              # API 请求封装
│   │   ├── router/           # 路由配置
│   │   ├── stores/           # Pinia 状态管理
│   │   ├── styles/           # 全局样式
│   │   ├── App.vue           # 根组件
│   │   └── main.js           # 入口文件
│   ├── .env                  # 环境变量
│   ├── index.html            # HTML 模板
│   ├── package.json
│   └── vite.config.js        # Vite 配置
├── backend（后端）/           # 后端项目
│   ├── src/
│   │   ├── config/           # 配置（数据库等）
│   │   ├── middleware/        # 中间件
│   │   ├── routes/           # 路由
│   │   └── app.js            # 入口文件
│   ├── .env                  # 环境变量
│   └── package.json
├── database/                 # 数据库脚本
│   ├── ai_teaching_platform_ddl.sql
│   └── er_diagram.html
├── docs/                     # 文档
│   ├── API.md
│   └── PRD.md
└── prompts/                  # AI 提示词
```

## 快速开始

### 前端
```bash
cd "frontend（前端）"
npm install
npm run dev
```
开发服务器将运行在 http://localhost:5173

### 后端
```bash
cd "backend（后端）"
npm install
npm run dev
```
后端服务将运行在 http://localhost:3000

### 数据库
运行 `database/ai_teaching_platform_ddl.sql` 初始化数据库表结构。
