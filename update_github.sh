#!/usr/bin/env bash
# 2級建築施工管理技士 アプリ GitHub自動同期・アップデートスクリプト

cd "$(dirname "$0")"

MSG="${1:-update: 施工管理技士アプリの更新}"

echo "======================================================"
echo " 🚀 GitHubへ最新データを同期・アップデートします"
echo " コミットメッセージ: ${MSG}"
echo "======================================================"

# Gitステータス確認
git add .
STATUS=$(git status --porcelain)

if [ -z "$STATUS" ]; then
    echo "⚠️ 変更点はありませんでした。既に最新状態です。"
    exit 0
fi

git commit -m "${MSG}"

echo "--> GitHubへプッシュ中..."
git push origin main

if [ $? -eq 0 ]; then
    echo "======================================================"
    echo " ✅ アップデートが完了しました！"
    echo " 数十秒後にGitHub Pages（スマホ側）へ自動反映されます。"
    echo " 公開URL: https://genn0710-max.github.io/sekou2-gishi-app/"
    echo "======================================================"
else
    echo "❌ プッシュに失敗しました。リモート設定またはネットワークを確認してください。"
    exit 1
fi
