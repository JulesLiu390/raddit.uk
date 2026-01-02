#!/bin/bash

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ENV_FILE="server/.env"
REQUIRED_VARS=(
    "PORT"
    "MONGODB_URI"
    "GOOGLE_CLIENT_ID"
    "GOOGLE_CLIENT_SECRET"
    "JWT_SECRET"
    "GEMINI_API_KEY"
    "IMGBB_API_KEY"
    "SSL_KEY_PATH"
    "SSL_CERT_PATH"
)

echo -e "${YELLOW}🔍 正在检查环境变量配置...${NC}"

if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ 错误：找不到配置文件 $ENV_FILE${NC}"
    echo "💡 请确保你在项目根目录下运行此脚本，或者手动创建 server/.env 文件。"
    exit 1
fi

MISSING_VARS=0
EMPTY_VARS=0

echo "检查文件: $ENV_FILE"
echo "----------------------------------------"

for var in "${REQUIRED_VARS[@]}"; do
    # 检查变量是否存在
    if ! grep -q "^${var}=" "$ENV_FILE"; then
        echo -e "${RED}❌ 缺失变量: $var${NC}"
        MISSING_VARS=$((MISSING_VARS+1))
    else
        # 检查值是否为空
        # 使用 cut 获取等号后的值，并去除可能的引号和空格
        value=$(grep "^${var}=" "$ENV_FILE" | cut -d '=' -f2- | tr -d ' "' | tr -d "'")
        
        if [ -z "$value" ]; then
             # 对于 SSL 相关的变量，如果是开发环境可能允许为空，这里做个特殊提示
             if [[ "$var" == "SSL_KEY_PATH" || "$var" == "SSL_CERT_PATH" ]]; then
                echo -e "${YELLOW}⚠️  变量为空: $var (开发环境可忽略，生产环境必须)${NC}"
             else
                echo -e "${RED}❌ 变量为空: $var${NC}"
                EMPTY_VARS=$((EMPTY_VARS+1))
             fi
        else
             # 简单的掩码显示，只显示前几个字符
             if [ ${#value} -gt 5 ]; then
                masked="${value:0:4}..."
             else
                masked="***"
             fi
             echo -e "${GREEN}✅ $var 已配置 ($masked)${NC}"
        fi
    fi
done

echo "----------------------------------------"
TOTAL_ISSUES=$((MISSING_VARS + EMPTY_VARS))

if [ $TOTAL_ISSUES -eq 0 ]; then
    echo -e "${GREEN}🎉 完美！所有必要的环境变量都已配置。${NC}"
    exit 0
else
    echo -e "${RED}❌ 检测到 $TOTAL_ISSUES 个配置问题，请检查 $ENV_FILE 文件。${NC}"
    exit 1
fi
