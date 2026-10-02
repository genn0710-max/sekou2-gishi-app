# -*- coding: utf-8 -*-
"""
Python標準ライブラリ (zlib) のみでQRコードから高精細PNG画像を生成
外部ライブラリゼロ・どんな端末でも即座にカメラ認識
"""

import zlib
import struct
from generate_qr_standard import StandardQR

def generate_png_qr(text, output_path, scale=12, quiet_zone=4):
    qr = StandardQR(text).generate()
    size = qr.size
    total_dim = size + quiet_zone * 2
    img_size = total_dim * scale

    # ピクセルバッファ (RGB: 3 bytes per pixel)
    # PNG raw scanlines: each line starts with filter byte 0
    raw_scanlines = bytearray()
    
    white = b'\xFF\xFF\xFF'
    black = b'\x00\x00\x00'

    for y in range(img_size):
        raw_scanlines.append(0) # filter type: None
        r = (y // scale) - quiet_zone
        for x in range(img_size):
            c = (x // scale) - quiet_zone
            if 0 <= r < size and 0 <= c < size and qr.matrix[r][c] == 1:
                raw_scanlines.extend(black)
            else:
                raw_scanlines.extend(white)

    # IHDR chunk
    ihdr_data = struct.pack(">IIBBBBB", img_size, img_size, 8, 2, 0, 0, 0)
    ihdr_crc = zlib.crc32(b"IHDR" + ihdr_data)
    ihdr = struct.pack(">I", len(ihdr_data)) + b"IHDR" + ihdr_data + struct.pack(">I", ihdr_crc)

    # IDAT chunk
    compressed_data = zlib.compress(bytes(raw_scanlines), 9)
    idat_crc = zlib.crc32(b"IDAT" + compressed_data)
    idat = struct.pack(">I", len(compressed_data)) + b"IDAT" + compressed_data + struct.pack(">I", idat_crc)

    # IEND chunk
    iend_crc = zlib.crc32(b"IEND")
    iend = struct.pack(">I", 0) + b"IEND" + struct.pack(">I", iend_crc)

    png_bytes = b"\x89PNG\r\n\x1a\n" + ihdr + idat + iend

    with open(output_path, "wb") as f:
        f.write(png_bytes)

    print(f"Generated PNG: {output_path} ({img_size}x{img_size} px)")

if __name__ == '__main__':
    url = "https://genn0710-max.github.io/sekou2-gishi-app/"
    generate_png_qr(url, "qrcode_github.png", scale=10, quiet_zone=4)
    # アーティファクト用ディレクトリにもコピー
    art_path = "/Users/suzukikantoku/.gemini/antigravity/brain/e8b49a6a-5de8-4c5f-a2d9-1a3b54208b72/qrcode_github.png"
    generate_png_qr(url, art_path, scale=10, quiet_zone=4)
