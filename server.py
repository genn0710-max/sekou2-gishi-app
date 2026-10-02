#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
2級建築施工管理技士 絶対合格プログラム
完全スタンドアローンHTTP & APIサーバー
- Python 3 標準ライブラリのみで動作（ゼロ依存）
- 未使用ポート自動検出（デフォルト: 8766）
- 1次検定・2次検定・経験記述添削・重要数値カード対応
"""

import http.server
import socketserver
import json
import os
import sys
import socket
import urllib.parse
import re
from pathlib import Path
from datetime import datetime

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
PUBLIC_DIR = BASE_DIR

DEFAULT_PORT = 8766

def get_free_port(start_port=DEFAULT_PORT, max_attempts=100):
    """未使用の空きポートを探索して返す"""
    for port in range(start_port, start_port + max_attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    raise RuntimeError(f"利用可能なポートが {start_port}〜{start_port + max_attempts} の間に見つかりませんでした。")

def load_json(filepath, default_val=None):
    if not filepath.exists():
        return default_val if default_val is not None else []
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"[Error] Failed to read {filepath}: {e}", file=sys.stderr)
        return default_val if default_val is not None else []

def save_json(filepath, data):
    tmp_path = filepath.with_suffix(".tmp")
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp_path, filepath)

class SekouRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PUBLIC_DIR), **kwargs)

    def log_message(self, format, *args):
        sys.stdout.write(f"[{datetime.now().strftime('%H:%M:%S')}] {format % args}\n")

    def send_json_response(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path.startswith("/api/"):
            self.handle_api_get(path, parsed.query)
            return

        # ルートアクセスの場合は index.html を返す
        if path == "/" or path == "":
            self.path = "/index.html"

        super().do_GET()

    def handle_api_get(self, path, query_str):
        q1_file = DATA_DIR / "questions_1st.json"
        q2_file = DATA_DIR / "questions_2nd.json"
        cat_file = DATA_DIR / "categories.json"
        essay_file = DATA_DIR / "essay_templates.json"
        num_file = DATA_DIR / "numbers_card.json"
        user_file = DATA_DIR / "user_state.json"
        stage_file = DATA_DIR / "stages.json"

        if path == "/api/status":
            q1 = load_json(q1_file, [])
            q2 = load_json(q2_file, [])
            nums = load_json(num_file, [])
            essays = load_json(essay_file, {}).get("themes", [])
            stages = load_json(stage_file, [])
            self.send_json_response({
                "status": "ok",
                "app": "2級建築施工管理技士 絶対合格プログラム",
                "counts": {
                    "questions_1st": len(q1),
                    "questions_2nd": len(q2),
                    "numbers_cards": len(nums),
                    "essay_themes": len(essays),
                    "stages": len(stages)
                },
                "version": "1.1.0"
            })
            return

        if path == "/api/stages":
            stages = load_json(stage_file, [])
            self.send_json_response(stages)
            return

        if path == "/api/categories":
            categories = load_json(cat_file, [])
            self.send_json_response(categories)
            return

        if path == "/api/questions/1st":
            questions = load_json(q1_file, [])
            params = urllib.parse.parse_qs(query_str)
            cat = params.get("category", [None])[0]
            if cat and cat != "all":
                questions = [q for q in questions if q.get("category") == cat]
            self.send_json_response(questions)
            return

        if path == "/api/questions/2nd":
            questions = load_json(q2_file, [])
            self.send_json_response(questions)
            return

        if path == "/api/essay/templates":
            data = load_json(essay_file, {})
            self.send_json_response(data)
            return

        if path == "/api/numbers":
            nums = load_json(num_file, [])
            self.send_json_response(nums)
            return

        if path == "/api/user/state":
            state = load_json(user_file, {
                "history": {},
                "bookmarks": [],
                "essay_draft": {},
                "mastered_numbers": [],
                "exam_records": []
            })
            self.send_json_response(state)
            return

        self.send_json_response({"error": "Not Found"}, status=404)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length)

        try:
            body = json.loads(post_data.decode("utf-8")) if post_data else {}
        except Exception:
            self.send_json_response({"error": "Invalid JSON"}, status=400)
            return

        # ユーザー状態の更新
        if path == "/api/user/state":
            user_file = DATA_DIR / "user_state.json"
            save_json(user_file, body)
            self.send_json_response({"success": True, "message": "学習状態を保存しました"})
            return

        # 経験記述の自動採点・添削
        if path == "/api/essay/check":
            result = self.analyze_essay(body)
            self.send_json_response(result)
            return

        # 新規問題の追加（1次検定）
        if path == "/api/questions/1st":
            q1_file = DATA_DIR / "questions_1st.json"
            questions = load_json(q1_file, [])
            new_id = f"custom-{int(datetime.now().timestamp())}"
            body["id"] = new_id
            questions.append(body)
            save_json(q1_file, questions)
            self.send_json_response({"success": True, "id": new_id, "message": "問題を追加しました"})
            return

        self.send_json_response({"error": "Not Found"}, status=404)

    def analyze_essay(self, data):
        """経験記述のリアルタイム診断ロジック"""
        problem = data.get("problem", "")
        consideration = data.get("consideration", "")
        action = data.get("action", "")
        combined = f"{problem}\n{consideration}\n{action}"

        essay_file = DATA_DIR / "essay_templates.json"
        ref_data = load_json(essay_file, {})
        ng_words = ref_data.get("ng_words", [])

        # 1. NGワードチェック
        found_ng = []
        for ng in ng_words:
            if ng["word"] in combined:
                found_ng.append(ng)

        # 2. 具体的な数値（数字＋単位）が含まれているか
        # 例: 35℃, 90分, 10cm, 5日, 24N/mm2, 2m, 85cm など
        has_numbers = bool(re.search(r'\d+(?:℃|分|日|時間|m|cm|mm|%|N|kg|㎡)', combined))

        # 3. 各項目の文字数チェック（目安: 課題50-120文字、検討100-200文字、措置150-300文字）
        len_p = len(problem.strip())
        len_c = len(consideration.strip())
        len_a = len(action.strip())

        scores = {
            "ng_free": 25 if len(found_ng) == 0 else max(0, 25 - len(found_ng) * 10),
            "numbers": 25 if has_numbers else 10,
            "logic_structure": 25 if (len_p >= 30 and len_c >= 50 and len_a >= 80) else 15,
            "volume": 25 if (80 <= len_p + len_c + len_a <= 800) else 15
        }
        total_score = sum(scores.values())

        # 講評コメント
        feedback = []
        if len(found_ng) > 0:
            words_str = "、".join([f"「{item['word']}」" for item in found_ng])
            feedback.append(f"⚠️ 抽象的表現 {words_str} が見られます。客観的な数値や具体的な作業手順に置き換えましょう。")
        else:
            feedback.append("✅ 抽象的なNG表現はなく、引き締まった記述です。")

        if has_numbers:
            feedback.append("✅ 具体的な管理数値（寸法・時間・温度等）が盛り込まれており、説得力があります。")
        else:
            feedback.append("💡 具体的な数値基準（〇cm以上、〇℃以下、〇時間以内など）を追加するとさらに高得点になります。")

        if len_a < 80:
            feedback.append("💡 「現場で実施した処置・結果」をもう少し具体的に（1.〜 2.〜 などの箇条書き）記述すると加点されます。")
        else:
            feedback.append("✅ 措置と得られた結果の記述量が充実しています。")

        rank = "S (絶対合格圏)" if total_score >= 85 else ("A (合格圏内)" if total_score >= 70 else ("B (あと一歩)" if total_score >= 50 else "C (要改善)"))

        return {
            "score": total_score,
            "rank": rank,
            "scores": scores,
            "char_counts": {
                "problem": len_p,
                "consideration": len_c,
                "action": len_a,
                "total": len_p + len_c + len_a
            },
            "ng_words_found": found_ng,
            "has_numbers": has_numbers,
            "feedback": feedback
        }

def get_local_ip():
    """ローカルWi-Fi IPアドレスを取得"""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        pass
    try:
        import subprocess
        out = subprocess.check_output(["ifconfig"], text=True)
        for line in out.splitlines():
            line = line.strip()
            if line.startswith("inet ") and not line.startswith("inet 127."):
                ip = line.split()[1]
                if ip.startswith("192.168.") or ip.startswith("10.") or ip.startswith("172."):
                    return ip
    except Exception:
        pass
    return "192.168.0.17"

def run_server():
    port = get_free_port(DEFAULT_PORT)
    server_address = ("0.0.0.0", port)
    local_ip = get_local_ip()
    
    # MIMEタイプ登録
    mimes = {
        ".js": "application/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".html": "text/html",
        ".svg": "image/svg+xml",
        ".png": "image/png"
    }
    for ext, m in mimes.items():
        http.server.SimpleHTTPRequestHandler.extensions_map[ext] = m

    with socketserver.TCPServer(server_address, SekouRequestHandler) as httpd:
        print("=" * 64)
        print("  🏗️  2級建築施工管理技士 絶対合格プログラム サーバー起動中")
        print("=" * 64)
        print(f"  PC用ローカル URL : http://localhost:{port}")
        print(f"  スマホ用Wi-Fi URL: http://{local_ip}:{port}")
        print(f"  データ保存先      : {DATA_DIR}")
        print("  [Ctrl + C で停止]")
        print("=" * 64)
        sys.stdout.flush()

        # ポート番号をファイルに保存（run.sh等で参照可能に）
        port_file = BASE_DIR / ".current_port"
        with open(port_file, "w") as f:
            f.write(str(port))

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nサーバーを停止しました。")
            if port_file.exists():
                port_file.unlink()

if __name__ == "__main__":
    run_server()
