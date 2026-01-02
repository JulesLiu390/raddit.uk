# Raddit.uk

Raddit 是一个现代化的社区论坛平台，灵感来源于 Reddit。在这里，用户可以发布帖子、参与话题讨论、关注感兴趣的内容，并与具有独特人格的 AI 机器人“志涛”进行互动。

🔗 **在线访问**: [https://raddit.uk](https://raddit.uk)

## ✨ 主要功能

*   **内容发布**: 支持 Markdown 格式的帖子和评论，支持图片上传。
*   **互动系统**: 点赞、回复（支持楼中楼）、自定义表情回应（Reaction）。
*   **AI 机器人**: 集成 Google Gemini 驱动的 "志涛" 机器人，会自动回复特定话题或提及，拥有独特的人格设定。
*   **发现与关注**: 推荐流、热榜、关注的话题和用户。
*   **用户系统**: Google OAuth 一键登录，个人主页，通知系统。

## 🛠 技术栈

### 前端 (Client)
*   **框架**: React 18, Vite
*   **路由**: React Router v6
*   **样式**: CSS Modules, Responsive Design
*   **编辑器**: `@uiw/react-md-editor` (Markdown 编辑与预览)
*   **其他**: `canvas-confetti` (特效), `react-icons`

### 后端 (Server)
*   **运行时**: Node.js
*   **框架**: Express.js
*   **数据库**: MongoDB (Mongoose ODM)
*   **AI 集成**: Google Generative AI SDK (Gemini 2.5 Flash)
*   **认证**: Google OAuth 2.0, JWT
*   **安全**: HTTPS, Content Security Policy (CSP)

## 📂 项目结构

```
raddit.uk/
├── client/                 # 前端应用
│   ├── public/             # 静态资源
│   ├── src/
│   │   ├── api/            # API 接口封装
│   │   ├── components/     # 可复用组件 (PostCard, Header, etc.)
│   │   ├── context/        # React Context (Header状态等)
│   │   ├── hooks/          # 自定义 Hooks
│   │   ├── pages/          # 页面组件 (HomePage, PostDetail, etc.)
│   │   ├── utils/          # 工具函数 (图片上传等)
│   │   ├── App.jsx         # 路由配置
│   │   └── main.jsx        # 入口文件
│   └── vite.config.js
├── server/                 # 后端应用
│   ├── assets/             # 静态资源
│   ├── middleware/         # Express 中间件 (Auth, etc.)
│   ├── models/             # Mongoose 数据模型 (User, Post, Message)
│   ├── scripts/            # 维护脚本 (初始化 Bot 等)
│   ├── services/           # 业务逻辑服务 (GeminiBot)
│   ├── index.js            # 服务器入口
│   └── seed.js             # 数据库种子数据
└── README.md
```

## 🚀 快速开始

### 1. 环境准备
*   Node.js (v16+)
*   MongoDB
*   Google Cloud Console 项目 (用于 OAuth 和 Gemini API)

### 2. 后端设置
```bash
cd server
npm install
# 配置 .env 文件 (参考代码中的 process.env 使用)
node index.js
```

### 3. 前端设置
```bash
cd client
npm install
npm run dev
```