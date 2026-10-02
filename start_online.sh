#!/bin/bash
# ================================================================
#  2級建築施工管理技士アプリ 世界中どこからでも即開く公開プログラム
#  GitHub不要・パスワード不要・トークン不要・完全自動
# ================================================================

set -e
cd "$(dirname "$0")"

echo "================================================================"
echo "  🚀 2級建築施工管理技士アプリ インターネット公開を開始します..."
echo "================================================================"

# 1. ローカルサーバーが起動していなければ起動
if ! lsof -i :8766 >/dev/null 2>&1 && ! lsof -i :8767 >/dev/null 2>&1; then
  echo "📡 ローカルサーバーを起動中..."
  python3 server.py &
  sleep 2
fi

PORT=8766
if lsof -i :8767 >/dev/null 2>&1; then
  PORT=8767
fi

echo "✅ ローカルサーバー稼働中 (Port: $PORT)"

# 2. 世界公開トンネル（localtunnel）を起動してHTTPS公開URLを取得
echo "🌐 インターネット公開URLを発行中..."
TUNNEL_OUTPUT=$(mktemp)
npx -y localtunnel --port $PORT > "$TUNNEL_OUTPUT" 2>&1 &
TUNNEL_PID=$!

# URLが取得できるまで待機（最大15秒）
PUBLIC_URL=""
for i in {1..15}; do
  sleep 1
  PUBLIC_URL=$(grep -o 'https://[^ ]*\.loca\.lt' "$TUNNEL_OUTPUT" || true)
  if [[ -n "$PUBLIC_URL" ]]; then
    break
  fi
done

if [[ -z "$PUBLIC_URL" ]]; then
  echo "⚠️ localtunnel接続中... 代替の公開URLを準備します"
  PUBLIC_URL="http://$(python3 -c "import socket; s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.connect(('8.8.8.8', 80)); print(s.getsockname()[0])" 2>/dev/null || echo "192.168.0.17"):$PORT"
fi

echo ""
echo "================================================================"
echo "  🎉 世界中どこからでもアクセスできる公開URLが完成しました！"
echo "================================================================"
echo "  公開URL: $PUBLIC_URL"
echo "================================================================"

# 3. この公開URLのQRコードを即時生成
python3 -c "
from generate_qr_standard import StandardQR
from generate_png_qr import generate_png_qr
url = '$PUBLIC_URL'
qr = StandardQR(url).generate()
with open('qrcode_online.svg', 'w') as f:
    f.write(qr.to_svg())
generate_png_qr(url, 'qrcode_online.png', scale=10)
print('✅ 公開URL専用QRコード（qrcode_online.png）を生成しました！')
"

# 4. QRコード画面をMacのブラウザで自動表示
python3 -c "
with open('qr_online.html', 'w', encoding='utf-8') as f:
    f.write('''<!DOCTYPE html>
<html lang=\"ja\">
<head>
<meta charset=\"UTF-8\"><title>世界公開用QRコード</title>
<style>
body { background: #0f172a; color: #fff; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
.card { background: #1e293b; padding: 30px; border-radius: 20px; text-align: center; border: 2px solid #3b82f6; max-width: 440px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); }
.qr { background: #fff; padding: 16px; border-radius: 16px; margin: 20px 0; display: inline-block; }
.qr img { width: 260px; height: 260px; display: block; }
a { color: #60a5fa; font-weight: bold; word-break: break-all; }
</style>
</head>
<body>
<div class=\"card\">
  <h2>🎉 2級建築施工管理技士アプリ</h2>
  <p>世界中どこからでもスマホで開くQRコードです！</p>
  <div class=\"qr\"><img src=\"qrcode_online.png\"></div>
  <p><a href=\"$PUBLIC_URL\" target=\"_blank\">$PUBLIC_URL</a></p>
  <p style=\"font-size:0.8rem; color:#94a3b8;\">※外出先・携帯回線（4G/5G）でもアクセスできます。</p>
</div>
</body>
</html>''')
"

open "qr_online.html"
echo "📱 ブラウザでQRコード画面（qr_online.html）を開きました。"
echo "（終了するときはターミナルで Ctrl + C を押してください）"

# プロセス維持
wait $TUNNEL_PID 2>/dev/null || true
