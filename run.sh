#!/usr/bin/env bash
# 2級建築施工管理技士 絶対合格プログラム 起動スクリプト (macOS/Linux)

cd "$(dirname "$0")"

echo "======================================================"
echo " 🏗️  2級建築施工管理技士 絶対合格プログラム を起動します"
echo "======================================================"

# バックグラウンドでサーバーを起動
python3 server.py &
SERVER_PID=$!

# ポート検出待ち（最大5秒）
PORT=8766
for i in {1..20}; do
    if [ -f ".current_port" ]; then
        PORT=$(cat .current_port)
        break
    fi
    sleep 0.25
done

URL="http://localhost:${PORT}"
echo "ブラウザを開きます: ${URL}"

# OSに応じてブラウザを開く
if [[ "$OSTYPE" == "darwin"* ]]; then
    open "${URL}"
elif which xdg-open > /dev/null; then
    xdg-open "${URL}"
fi

# プロセス監視
trap "kill $SERVER_PID 2>/dev/null; rm -f .current_port; echo '終了しました。'; exit 0" SIGINT SIGTERM
wait $SERVER_PID
