#!/bin/bash
set -e

echo "=== 启动 Node.js 后端 ==="
cd /app/backend（后端）
node src/app.js &
NODE_PID=$!

# 等待 Node.js 启动
echo "等待后端启动..."
for i in $(seq 1 30); do
  if curl -s http://localhost:8080/api/health > /dev/null 2>&1; then
    echo "后端已就绪 ✓"
    break
  fi
  sleep 2
done

# 启动 Cloudflare 隧道
echo "=== 启动 Cloudflare 隧道 ==="
cloudflared tunnel --url http://localhost:8080 \
  --metrics 0.0.0.0:49312 \
  2>&1 | tee /tmp/tunnel.log &
CF_PID=$!

# 等待隧道建立，提取公网 URL
echo "等待隧道建立..."
TUNNEL_URL=""
for i in $(seq 1 15); do
  TUNNEL_URL=$(grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/tunnel.log 2>/dev/null | head -1)
  if [ -n "$TUNNEL_URL" ]; then
    echo ""
    echo "=============================================="
    echo "  公网访问地址: $TUNNEL_URL"
    echo "=============================================="
    echo ""
    break
  fi
  sleep 3
done

if [ -z "$TUNNEL_URL" ]; then
  echo "隧道日志（最后20行）:"
  tail -20 /tmp/tunnel.log
fi

# 保持主进程运行
wait $NODE_PID
