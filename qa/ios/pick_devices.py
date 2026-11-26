"""Pick the newest iOS runtime on the runner and the device types A008 QA wants (small iPhone, Pro Max, iPad).

Prints shell exports: RUNTIME_ID RUNTIME_VER SE_TYPE SE_NAME PM_TYPE PM_NAME IPAD_TYPE IPAD_NAME.
"""
import json
import re
import shlex
import subprocess

rt = json.loads(subprocess.check_output(['xcrun', 'simctl', 'list', 'runtimes', '-j']))['runtimes']
ios = [r for r in rt if r.get('platform') == 'iOS' and r.get('isAvailable')]
ios.sort(key=lambda r: [int(x) for x in re.findall(r'\d+', r['version'])])
import os
import sys
want = os.environ.get('IOS_MAJOR', '').strip()
if want:
    match = [x for x in ios if x['version'].split('.')[0] == want]
    if not match:
        sys.exit(f"no iOS {want} runtime on this runner: {[x['version'] for x in ios]}")
    ios = match
r = ios[-1]
types = [(d['name'], d['identifier']) for d in r.get('supportedDeviceTypes', [])]
if not types:
    dt = json.loads(subprocess.check_output(['xcrun', 'simctl', 'list', 'devicetypes', '-j']))['devicetypes']
    types = [(d['name'], d['identifier']) for d in dt]
names = [n for n, _ in types]


def pick(prefs, pattern):
    for p in prefs:
        if p in names:
            return p
    cands = [n for n in names if re.search(pattern, n)]
    return cands[-1] if cands else ''


se = pick(['iPhone SE (3rd generation)', 'iPhone SE (2nd generation)', 'iPhone 16e', 'iPhone 13 mini'], r'^iPhone (SE|\d+e|\d+ mini)')
pm = pick(['iPhone 16 Pro Max', 'iPhone 17 Pro Max', 'iPhone 15 Pro Max'], r'^iPhone \d+ Pro Max$')
# supportsTablet: the biggest iPad screen (the App Store screenshot size).
ipad = pick(['iPad Pro 13-inch (M5)', 'iPad Pro 13-inch (M4)', 'iPad Air 13-inch (M3)', 'iPad Air 13-inch (M2)',
             'iPad Pro (12.9-inch) (6th generation)', 'iPad (A16)', 'iPad (10th generation)'], r'^iPad.*13')
ident = dict(types)
out = {
    'RUNTIME_ID': r['identifier'], 'RUNTIME_VER': r['version'],
    'SE_NAME': se, 'SE_TYPE': ident.get(se, ''),
    'PM_NAME': pm, 'PM_TYPE': ident.get(pm, ''),
    'IPAD_NAME': ipad, 'IPAD_TYPE': ident.get(ipad, ''),
}
for k, v in out.items():
    print(f'{k}={shlex.quote(v)}')
