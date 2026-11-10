#!/usr/bin/env python3
"""Builds the GitHub Pages mirror of the Data Digger pages.
Usage: python3 tools/mksite.py <repo dir> loc=<path to league-ledger.html> titan=<path to titan.html> flex=<path to flex-luger.html> sunday=<path to sunday-funday.html> bush=<path to bush-league.html> espn=<path to kickers.html>
Leagues not given keep their current page. Icons already in each league folder are reused."""
import sys, os, re, json
from PIL import Image
repo = sys.argv[1]; pages = dict(a.split('=', 1) for a in sys.argv[2:])
L = [('loc', 'League of Champions', 'LoC', 'WTZJGmufRPd1RruVQu4ByT', '#0a1328'),
     ('titan', 'League of Titans', 'Titans', 'PWjJ2KP8RePM6nPUWGuvHf', '#1e060b'),
     ('flex', 'Flex Luger', 'Flex Luger', 'R7cj6ms1gn4vt9cyqJw6RD', '#0a2f4d'),
     ('sunday', 'Sunday Funday', 'Sunday', 'KD4S6bUavosUigMXTsuPup', '#ff4f6a'),
     ('bush', 'bush league all stars', 'Bush League', 'Ebrij3Rnpr1nM1mSkzAS2T', '#1d3b1f'),
     ('espn', 'year of the kickers', 'Kickers', 'ArXJSLBMnPB1cQ3d7Ks8dm', '#1b1446')]
for key, name, shortname, aid, theme in L:
    d = os.path.join(repo, key); os.makedirs(d, exist_ok=True)
    src = os.path.join(d, 'icon-512.png')
    if os.path.exists(src) and not os.path.exists(os.path.join(d, 'icon-180.png')):
        im = Image.open(src).convert('RGB')
        for s in (180, 192): im.resize((s, s), Image.LANCZOS).save(f'{d}/icon-{s}.png')
        im.resize((64, 64), Image.LANCZOS).save(f'{d}/favicon.png')
    json.dump({'name': f'{name} Data Digger', 'short_name': shortname, 'start_url': './', 'scope': './', 'display': 'standalone',
               'background_color': theme, 'theme_color': theme,
               'icons': [{'src': 'icon-192.png', 'sizes': '192x192', 'type': 'image/png'}, {'src': 'icon-512.png', 'sizes': '512x512', 'type': 'image/png'}]},
              open(f'{d}/manifest.webmanifest', 'w'), indent=1)
    if key not in pages: continue
    body = open(pages[key], encoding='utf-8').read()
    for k2, _, _, aid2, _ in L:  # crossover links point at the mirror siblings
        body = body.replace(f'https://claude.ai/artifact/{aid2}', f'../{k2}/')
    m = re.match(r'\s*(<title>[^<]*</title>)', body); title = m.group(1) if m else ''
    if m: body = body[m.end():]
    head = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8">{title}
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<link rel="apple-touch-icon" href="icon-180.png"><link rel="icon" type="image/png" href="favicon.png"><link rel="manifest" href="manifest.webmanifest">
<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="{shortname}"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="theme-color" content="{theme}"><meta name="robots" content="noindex">
<style>:root{{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}}body{{margin:0;font:14px system-ui,-apple-system,sans-serif}}img{{max-width:100%}}[hidden]{{display:none!important}}</style>
</head><body>
'''
    open(f'{d}/index.html', 'w', encoding='utf-8').write(head + body + '\n</body></html>\n')
links = ''.join(f'<a href="{k}/"><img src="{k}/icon-180.png" alt=""><span>{n}</span></a>' for k, n, *_ in L)
open(f'{repo}/index.html', 'w').write(f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Data Digger</title><meta name="robots" content="noindex">
<style>:root{{--bg:#e9edf2;--ink:#14213d;--card:#f8fafc}}@media (prefers-color-scheme:dark){{:root{{--bg:#0d1424;--ink:#e6ebf4;--card:#151f35;color-scheme:dark}}}}
body{{margin:0;background:var(--bg);color:var(--ink);font:16px system-ui,-apple-system,sans-serif;padding:48px max(16px,env(safe-area-inset-left,0px))}}h1{{text-align:center;font-weight:800}}
nav{{display:grid;gap:14px;max-width:420px;margin:0 auto}}a{{display:flex;align-items:center;gap:16px;background:var(--card);color:inherit;text-decoration:none;padding:12px;border-radius:16px;font-weight:700;font-size:18px}}a img{{width:64px;height:64px;border-radius:14px}}</style>
</head><body><h1>Data Digger</h1><nav>{links}</nav></body></html>''')
open(f'{repo}/.nojekyll', 'w').write('')
print('ok')
