FROM node:20-slim

# 安装 cloudflared（从 Cloudflare 官方 APT 源，不走 GitHub）
RUN apt-get update && apt-get install -y curl gnupg \
    && curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
    | tee /usr/share/keyrings/cloudflare-main.gpg > /dev/null \
    && echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared/ any main' \
    | tee /etc/apt/sources.list.d/cloudflared.list \
    && apt-get update && apt-get install -y cloudflared \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 复制项目文件
COPY . .

# 安装后端依赖
WORKDIR /app/backend（后端）
RUN npm install

# 安装前端依赖并构建
WORKDIR /app/frontend（前端）
RUN npm install && npm run build

# 设置启动脚本权限
WORKDIR /app
RUN chmod +x start-cloudflare.sh

# 暴露端口
EXPOSE 8080

# 启动：Node.js + Cloudflare 隧道
CMD ["bash", "/app/start-cloudflare.sh"]
