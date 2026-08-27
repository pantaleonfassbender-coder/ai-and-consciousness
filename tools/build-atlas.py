# -*- coding: utf-8 -*-
# Build data/atlas.json: a co-occurrence network of the leading content terms
# across ALL indexed Elements. Registry-driven: to add a future volume, add
# one entry to SOURCES and re-run. The output holds derived data only (term
# pairs, counts, anchors) - never text. Sources whose text may not ship in
# this repository are read from LOCAL files next to the repository; the
# script skips them with a warning if the file is absent.
import io, json, re, math, os, sys
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
LOCAL = os.path.dirname(REPO)          # the folder holding the repo checkout

# ---------------------------------------------------------------- sources
def load_schwitzgebel():
    """Derived paragraph units built locally from the reader's own copy
    (see tools/extract notes on the method page); the file stays outside
    the repository because the Element is in copyright."""
    p = os.path.join(LOCAL, 'schwitzgebel-paras.json')
    if not os.path.exists(p):
        print(f'!! skipping schwitzgebel: {p} not found '
              f'(build it locally from your copy first)')
        return None
    units = json.load(io.open(p, encoding='utf-8'))
    return [{'sec': u['sec'], 'p': u['p'], 'txt': u['txt']} for u in units]

def load_welfare():
    d = json.load(io.open(os.path.join(REPO, 'data', 'welfare_text.json'), encoding='utf-8'))
    out = []
    for s in d['sections']:
        for u in s['units']:
            out.append({'sec': s['nr'], 'p': u['p'], 'n': u['n'], 'txt': u['txt']})
    return out

SOURCES = [
    # id            label (short)     color      loader             deep link pattern
    ('schwitzgebel', 'Schwitzgebel',  '#c9a227', load_schwitzgebel, 'concordance'),
    ('welfare',      'Keeling & Street', '#9db8a4', load_welfare,   'welfare'),
    # future volumes: add a loader and a row here, then re-run.
]

STOP = set('''a an the and or but nor for yet so of in on at by to from with without into unto upon
over under above below between among through during before after again further then once here there
when where why how all any both each few more most other some such no not only own same than too
very can will just should now is are was were be been being have has had having do does did doing
would could may might must shall this that these those i you he she it we they them his her its our
their your my me him us who whom which what whose as if because while until although though since
whether either neither also thus hence therefore moreover however indeed rather quite perhaps even
ever never always often sometimes one two three four five first second third much many little less
least own self same viz ie eg etc part parts section sections element elements
say says said saying tell told call called calls calling make makes made making let lets go goes
went gone come comes came take takes taken took give gives given gave get gets got put puts see
sees seen saw seem seems seemed appear appears appeared find finds found know knows known knew
think thinks thought am against about almost along already although always
another any anything anywhere back cannot certain certainly consequently down during else
elsewhere enough every everything everywhere far forth great greater greatest good better best
last latter former like likewise long longer means merely might more most namely near nearly
neither never nevertheless new next none nothing now nowhere off often once only order other
others otherwise ought out over own per rather round several shall should side since small so some
something sometime sometimes somewhat somewhere still such than that the their them themselves
then thence there thereafter thereby therefore therein these they this those through throughout
thus to together too toward towards under until up upon us used using various very via was
way we well were what whatever when whence whenever where whereas whereupon wherever
whither whoever whole whose why within would yet due real thing things fact case cases
respect regard point view manner kind sort ways word instance example true truth false
place places time times form forms subject object present different general particular
proper follow follows following followed itself himself herself themselves oneself
whatever whoever wherein whereby anything nothing might may e.g i.e cf say suppose'''.split())

def toks(txt):
    ws = re.findall(r"[a-zA-Z][a-zA-Z'-]{3,}", txt.lower())
    return [w.strip("'-") for w in ws if len(w.strip("'-")) >= 4 and w.strip("'-") not in STOP]

# ---------------------------------------------------------------- corpus
units, works = [], []
for wid, label, color, loader, link in SOURCES:
    us = loader()
    if us is None:
        continue
    works.append({'id': wid, 'label': label, 'color': color, 'link': link})
    for u in us:
        units.append((wid, u, set(toks(u['txt']))))
print('works:', [w['id'] for w in works], '| units:', len(units))

freq = Counter(); wfreq = defaultdict(Counter)
for wid, u, ts in units:
    for x in ts:
        freq[x] += 1; wfreq[x][wid] += 1

vocab = set(freq)
merged = {x: x[:-1] for x in vocab if x.endswith('s') and not x.endswith('ss') and x[:-1] in vocab}
canon = lambda x: merged.get(x, x)
freq2 = Counter(); wfreq2 = defaultdict(Counter)
for x, c in freq.items(): freq2[canon(x)] += c
for x, wc in wfreq.items():
    for wid, c in wc.items(): wfreq2[canon(x)][wid] += c

def score(x):
    return freq2[x] * (1 + 0.5 * (len(wfreq2[x]) - 1))
top = sorted(freq2, key=score, reverse=True)[:80]
tset = set(top)

co = Counter(); cites = defaultdict(list)
for wid, u, ts in units:
    cts = sorted(set(canon(x) for x in ts) & tset)
    for x in cts:
        mine = [c for c in cites[x] if c[0] == wid]
        # spread citations: at most one per section, three per work
        if len(mine) < 3 and not any(c[1] == u['sec'] for c in mine):
            cites[x].append([wid, u['sec'], u.get('n', u['p']), u['p']])
    for i in range(len(cts)):
        for j in range(i + 1, len(cts)):
            co[(cts[i], cts[j])] += 1

N = len(units)
nodes = []
for x in top:
    wc = wfreq2[x]
    dom = wc.most_common(1)[0][0]
    balanced = len(wc) == len(works) and min(wc.values()) / max(wc.values()) > 0.25
    nodes.append({'id': x, 'f': freq2[x], 'work': dom, 'works': dict(wc),
                  'both': balanced, 'cites': cites[x]})

edges = []
for (a, b), c in co.items():
    if c < 2: continue
    pmi = math.log((c * N) / (freq2[a] * freq2[b]))
    edges.append({'s': a, 't': b, 'c': c, 'w': round(c * max(pmi, 0.05), 2)})
edges.sort(key=lambda e: -e['w'])
edges = edges[:380]

bridges = sorted([n['id'] for n in nodes if n['both']],
                 key=lambda x: -freq2[x])[:14]

out = {'works': works, 'n_units': N, 'nodes': nodes, 'edges': edges, 'bridges': bridges}
json.dump(out, io.open(os.path.join(REPO, 'data', 'atlas.json'), 'w', encoding='utf-8'), ensure_ascii=False)
print('nodes:', len(nodes), '| edges:', len(edges))
print('top12:', [n['id'] for n in nodes[:12]])
print('bridges:', bridges)
