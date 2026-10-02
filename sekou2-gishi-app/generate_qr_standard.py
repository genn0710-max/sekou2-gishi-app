# -*- coding: utf-8 -*-
"""
ISO/IEC 18004 規格完全準拠 QRコード SVG 生成スクリプト (ゼロ依存)
iPhone / Android / 各種リーダーで100%確実に即座に認識される高品質QRコードを出力
"""

import sys

# Galois Field (256) テーブル
GF256_EXP = [0] * 512
GF256_LOG = [0] * 256
x = 1
for i in range(255):
    GF256_EXP[i] = x
    GF256_EXP[i + 255] = x
    GF256_LOG[x] = i
    x <<= 1
    if x & 0x100:
        x ^= 0x11D

def gf_mult(x, y):
    if x == 0 or y == 0:
        return 0
    return GF256_EXP[GF256_LOG[x] + GF256_LOG[y]]

def rs_generator_poly(ec_len):
    poly = [1]
    for i in range(ec_len):
        term = [1, GF256_EXP[i]]
        new_poly = [0] * (len(poly) + len(term) - 1)
        for j in range(len(poly)):
            for k in range(len(term)):
                new_poly[j + k] ^= gf_mult(poly[j], term[k])
        poly = new_poly
    return poly

def rs_encode(data, ec_len):
    gen = rs_generator_poly(ec_len)
    msg = list(data) + [0] * ec_len
    for i in range(len(data)):
        coef = msg[i]
        if coef != 0:
            for j in range(len(gen)):
                msg[i + j] ^= gf_mult(gen[j], coef)
    return msg[len(data):]

# QRコード仕様定数 (Version 3: 29x29, ECC M: 44 data bytes, 26 EC bytes)
# URL: ~40-50文字に適した Version 3-M または Version 4-M
class StandardQR:
    def __init__(self, text, version=4, ec_level='M'):
        self.text = text
        self.version = version
        self.size = 21 + (version - 1) * 4
        self.matrix = [[None] * self.size for _ in range(self.size)]
        self.reserved = [[False] * self.size for _ in range(self.size)]
        
        # Version 4-M 定数:
        # 総コード語数: 100, データコード語数: 64, ECコード語数: 36 (2ブロック: 各18 EC)
        # Version 3-M 定数:
        # 総コード語数: 70, データコード語数: 44, ECコード語数: 26 (1ブロック: 26 EC)
        # Version 2-M:
        # 総コード語数: 44, データコード語数: 28, ECコード語数: 16 (1ブロック: 16 EC)
        
    def generate(self):
        # 1. データエンコード (8-bit Byte Mode)
        raw_bytes = self.text.encode('utf-8')
        
        # 適切なバージョンを自動選定 (ECC M)
        # Version 2-M: 最大 26 bytes
        # Version 3-M: 最大 42 bytes
        # Version 4-M: 最大 62 bytes
        length = len(raw_bytes)
        if length <= 26:
            v = 2
            total_cw, data_cw, ec_cw = 44, 28, 16
            blocks = [(28, 16)]
        elif length <= 42:
            v = 3
            total_cw, data_cw, ec_cw = 70, 44, 26
            blocks = [(44, 26)]
        else:
            v = 4
            total_cw, data_cw, ec_cw = 100, 64, 36
            blocks = [(32, 18), (32, 18)]

        self.version = v
        self.size = 21 + (v - 1) * 4
        self.matrix = [[None] * self.size for _ in range(self.size)]
        self.reserved = [[False] * self.size for _ in range(self.size)]

        # ビットストリーム構築
        bits = []
        # Mode: Byte (0100)
        bits.extend([0, 1, 0, 0])
        # Character Count Indicator (8 bits for v1-9)
        for i in range(7, -1, -1):
            bits.append((length >> i) & 1)
        # Data bits
        for b in raw_bytes:
            for i in range(7, -1, -1):
                bits.append((b >> i) & 1)
        
        # 終端パターン (最大4ビットの0)
        max_data_bits = data_cw * 8
        terminator = min(4, max_data_bits - len(bits))
        bits.extend([0] * terminator)
        
        # 8の倍数にパディング
        while len(bits) % 8 != 0:
            bits.append(0)
            
        # パディングコード語 (0xEC, 0x11)
        pad_bytes = [0xEC, 0x11]
        pad_idx = 0
        while len(bits) < max_data_bits:
            pb = pad_bytes[pad_idx % 2]
            for i in range(7, -1, -1):
                bits.append((pb >> i) & 1)
            pad_idx += 1
            
        # バイト列に変換
        data_bytes = []
        for i in range(0, len(bits), 8):
            val = 0
            for j in range(8):
                val = (val << 1) | bits[i + j]
            data_bytes.append(val)
            
        # 誤り訂正コード計算 (Reed-Solomon)
        data_blocks = []
        ec_blocks = []
        offset = 0
        for d_len, ec_len in blocks:
            d_blk = data_bytes[offset:offset + d_len]
            offset += d_len
            ec_blk = rs_encode(d_blk, ec_len)
            data_blocks.append(d_blk)
            ec_blocks.append(ec_blk)
            
        # インターリーブ
        final_bytes = []
        max_d = max(len(b) for b in data_blocks)
        for i in range(max_d):
            for blk in data_blocks:
                if i < len(blk):
                    final_bytes.append(blk[i])
        max_ec = max(len(b) for b in ec_blocks)
        for i in range(max_ec):
            for blk in ec_blocks:
                if i < len(blk):
                    final_bytes.append(blk[i])

        # 2. 機能パターンの配置
        self._add_finders()
        self._add_alignments()
        self._add_timing()
        self._add_dark_module()
        self._reserve_format_areas()

        # 3. 最適マスクパターンの選定 (Mask 0〜7 を評価しペナルティ最小を選択)
        best_mask = 0
        best_matrix = None
        min_penalty = float('inf')

        for mask_idx in range(8):
            mat = [row[:] for row in self.matrix]
            self._place_data_in_matrix(mat, final_bytes, mask_idx)
            self._apply_format_in_matrix(mat, mask_idx)
            penalty = self._calc_penalty(mat)
            if penalty < min_penalty:
                min_penalty = penalty
                best_mask = mask_idx
                best_matrix = mat

        self.matrix = best_matrix
        return self

    def _set(self, r, c, val):
        self.matrix[r][c] = 1 if val else 0
        self.reserved[r][c] = True

    def _add_finder(self, row, col):
        for r in range(-1, 8):
            for c in range(-1, 8):
                nr, nc = row + r, col + c
                if 0 <= nr < self.size and 0 <= nc < self.size:
                    if (0 <= r <= 6 and (c in (0, 6))) or (0 <= c <= 6 and (r in (0, 6))) or (2 <= r <= 4 and 2 <= c <= 4):
                        self._set(nr, nc, 1)
                    else:
                        self._set(nr, nc, 0)

    def _add_finders(self):
        self._add_finder(0, 0)
        self._add_finder(0, self.size - 7)
        self._add_finder(self.size - 7, 0)

    def _add_timing(self):
        for i in range(8, self.size - 8):
            if not self.reserved[6][i]:
                self._set(6, i, 1 if i % 2 == 0 else 0)
            if not self.reserved[i][6]:
                self._set(i, 6, 1 if i % 2 == 0 else 0)

    def _add_alignments(self):
        if self.version < 2:
            return
        align_pos = {
            2: [6, 18],
            3: [6, 22],
            4: [6, 26]
        }.get(self.version, [6, 26])
        
        for r in align_pos:
            for c in align_pos:
                if (r < 9 and c < 9) or (r < 9 and c >= self.size - 8) or (r >= self.size - 8 and c < 9):
                    continue
                for dr in range(-2, 3):
                    for dc in range(-2, 3):
                        val = 1 if (abs(dr) == 2 or abs(dc) == 2 or (dr == 0 and dc == 0)) else 0
                        self._set(r + dr, c + dc, val)

    def _add_dark_module(self):
        self._set(4 * self.version + 9, 8, 1)

    def _reserve_format_areas(self):
        for i in range(9):
            self.reserved[8][i] = True
            self.reserved[i][8] = True
        for i in range(8):
            self.reserved[8][self.size - 1 - i] = True
            self.reserved[self.size - 1 - i][8] = True

    def _apply_format_in_matrix(self, mat, mask):
        # ECC M (00) + mask (3 bits) = 5 bits format data
        # BCH code (15, 5) Generator: 0x537, Mask: 0x5412
        fmt_data = (0 << 3) | mask
        rem = fmt_data << 10
        for i in range(4, -1, -1):
            if rem & (1 << (i + 10)):
                rem ^= 0x537 << i
        fmt_code = ((fmt_data << 10) | rem) ^ 0x5412
        
        bits = [(fmt_code >> i) & 1 for i in range(14, -1, -1)]
        
        # 左上
        pos1 = [(8, 0), (8, 1), (8, 2), (8, 3), (8, 4), (8, 5), (8, 7), (8, 8),
                (7, 8), (5, 8), (4, 8), (3, 8), (2, 8), (1, 8), (0, 8)]
        for (r, c), b in zip(pos1, bits):
            mat[r][c] = b
            
        # 右上・左下
        pos2 = [(self.size - 1, 8), (self.size - 2, 8), (self.size - 3, 8), (self.size - 4, 8),
                (self.size - 5, 8), (self.size - 6, 8), (self.size - 7, 8)]
        pos3 = [(8, self.size - 8), (8, self.size - 7), (8, self.size - 6), (8, self.size - 5),
                (8, self.size - 4), (8, self.size - 3), (8, self.size - 2), (8, self.size - 1)]
        for (r, c), b in zip(pos2 + pos3, bits):
            mat[r][c] = b

    def _mask_cond(self, r, c, mask):
        if mask == 0: return (r + c) % 2 == 0
        if mask == 1: return r % 2 == 0
        if mask == 2: return c % 3 == 0
        if mask == 3: return (r + c) % 3 == 0
        if mask == 4: return (r // 2 + c // 3) % 2 == 0
        if mask == 5: return ((r * c) % 2) + ((r * c) % 3) == 0
        if mask == 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 == 0
        if mask == 7: return (((r + c) % 2) + ((r * c) % 3)) % 2 == 0
        return False

    def _place_data_in_matrix(self, mat, final_bytes, mask):
        bit_idx = 0
        total_bits = len(final_bytes) * 8
        c = self.size - 1
        upward = True
        
        while c > 0:
            if c == 6: # タイミングパターン列をスキップ
                c -= 1
            col_pair = [c, c - 1]
            rows = range(self.size - 1, -1, -1) if upward else range(self.size)
            for r in rows:
                for col in col_pair:
                    if not self.reserved[r][col]:
                        bit = (final_bytes[bit_idx // 8] >> (7 - (bit_idx % 8))) & 1 if bit_idx < total_bits else 0
                        bit_idx += 1
                        if self._mask_cond(r, col, mask):
                            bit ^= 1
                        mat[r][col] = bit
            upward = not upward
            c -= 2

    def _calc_penalty(self, mat):
        penalty = 0
        n = self.size
        # N1: 同色5個以上の連続 (行・列)
        for r in range(n):
            cnt = 1
            for c in range(1, n):
                if mat[r][c] == mat[r][c - 1]:
                    cnt += 1
                else:
                    if cnt >= 5: penalty += 3 + (cnt - 5)
                    cnt = 1
            if cnt >= 5: penalty += 3 + (cnt - 5)

        for c in range(n):
            cnt = 1
            for r in range(1, n):
                if mat[r][c] == mat[r - 1][c]:
                    cnt += 1
                else:
                    if cnt >= 5: penalty += 3 + (cnt - 5)
                    cnt = 1
            if cnt >= 5: penalty += 3 + (cnt - 5)

        # N2: 2x2同色ブロック
        for r in range(n - 1):
            for c in range(n - 1):
                if mat[r][c] == mat[r + 1][c] == mat[r][c + 1] == mat[r + 1][c + 1]:
                    penalty += 3

        # N3: 1:1:3:1:1 パターン
        pattern = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0]
        r_pattern = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1]
        for r in range(n):
            for c in range(n - 10):
                sub = mat[r][c:c + 11]
                if sub == pattern or sub == r_pattern:
                    penalty += 40
        for c in range(n):
            for r in range(n - 10):
                sub = [mat[r + k][c] for k in range(11)]
                if sub == pattern or sub == r_pattern:
                    penalty += 40

        # N4: 全体の暗黒比率 (50%からの乖離)
        dark_cnt = sum(sum(row) for row in mat)
        pct = (dark_cnt * 100) // (n * n)
        k = abs(pct - 50) // 5
        penalty += k * 10
        return penalty

    def to_svg(self, scale=8, quiet_zone=4):
        total_dim = self.size + quiet_zone * 2
        px_size = total_dim * scale
        
        rects = []
        for r in range(self.size):
            for c in range(self.size):
                if self.matrix[r][c] == 1:
                    x = (c + quiet_zone) * scale
                    y = (r + quiet_zone) * scale
                    rects.append(f'<rect x="{x}" y="{y}" width="{scale}" height="{scale}" fill="#000000" />')
                    
        svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {px_size} {px_size}" width="{px_size}" height="{px_size}">
  <rect width="100%" height="100%" fill="#ffffff" rx="16" />
  {''.join(rects)}
</svg>'''
        return svg_content

# 生成実行
if __name__ == '__main__':
    # 1. GitHub Pages用
    gh_url = "https://genn0710-max.github.io/sekou2-gishi-app/"
    qr_gh = StandardQR(gh_url).generate()
    with open("qrcode.svg", "w", encoding="utf-8") as f:
        f.write(qr_gh.to_svg(scale=8, quiet_zone=4))
    print(f"Generated qrcode.svg for {gh_url} (Version {qr_gh.version}, {qr_gh.size}x{qr_gh.size})")

    # 2. 現在のWi-Fi用 (192.168.0.17)
    wifi_url = "http://192.168.0.17:8766/"
    qr_wifi = StandardQR(wifi_url).generate()
    with open("qrcode_wifi.svg", "w", encoding="utf-8") as f:
        f.write(qr_wifi.to_svg(scale=8, quiet_zone=4))
    print(f"Generated qrcode_wifi.svg for {wifi_url} (Version {qr_wifi.version}, {qr_wifi.size}x{qr_wifi.size})")
