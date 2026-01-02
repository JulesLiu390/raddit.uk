#!/bin/bash

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}📦 开始全自动安装环境依赖...${NC}"

# 1. 检测并安装 Homebrew (macOS 包管理器)
echo -e "\n${YELLOW}>>> 1. 检查 Homebrew...${NC}"
if ! command -v brew &> /dev/null; then
    echo -e "${RED}❌ 未检测到 Homebrew，正在安装...${NC}"
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    # 配置 Homebrew 环境变量 (针对 Apple Silicon 和 Intel)
    if [[ $(uname -m) == 'arm64' ]]; then
        echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
        eval "$(/opt/homebrew/bin/brew shellenv)"
    else
        echo 'eval "$(/usr/local/bin/brew shellenv)"' >> ~/.zprofile
        eval "$(/usr/local/bin/brew shellenv)"
    fi
else
    echo -e "${GREEN}✅ Homebrew 已安装${NC}"
fi

# 2. 安装 Node.js
echo -e "\n${YELLOW}>>> 2. 检查 Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo "⬇️ 正在安装 Node.js..."
    brew install node
else
    echo -e "${GREEN}✅ Node.js 已安装 ($(node -v))${NC}"
fi

# 3. 安装 MongoDB
echo -e "\n${YELLOW}>>> 3. 检查 MongoDB...${NC}"
if ! command -v mongod &> /dev/null; then
    echo "⬇️ 正在安装 MongoDB Community Edition..."
    brew tap mongodb/brew
    brew install mongodb-community
    echo "🚀 启动 MongoDB 服务..."
    brew services start mongodb/brew/mongodb-community
else
    echo -e "${GREEN}✅ MongoDB 已安装 ($(mongod --version | head -n 1))${NC}"
    # 检查服务状态
    if ! brew services list | grep -q "mongodb-community.*started"; then
        echo "🚀 MongoDB 服务未运行，正在启动..."
        brew services start mongodb/brew/mongodb-community
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
