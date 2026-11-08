# Doubles the space between Chinese characters in the bundled WDXL Lubrifont SC slices:
# each CJK glyph's advance grows by its current gap, and the outline moves right by half of that, so it stays centred.
import os, sys, glob
from fontTools.ttLib import TTFont
SRC, OUT = sys.argv[1], sys.argv[2]
def cjk(cp): return 0x2E80 <= cp <= 0x9FFF or 0x3000 <= cp <= 0x303F or 0xFF00 <= cp <= 0xFFEF or 0x20000 <= cp <= 0x2FFFF or 0xF900 <= cp <= 0xFAFF
total = 0
for path in sorted(glob.glob(os.path.join(SRC, 'wdxl-*.woff2'))):
    f = TTFont(path); glyf, hmtx = f['glyf'], f['hmtx']
    names = {g for cp, g in f.getBestCmap().items() if cjk(cp)}
    for g in names:
        adv, lsb = hmtx[g]; gl = glyf[g]
        if gl.numberOfContours == 0: continue
        gl.recalcBounds(glyf); gap = adv - (gl.xMax - gl.xMin)
        if gap <= 0: continue
        if gl.isComposite():
            for c in gl.components: c.x += gap // 2
        else:
            gl.coordinates.translate((gap // 2, 0))
        gl.recalcBounds(glyf); hmtx[g] = (adv + gap, gl.xMin); total += 1
    f.flavor = 'woff2'; f.save(os.path.join(OUT, os.path.basename(path)))
print('widened', total, 'glyphs')
# TODOPOP: touched 2026-11-08
