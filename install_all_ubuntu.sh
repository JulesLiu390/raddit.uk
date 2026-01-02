#!/bin/bash

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}📦 开始全自动安装环境依赖 (Ubuntu)...${NC}"

# 0. 更新系统软件源
echo -e "\n${YELLOW}>>> 0. 更新系统软件源...${NC}"
sudo apt-get update

# 1. 安装基础工具
echo -e "\n${YELLOW}>>> 1. 安装基础工具 (curl, git, gnupg)...${NC}"
sudo apt-get install -y curl git gnupg lsb-release

# 2. 安装 Node.js (使用 NodeSource)
echo -e "\n${YELLOW}>>> 2. 检查 Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo "⬇️ 正在安装 Node.js (LTS)..."
    # 安装 Node.js 20.x LTS
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo -e "${GREEN}✅ Node.js 已安装 ($(node -v))${NC}"
fi

# 3. 安装 MongoDB
echo -e "\n${YELLOW}>>> 3. 检查 MongoDB...${NC}"
if ! command -v mongod &> /dev/null; then
    echo "⬇️ 正在安装 MongoDB Community Edition..."
    
    # 导入公钥
    curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
       sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg

    # 获取 Ubuntu 代号 (如 jammy, focal)
    CODENAME=$(lsb_release -cs)
    
    # 创建列表文件
    echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu $CODENAME/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

    sudo apt-get update
    sudo apt-get install -y mongodb-org

    echo "🚀 启动 MongoDB 服务..."
    sudo systemctl start mongod
    sudo systemctl enable mongod
else
    echo -e "${GREEN}✅ MongoDB 已安装 ($(mongod --version | head -n 1))${NC}"
    # 检查服务状态
    if ! systemctl is-active --quiet mongod; then
        echo "🚀 MongoDB 服务未运行，正在启动..."
        sudo systemctl start mongod
    else
        echo -e "${GREEN}✅ MongoDB 服务正在运行${NC}"
    fi
fi

# 4. 安装项目依赖
echo -e "\n${YELLOW}>>> 4. 安装 npm 依赖...${NC}"

echo -e "📂 [Root] 安装根目录依赖..."
npm install

if [ -d "server" ]; then
    echo -e "📂 [Server] 安装后端依赖..."
    cd server && npm install && cd ..
else
    echo -e "${RED}❌ 错误：找不到 server 目录${NC}"
fi

if [ -d "client" ]; then
    echo -e "📂 [Client] 安装前端依赖..."
    cd client && npm install && cd ..
else
    echo -e "${RED}❌ 错误：找不到 client 目录${NC}"
fi

echo -e "\n${GREEN}🎉 所有依赖安装完成！环境准备就绪。${NC}"
