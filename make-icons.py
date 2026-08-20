#!/usr/bin/env python3
"""
Render every app icon straight from the pixel grid.

Written by hand rather than exported from the SVG because the icon IS a
grid of squares: any SVG rasteriser antialiases the cell edges, which is
exactly the softness pixel art must not have. Nearest-neighbour from the
source grid keeps every edge hard at every size.

Emits truecolour PNGs with NO alpha channel. Apple rejects an app icon
that carries one, even when every pixel in it is fully opaque.
"""
import zlib, struct

COOL  = (0x0e,0x1c,0x22)   # cool zone behind the controller
WARM  = (0x22,0x15,0x08)   # warm zone behind the food
SLASH = (0xe6,0xf7,0xff)
PAL = {'C':(0x00,0xff,0xf2), 'K':(0x0a,0x0e,0x14), 'A':(0xff,0xb0,0x00),
       'L':(0xff,0xd1,0x66), 'G':(0x39,0xff,0x88), 'O':(0xff,0x8c,0x1a)}

PAD = [".CCCCCCCCC.","CCCCCCCCCCC","CCCKCCCCKCC","CCKKKCCCCCC",
       "CCCKCCCCCKC","CCC.....CCC","CC.......CC"]
BURGER = ["...AAAA...",".AALAAALA.","AAAAAAAAAA","AAAAAAAAAA",
          "GGGGGGGGGG","OOOOOOOOOO","AAAAAAAAAA",".AAAAAAAA."]

def grid(N, off=0):
    """Cell colours for an N-wide board, artwork inset by `off` cells."""
    g = {}
    diag = N - 1
    for r in range(N):
        for c in range(N):
            s = r + c
            g[(r,c)] = SLASH if s == diag else (COOL if s < diag else WARM)
    for r,row in enumerate(PAD):
        for c,ch in enumerate(row):
            if ch != '.': g[(r+2+off, c+0+off)] = PAL[ch]
    for r,row in enumerate(BURGER):
        for c,ch in enumerate(row):
            if ch != '.': g[(r+10+off, c+9+off)] = PAL[ch]
    return g

def write_png(path, size, N, off=0):
    g = grid(N, off)
    rows = bytearray()
    for y in range(size):
        rows.append(0)                       # filter type 0 for the scanline
        r = y * N // size
        for x in range(size):
            rows += bytes(g[(r, x * N // size)])
    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff)
    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
           + chunk(b"IDAT", zlib.compress(bytes(rows), 9))
           + chunk(b"IEND", b""))
    open(path, "wb").write(png)
    return len(png)

if __name__ == "__main__":
    for size, path in [(1024, "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"),
                       (512,  "app-icons/icon-512.png"),
                       (192,  "app-icons/icon-192.png"),
                       (180,  "app-icons/icon-180.png")]:
        n = write_png(path, size, 20)
        print("%-70s %6d bytes" % (path, n))
    # Android maskable: same pattern on a wider board so the mask crops padding
    n = write_png("app-icons/icon-512-maskable.png", 512, 28, off=4)
    print("%-70s %6d bytes" % ("app-icons/icon-512-maskable.png", n))
