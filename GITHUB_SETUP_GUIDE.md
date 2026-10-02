# 2級建築施工管理技士 絶対合格プログラム
## GitHub常駐・自動アップデート＆スマホ利用ガイド

本アプリは、**GitHub Pages** を利用することで、サーバー維持費ゼロ・24時間365日いつでもスマホやタブレットからアクセスして学習できます。  
さらに **PWA（Progressive Web App）** に完全対応しているため、スマホの「ホーム画面に追加」することで、建設現場の仮設詰所や地下鉄、飛行機などの**完全圏外（オフライン）でも100%フル機能でサクサク学習**できます。

---

## 🎯 公開後のスマホアクセスURL
```
https://genn0710-max.github.io/sekou2-gishi-app/
```
※ 既存の別プロジェクト（`g-kentei-app`等）とは完全に隔離された個別リポジトリのため、相互干渉の心配はありません。

---

## ステップ 1: GitHubでリポジトリを作成する（初回のみ）

1. ブラウザで [GitHub - New Repository](https://github.com/new) を開きます。
2. 以下の項目を入力・選択します：
   - **Repository name**: `sekou2-gishi-app`
   - **Description**: `2級建築施工管理技士 絶対合格プログラム（1次・2次検定・経験記述AI添削・PWA）`
   - **Public**（公開）を選択（※GitHub Pagesを無料利用するため）
   - 「Add a README file」「.gitignore」「license」のチェックは**すべて外したまま**にします。
3. 一番下の **「Create repository」** ボタンをクリックします。

---

## ステップ 2: ローカルからGitHubへ初回プッシュ

ターミナルを開き、以下のコマンドを実行します：

```bash
cd "/Users/suzukikantoku/Desktop/名称未設定フォルダ 2/sekou2-gishi-app"

# リモートリポジトリを登録
git remote add origin https://github.com/genn0710-max/sekou2-gishi-app.git

# すべてのファイルをコミットしてプッシュ
git add .
git commit -m "feat: 初回リリース (2級建築施工管理技士 絶対合格プログラム)"
git push -u origin main
```

---

## ステップ 3: GitHub Pages（Web常駐・スマホ公開）を有効化

1. GitHubのリポジトリページ（`https://github.com/genn0710-max/sekou2-gishi-app`）を開きます。
2. 上部メニューの **「Settings（設定）」** をクリック。
3. 左サイドバーの **「Pages」** をクリック。
4. **「Build and deployment」** の設定：
   - **Source**: `Deploy from a branch` を選択
   - **Branch**: `main` を選択、フォルダは `/ (root)` のまま **「Save」** をクリック。
5. 1分ほど待ってページを再読み込みすると、緑色の枠で公開URLが表示されます：
   ```
   Your site is live at https://genn0710-max.github.io/sekou2-gishi-app/
   ```

---

## ステップ 4: スマホ・タブレットで初期登録（QRコード読取）

1. パソコン画面で `qr_view.html` を開きます（またはアプリ画面右上の「📱 スマホ登録QR」をクリック）。
2. スマホのカメラをQRコードにかざしてアクセスします。

### 📱 iPhone / iPad の場合 (Safari)
1. Safariでアクセスしたら、画面下の **共有ボタン（四角に上矢印）** をタップ。
2. メニューをスクロールして **「ホーム画面に追加」** をタップ。
3. 右上の **「追加」** をタップ。
4. **ホーム画面に専用アプリアイコンが出現します！** アドレスバーのないフルスクリーンで起動し、完全オフラインでも学習できます。

### 🤖 Android の場合 (Chrome)
1. Chromeでアクセスしたら、右上のメニュー（︙）から **「ホーム画面に追加」** または **「アプリをインストール」** をタップ。
2. ネイティブアプリ感覚でホーム画面から一発起動できます。

---

## ⚡ アプリの継続アップデート方法（変更を反映させる場合）

問題の追加や機能修正を行った際、GitHubへ最新状態を反映するための**ワンクリック更新スクリプト**を用意しています。

### 方法: ワンクリック更新スクリプトを実行
ターミナルで本フォルダに移動し、以下を実行するだけです：

```bash
cd "/Users/suzukikantoku/Desktop/名称未設定フォルダ 2/sekou2-gishi-app"
./update_github.sh "更新内容のメモ（例: 新問題を追加）"
```

※ これだけで、変更ファイルが自動で `git add` ➔ `git commit` ➔ `git push` され、GitHub Pages上のスマホアプリも即座に最新版に自動更新されます！
