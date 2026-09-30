#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
外部ライブラリゼロ・Python標準ライブラリのみでQRコードSVGを生成するスクリプト
"""
import sys
import urllib.parse
from pathlib import Path

# 軽量QRコード生成クラス（Byte Mode, Reed-Solomon誤り訂正）
class SimpleQRCode:
    def __init__(self, data, version=4, error_correction='M'):
        self.data = data.encode('utf-8')
        self.version = version
        self.size = 21 + (version - 1) * 4
        self.matrix = [[None] * self.size for _ in range(self.size)]
        self.reserved = [[False] * self.size for _ in range(self.size)]
        self.ecc = error_correction

    def build(self):
        self._add_finders()
        self._add_alignment_patterns()
        self._add_timing_patterns()
        self._add_dark_module()
        self._add_format_info(mask_pattern=0)
        self._place_data(mask_pattern=0)
        return self

    def _set(self, r, c, val, reserved=True):
        self.matrix[r][c] = 1 if val else 0
        if reserved:
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

    def _add_timing_patterns(self):
        for i in range(8, self.size - 8):
            val = 1 if i % 2 == 0 else 0
            if not self.reserved[6][i]:
                self._set(6, i, val)
            if not self.reserved[i][6]:
                self._set(i, 6, val)

    def _add_alignment_patterns(self):
        if self.version < 2:
            return
        positions = [6, 26] if self.version == 4 else [6, 22]
        for r in positions:
            for c in positions:
                if (r < 9 and c < 9) or (r < 9 and c >= self.size - 8) or (r >= self.size - 8 and c < 9):
                    continue
                for dr in range(-2, 3):
                    for dc in range(-2, 3):
                        val = 1 if (abs(dr) == 2 or abs(dc) == 2 or (dr == 0 and dc == 0)) else 0
                        self._set(r + dr, c + dc, val)

    def _add_dark_module(self):
        self._set(4 * self.version + 9, 8, 1)

    def _add_format_info(self, mask_pattern=0):
        # Format bits for M-0: 101010000010010 (bch(15, 5))
        format_bits = 0x5412 ^ 0x5412 # sample mask 0
        # standard format bits for ECC M + Mask 0 is 0x5412 ^ format
        # For simplicity, calculate 15-bit format:
        # Precomputed format info for (ECC M, Mask 0) = 101010000010010
        bits = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0]
        # Top-left
        coords1 = [(8, 0), (8, 1), (8, 2), (8, 3), (8, 4), (8, 5), (8, 7), (8, 8), (7, 8), (5, 8), (4, 8), (3, 8), (2, 8), (1, 8), (0, 8)]
        for (r, c), b in zip(coords1, bits):
            self._set(r, c, b)
        # Top-right / bottom-left
        coords2 = [(self.size - 1, 8), (self.size - 2, 8), (self.size - 3, 8), (self.size - 4, 8), (self.size - 5, 8), (self.size - 6, 8), (self.size - 7, 8)]
        coords3 = [(8, self.size - 8), (8, self.size - 7), (8, self.size - 6), (8, self.size - 5), (8, self.size - 4), (8, self.size - 3), (8, self.size - 2), (8, self.size - 1)]
        for (r, c), b in zip(coords2 + coords3, bits):
            self._set(r, c, b)

    def _gf_mult(self, x, y):
        if x == 0 or y == 0: return 0
        p = 0
        for _ in range(8):
            if y & 1: p ^= x
            hi = x & 0x80
            x = (x << 1) & 0xFF
            if hi: x ^= 0x11D # primitive polynomial x^8 + x^4 + x^3 + x^2 + 1
            y >>= 1
        return p

    def _rs_encode(self, data_bytes, ecc_len=18):
        # Generator polynomial for ecc_len
        gen = [1]
        root = 1
        for i in range(ecc_len):
            # multiply gen by (x - root)
            next_gen = [0] * (len(gen) + 1)
            for j in range(len(gen)):
                next_gen[j] ^= self._gf_mult(gen[j], root)
                next_gen[j + 1] ^= gen[j]
            gen = next_gen
            root = self._gf_mult(root, 2)
        
        remainder = [0] * ecc_len
        for b in data_bytes:
            factor = b ^ remainder[0]
            remainder = remainder[1:] + [0]
            for j in range(ecc_len):
                remainder[j] ^= self._gf_mult(gen[len(gen) - 2 - j], factor)
        return remainder

    def _place_data(self, mask_pattern=0):
        # Version 4-M total data codewords = 64 bytes (80 total - 16 ecc * 2 blocks, or single block)
        # For simplicity, standard QR packing:
        bits = []
        # Mode: 0100 (Byte mode)
        bits += [0, 1, 0, 0]
        # Char count (8 bits for Version 1-9)
        length = len(self.data)
        for i in range(7, -1, -1):
            bits.append((length >> i) & 1)
        # Data
        for byte in self.data:
            for i in range(7, -1, -1):
                bits.append((byte >> i) & 1)
        # Terminator (up to 4 zeros)
        bits += [0, 0, 0, 0]
        # Pad to byte
        while len(bits) % 8 != 0:
            bits.append(0)
        
        # Convert to bytes
        codewords = []
        for i in range(0, len(bits), 8):
            byte_val = 0
            for b in bits[i:i+8]:
                byte_val = (byte_val << 1) | b
            codewords.append(byte_val)

        # Pad bytes 0xEC, 0x11
        # Version 4-M has 64 data codewords
        target_cw = 64 if self.version == 4 else 44
        pads = [0xEC, 0x11]
        p_idx = 0
        while len(codewords) < target_cw:
            codewords.append(pads[p_idx % 2])
            p_idx += 1

        # RS Error correction (Version 4-M has 2 blocks of 32 data cw, 18 ecc cw each -> total 100 cw)
        # For our 45-byte string, we encode block 1 (32 cw) and block 2 (32 cw)
        b1 = codewords[:32]
        b2 = codewords[32:64]
        ecc1 = self._rs_encode(b1, 18)
        ecc2 = self._rs_encode(b2, 18)

        # Interleave codewords
        interleaved = []
        for i in range(32):
            interleaved.append(b1[i])
            interleaved.append(b2[i])
        for i in range(18):
            interleaved.append(ecc1[i])
            interleaved.append(ecc2[i])

        # Interleaved to bits
        all_bits = []
        for cw in interleaved:
            for i in range(7, -1, -1):
                all_bits.append((cw >> i) & 1)
        # Add remainder bits for v4 (7 remainder bits)
        all_bits += [0] * 7

        # Place bits in zigzag
        bit_idx = 0
        row = self.size - 1
        col = self.size - 1
        direction = -1

        while col > 0:
            if col == 6:
                col -= 1
            for _ in range(self.size):
                for c_off in (0, -1):
                    c = col + c_off
                    if not self.reserved[row][c]:
                        val = all_bits[bit_idx] if bit_idx < len(all_bits) else 0
                        # Mask 0: (row + col) % 2 == 0
                        if (row + c) % 2 == 0:
                            val ^= 1
                        self.matrix[row][c] = val
                        bit_idx += 1
                row += direction
            direction = -direction
            row += direction
            col -= 2

    def to_svg(self, scale=8, margin=4):
        total_dim = (self.size + margin * 2) * scale
        svg = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {total_dim} {total_dim}" width="{total_dim}" height="{total_dim}">']
        svg.append(f'<rect width="{total_dim}" height="{total_dim}" fill="#ffffff"/>')
        svg.append('<path d="')
        path_parts = []
        for r in range(self.size):
            for c in range(self.size):
                if self.matrix[r][c] == 1:
                    x = (c + margin) * scale
                    y = (r + margin) * scale
                    path_parts.append(f'M{x},{y}h{scale}v{scale}h-{scale}z')
        svg.append(' '.join(path_parts))
        svg.append('" fill="#0f172a"/>')
        svg.append('</svg>')
        return '\n'.join(svg)

if __name__ == '__main__':
    url = sys.argv[1] if len(sys.argv) > 1 else 'https://genn0710-max.github.io/sekou2-gishi-app/'
    out_path = Path(sys.argv[2]) if len(sys.argv) > 2 else Path('qrcode.svg')
    qr = SimpleQRCode(url, version=4, error_correction='M').build()
    svg_data = qr.to_svg()
    out_path.write_text(svg_data, encoding='utf-8')
    print(f'Generated QR Code SVG ({out_path}) for URL: {url}')
