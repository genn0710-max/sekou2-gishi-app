#!/bin/bash
# ================================================================
#  GitHub確実公開スクリプト（Personal Access Token対応）
# ================================================================

set -e
cd "$(dirname "$0")"

echo "================================================================"
echo "  🔑 GitHub Pages 確実送信プログラム"
echo "================================================================"
echo ""
echo "GitHubは2021年に通常のパスワード入力を廃止したため、"
echo "「Personal Access Token（個人用トークン）」が必要です。"
echo ""
echo "トークンをまだお持ちでない場合は、以下のURLから1分で発行できます："
echo "👉 https://github.com/settings/tokens/new?scopes=repo&description=sekou2-app"
echo ""
read -p "GitHubのトークン（ghp_...）を貼り付けてEnterを押してください: " GITHUB_TOKEN

if [[ -z "$GITHUB_TOKEN" ]]; then
  echo "⚠️ トークンが入力されませんでした。処理を中断します。"
  exit 1
fi

echo "🚀 GitHubへ送信（プッシュ）中..."
git remote set-url origin "https://${GITHUB_TOKEN}@github.com/genn0710-max/sekou2-gishi-app.git"

if git push origin main --tags; then
  git remote set-url origin "https://github.com/genn0710-max/sekou2-gishi-app.git"
  echo ""
  echo "================================================================"
  echo "  🎉 おめでとうございます！GitHubへのプッシュが100%成功しました！"
  echo "================================================================"
  echo ""
  echo "公開URL: https://genn0710-max.github.io/sekou2-gishi-app/"
  open "https://genn0710-max.github.io/sekou2-gishi-app/" 2>/dev/null || true
else
  git remote set-url origin "https://github.com/genn0710-max/sekou2-gishi-app.git"
  echo "❌ 送信に失敗しました。トークンの権限（repo）をご確認ください。"
  exit 1
fi
