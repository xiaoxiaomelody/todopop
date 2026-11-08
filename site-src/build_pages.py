"""Builds the three website pages from page.src.html (the single source of truth):
   index.html  - landing: the logo frame, the three key features, Get TODOPOP
   how.html    - how it works: the problem story, focus mode, additional features, privacy
   phone.html  - phone as remote: the pitch, the install + pairing tutorial, the big phone mockup
Edit page.src.html, then run: python3 build_pages.py"""
import re, sys
src = open('page.src.html', encoding='utf-8').read()

def cut(a, b, s=src):
    i = s.index(a); j = s.index(b, i) + len(b); return s[i:j]

head_end = src.index('<main id="top">')
HEAD = src[:head_end]
TAIL = src[src.index('</main>'):]
hero = cut('  <section class="hero"', '</section>\n')
story = cut('  <section id="how" class="story"', '</section>\n')
focus = cut('  <section id="focus"', '</section>\n')
phone = cut('  <section id="phone"', '</section>\n')
download = cut('  <section id="download"', '</section>\n')
privacy = cut('  <section id="privacy"', '</section>\n')
SEP = '  <hr class="sep">\n\n'

# the three key features, as they appear in the story
trio = cut('      <div class="trio feat"', '      </div>\n    </div>\n  </section>', story)
trio = trio[: trio.rindex('    </div>\n  </section>')]  # just the trio block
landing_feats = ('  <section id="features" aria-labelledby="key-title">\n    <div class="wrap">\n'
                 '      <div class="solves rv" style="margin-top:0"><h2 class="pill" id="key-title" data-solid>Key Features</h2></div>\n'
                 + trio + '    </div>\n  </section>\n')

# phone section: additional features stay on "how it works"; the remote pitch, tutorial and mockup go to "phone"
left_open = '      <div class="more-left">\n'
remote_from = '        <h2 class="pill rv over"'
pl = phone.index(left_open) + len(left_open); rf = phone.index(remote_from)
extras = phone[pl:rf]
rest = phone[rf:]
more_section = ('  <section id="more" aria-labelledby="more-title">\n    <div class="wrap more more-solo">\n      <div class="more-left">\n'
                + extras + '      </div>\n    </div>\n  </section>\n')
phone_section = ('  <section id="phone" aria-labelledby="remote-title">\n    <div class="wrap more">\n      <div class="more-left">\n'
                 + rest.replace('<h2 class="pill rv over" style="justify-self:start; margin-top:10px">', '<h2 class="pill rv over" id="remote-title" style="justify-self:start">', 1))

PAGES = {
    'index.html': ('home', [hero, SEP, landing_feats, SEP, download]),
    'how.html': ('how', [story, SEP, focus, SEP, more_section, SEP, privacy]),
    'phone.html': ('phone', [phone_section]),
}
TITLES = {'home': None, 'how': 'How it works · TODOPOP', 'phone': 'Phone app · TODOPOP'}

for fn, (key, parts) in PAGES.items():
    head = HEAD
    # links between pages
    head = head.replace('<a class="logo navlogo" href="#top" aria-label="TODOPOP, back to top">', '<a class="logo navlogo" href="%s" aria-label="TODOPOP, home">' % ('#top' if key == 'home' else './'))
    head = head.replace('<li class="hide-s"><a href="#how">How it works</a></li>', '<li><a href="how.html"%s>How it works</a></li>' % (' aria-current="page"' if key == 'how' else ''))
    head = head.replace('<li class="hide-s"><a href="#phone">Phone</a></li>', '<li><a href="phone.html"%s>Phone</a></li>' % (' aria-current="page"' if key == 'phone' else ''))
    head = head.replace('<a class="get" href="#download">Download</a>', '<a class="get" href="%s">Download</a>' % ('#download' if key == 'home' else './?to=download'))
    head = head.replace('<body>', '<body class="page-%s">' % key, 1)
    if TITLES[key]:
        head = re.sub(r'<title>[^<]*</title>', '<title>%s</title>' % TITLES[key], head, count=1)
    # tell search engines each page's one true address, and what it's about
    url = 'https://todopop.app/' + ('' if key == 'home' else fn)
    head = head.replace('<meta property="og:url" content="https://todopop.app/">', '<meta property="og:url" content="%s">\n<link rel="canonical" href="%s">' % (url, url), 1)
    if key == 'how':
        head = re.sub(r'<meta name="description" content="[^"]*">', '<meta name="description" content="How TODOPOP (To Do Pop) works: every task is a bubble that floats over your screen and grows until you pop it. Focus mode, steps, colors, and privacy.">', head, count=1)
    if key == 'phone':
        head = re.sub(r'<meta name="description" content="[^"]*">', '<meta name="description" content="Use your phone as the remote for TODOPOP (To Do Pop): add, edit and pop tasks from anywhere. iPhone and Android, no account needed.">', head, count=1)
    body = '<main id="top">\n\n' + ''.join(parts) + '\n'
    tail = TAIL.replace('<a href="#download">Download</a>', '<a href="%s">Download</a>' % ('#download' if key == 'home' else './?to=download'))
    tail = tail.replace('<a href="#phone">Phone app</a>', '<a href="how.html">How it works</a>\n      <a href="phone.html">Phone app</a>')
    out = head + body + tail
    # in-page links that now live on another page
    out = out.replace('href="#privacy"', 'href="%s"' % ('#privacy' if key == 'how' else 'how.html#privacy'))
    open(fn, 'w', encoding='utf-8').write(out)
    print('built', fn, len(out))
# TODOPOP: touched 2026-11-08
