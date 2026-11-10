"""產生 App 常用字的粉圓體小包（fonts/jf-openhuninn-app.woff2）。
App 的文字都在這個小包裡，第一次開啟只下載它；家長自己打的罕用字才會自動用到完整版（fonts/jf-openhuninn-2.0.woff2）。
改了畫面文字後重跑：python3 tools/font_subset.py 完整版TTF路徑
（需要 fonttools、brotli：pip install fonttools brotli；完整版 TTF 來自 justfont jf-openhuninn-2.0）"""
import sys, glob, os
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.join(os.path.dirname(__file__), '..')
src = sys.argv[1]
text = ''
for f in ['index.html', 'manifest.webmanifest'] + glob.glob(os.path.join(ROOT, 'js', '*.js')) + glob.glob(os.path.join(ROOT, 'css', '*.css')):
    p = f if os.path.isabs(f) else os.path.join(ROOT, f)
    text += open(p, encoding='utf-8').read()
chars = set(c for c in text if ord(c) > 127)
chars |= set(chr(c) for c in range(0x20, 0x7f)) | set(chr(c) for c in range(0x3000, 0x3040)) | set(chr(c) for c in range(0xff01, 0xff5f))
chars |= set('0123456789一二三四五六七八九十百千萬零點分星天週月年')
opt = subset.Options(); opt.flavor = 'woff2'; opt.layout_features = ['*']; opt.name_IDs = ['*']; opt.name_languages = ['*']; opt.notdef_outline = True
font = TTFont(src)
sub = subset.Subsetter(opt); sub.populate(text=''.join(sorted(chars))); sub.subset(font)
out = os.path.join(ROOT, 'fonts', 'jf-openhuninn-app.woff2')
font.flavor = 'woff2'; font.save(out)
print(len(chars), '字 →', out, os.path.getsize(out) // 1024, 'KB')
