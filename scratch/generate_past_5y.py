#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
過去5年分（令和6年〜令和2年：計200問）データ統合・バリデーション・JSON出力スクリプト
"""

import json
import os
import sys

# scratch内の年度別モジュールをインポート
from questions_r06 import QUESTIONS_R06
from questions_r05 import QUESTIONS_R05
from questions_r04 import QUESTIONS_R04
from questions_r03 import QUESTIONS_R03
from questions_r02 import QUESTIONS_R02

YEAR_MODULES = [
    ("R06", "令和6年度", QUESTIONS_R06),
    ("R05", "令和5年度", QUESTIONS_R05),
    ("R04", "令和4年度", QUESTIONS_R04),
    ("R03", "令和3年度", QUESTIONS_R03),
    ("R02", "令和2年度", QUESTIONS_R02),
]

def main():
    all_questions = []
    seen_ids = set()
    total_tekitou = 0
    total_futekitou = 0
    answer_dist = {0: 0, 1: 0, 2: 0, 3: 0}

    print("========================================")
    print("【2級建築施工管理技士 第1次検定】過去5年分問題統合")
    print("========================================")

    for code, year_name, questions in YEAR_MODULES:
        print(f"\n▶ {year_name} ({code}): {len(questions)}問 検証中...")
        if len(questions) != 40:
            print(f"❌ エラー: {year_name} の問題数が40問ではありません（現在 {len(questions)}問）")
            sys.exit(1)

        year_tekitou = 0
        year_futekitou = 0

        for i, q in enumerate(questions):
            q_id = q.get("id")
            if not q_id:
                print(f"❌ エラー: IDがありません（{year_name} 問{i+1}）")
                sys.exit(1)
            if q_id in seen_ids:
                print(f"❌ エラー: 重複ID {q_id}")
                sys.exit(1)
            seen_ids.add(q_id)

            options = q.get("options", [])
            if len(options) != 4:
                print(f"❌ エラー: {q_id} の選択肢が4肢ではありません（{len(options)}肢）")
                sys.exit(1)

            for opt_idx, opt in enumerate(options):
                if not opt or len(opt.strip()) < 5:
                    print(f"❌ エラー: {q_id} 選択肢{opt_idx+1} が空または短すぎます: '{opt}'")
                    sys.exit(1)

            ans = q.get("answer")
            if ans not in (0, 1, 2, 3):
                print(f"❌ エラー: {q_id} の解答番号が無効です: {ans}")
                sys.exit(1)
            answer_dist[ans] += 1

            expl = q.get("explanation", "")
            if not expl or len(expl.strip()) < 30:
                print(f"❌ エラー: {q_id} の解説が短すぎます")
                sys.exit(1)

            q_text = q.get("question", "")
            if "適当なもの" in q_text and "不適当" not in q_text:
                year_tekitou += 1
                total_tekitou += 1
            else:
                year_futekitou += 1
                total_futekitou += 1

            all_questions.append(q)

        print(f"   ✓ 完了: 40問正常 （適当: {year_tekitou}問 / 不適当等: {year_futekitou}問）")

    print("\n----------------------------------------")
    print(f"合計出題数: {len(all_questions)}問")
    print(f"解答選択肢分布: 1番:{answer_dist[0]}問, 2番:{answer_dist[1]}問, 3番:{answer_dist[2]}問, 4番:{answer_dist[3]}問")
    print(f"設問種別比率: 適当={total_tekitou}問 ({total_tekitou/len(all_questions)*100:.1f}%), 不適当={total_futekitou}問 ({total_futekitou/len(all_questions)*100:.1f}%)")
    print("----------------------------------------")

    # JSON出力
    output_path = os.path.join(os.path.dirname(__file__), "..", "data", "questions_past5y.json")
    output_path = os.path.abspath(output_path)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_questions, f, ensure_ascii=False, indent=2)

    print(f"✅ 保存完了: {output_path} ({os.path.getsize(output_path) / 1024:.1f} KB)")

if __name__ == "__main__":
    main()
