#!/bin/bash

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 正在启动 Raddit 本地开发环境 (Localhost 模式)...${NC}"

# 1. 检查 MongoDB
echo -e "\n${YELLOW}>>> 1. 检查 MongoDB...${NC}"
if ! pgrep -x "mongod" > /dev/null; then
    echo "MongoDB 未运行，正在启动..."
    brew services start mongodb/brew/mongodb-community
    sleep 2
else
    echo -e "${GREEN}✅ MongoDB 正在运行${NC}"
fi

# 2. 提示用户
echo -e "\n${YELLOW}>>> 2. 启动服务${NC}"
echo "由于需要查看日志，建议你在两个独立的终端窗口中分别运行以下命令："

echo -e "\n${GREEN}终端 1 (后端):${NC}"
echo "cd server && npm start"

echo -e "\n${GREEN}终端 2 (前端):${NC}"
echo "cd client && npm run dev"

echo -e "\n${BLUE}>>> 访问地址${NC}"
echo -e "前端页面: ${GREEN}http://localhost:1145${NC}"
echo -e "后端 API: ${GREEN}http://localhost:8848${NC}"

echo -e "\n${YELLOW}⚠️  注意: 如果遇到连接问题，请尝试使用 127.0.0.1。${NC}"
