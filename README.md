# Raddit.uk

一个使用 React + Node.js 构建的全栈论坛应用。

## 项目结构

```
raddit.uk/
├── client/          # React 前端
│   ├── src/
│   │   ├── api/     # API 请求封装
│   │   ├── components/  # React 组件
│   │   ├── App.jsx  # 主应用组件
│   │   └── App.css  # 样式文件
│   └── package.json
├── server/          # Node.js 后端
│   ├── index.js     # Express 服务器
│   ├── .env         # 环境变量
│   └── package.json
└── README.md
```

## 快速开始

### 1. 启动后端服务

```bash
cd server
npm install
npm run dev
```

后端服务将在 http://localhost:5000 运行。

### 2. 启动前端服务

打开新终端：

```bash
cd client
npm install
npm run dev
```

前端服务将在 http://localhost:5173 运行。

## API 端点

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api` | 欢迎信息 |
| GET | `/api/posts` | 获取所有帖子 |
| POST | `/api/posts` | 创建新帖子 |

## 技术栈

### 前端
- React 18
- Vite
- Axios

### 后端
- Node.js
- Express
- CORS
- dotenv

## 功能特点

- ✅ 查看帖子列表
- ✅ 创建新帖子
- ✅ Reddit 风格的投票 UI
- ✅ 响应式设计

## 下一步扩展

- [ ] 添加数据库（MongoDB/PostgreSQL）
- [ ] 用户认证系统
- [ ] 实现投票功能
- [ ] 评论系统
- [ ] 子论坛（Subreddit）功能
