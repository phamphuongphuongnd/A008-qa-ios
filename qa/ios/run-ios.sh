#!/usr/bin/env bash
# A008 iOS QA: one lane = one booted simulator, fresh install, one appearance + Dynamic Type size, the whole Maestro
# suite qa/maestro, then evidence: screenshots (jpg), junit, app log, crash reports and two file checks Maestro
# cannot do (G-05 backup exclusion flag, G-06 files really in "On My iPhone"). Nothing passes unless checked.
# Usage: run-ios.sh <lane> <udid> <appearance light|dark> <content_size> <app_path> <out_root> [flows]
set -u
LANE=$1 UDID=$2 APPEARANCE=$3 CONTENT_SIZE=$4 APP=$5 OUT_ROOT=$6 FLOWS=${7:-}
REPO=$(cd "$(dirname "$0")/../.." && pwd)
SUITE="$REPO/qa/maestro"
BUNDLE=com.maglobal.evenlease
OUT="$OUT_ROOT/$LANE"
TIMEOUT=${LANE_TIMEOUT:-2400}
mkdir -p "$OUT/shots" "$OUT/crash" "$OUT/raw"
log() { echo "[$LANE $(date +%H:%M:%S)] $*"; }

# FLOWS="03,05" → only those numbered flows (+ 01, which installs the sample every later flow needs).
if [ -n "$FLOWS" ]; then
  T="${TMPDIR:-/tmp}/qa-suite-$LANE"
  rm -rf "$T"; cp -R "$SUITE" "$T"
  python3 - "$T" "$FLOWS" <<'PY'
import os, re, sys
d, want = sys.argv[1], ['01'] + [x.strip() for x in sys.argv[2].split(',') if x.strip()]
keep = []
for f in sorted(os.listdir(d)):
    m = re.match(r'^(\d\d)_.*\.yaml$', f)
    if not m:
        continue
    if m.group(1) in want:
        keep.append(f[:-5])
    else:
        os.remove(os.path.join(d, f))
cfg = os.path.join(d, 'config.yaml')
head = open(cfg, encoding='utf-8').read().partition('  flowsOrder:')[0]
open(cfg, 'w', encoding='utf-8').write(head + '  flowsOrder:\n' + ''.join(f'    - {k}\n' for k in keep))
print('targeted suite:', ' '.join(keep))
PY
  SUITE="$T"
fi

xcrun simctl terminate "$UDID" "$BUNDLE" >/dev/null 2>&1
xcrun simctl uninstall "$UDID" "$BUNDLE" >/dev/null 2>&1
xcrun simctl install "$UDID" "$APP" || log "install failed"
xcrun simctl spawn "$UDID" defaults write -g AppleLocale en_US
xcrun simctl spawn "$UDID" defaults write -g AppleLanguages '("en-US")'
xcrun simctl ui "$UDID" appearance "$APPEARANCE"
xcrun simctl ui "$UDID" content_size "$CONTENT_SIZE"

# "On My iPhone" (File Provider local storage): emptied, so the G-06 check below only sees this run's backups.
FP=$(xcrun simctl get_app_container "$UDID" com.apple.FileProvider.LocalStorage groups 2>/dev/null | awk '/group.com.apple.FileProvider.LocalStorage/ {print $2}')
if [ -z "$FP" ]; then
  META=$(grep -l "group.com.apple.FileProvider.LocalStorage" \
    "$HOME/Library/Developer/CoreSimulator/Devices/$UDID/data/Containers/Shared/AppGroup"/*/.com.apple.mobile_container_manager.metadata.plist 2>/dev/null | head -1)
  [ -n "$META" ] && FP=$(dirname "$META")
fi
FPS="${FP:+$FP/File Provider Storage}"
if [ -n "$FPS" ]; then
  mkdir -p "$FPS"
  find "$FPS" -mindepth 1 -maxdepth 1 -exec rm -rf {} + 2>/dev/null
fi
log "appearance=$APPEARANCE size=$CONTENT_SIZE onMyIphone='${FPS:-not found}'"

MARKER="$OUT/raw/.marker"
touch "$MARKER"
LOG_START=$(date '+%Y-%m-%d %H:%M:%S')
T0=$(date +%s)
(
  cd "$OUT/raw" || exit 99
  perl -e 'alarm shift; exec @ARGV' "$TIMEOUT" \
    maestro --device "$UDID" test "$SUITE" \
    --format junit --output "$OUT/junit.xml" --debug-output "$OUT/debug" --test-output-dir "$OUT/maestro-out" \
    -e "LANE=$LANE" > "$OUT/maestro.log" 2>&1
)
CODE=$?
SECS=$(( $(date +%s) - T0 ))
log "maestro exit $CODE after ${SECS}s"

# Screenshots (Maestro writes them to the cwd and its test-output dir) → small jpgs.
find "$OUT/raw" "$OUT/maestro-out" "$OUT/debug" -newer "$MARKER" -name '*.png' 2>/dev/null | while read -r f; do
  base=$(basename "$f" .png)
  sips -s format jpeg -s formatOptions 70 -Z 1400 "$f" --out "$OUT/shots/$base.jpg" >/dev/null 2>&1 && rm -f "$f"
done

# App log + crash reports.
xcrun simctl spawn "$UDID" log show --style compact --start "$LOG_START" \
  --predicate 'process == "Evenlease" AND (messageType == error OR messageType == fault OR subsystem == "com.facebook.react.log")' \
  > "$OUT/app.log" 2>/dev/null || true
find "$HOME/Library/Logs/DiagnosticReports" -newer "$MARKER" \( -name 'Evenlease*' -o -name '*.ips' \) 2>/dev/null \
  | xargs -I{} grep -l "Evenlease" {} 2>/dev/null | xargs -I{} cp {} "$OUT/crash/" 2>/dev/null || true

# G-05: the folders holding applicant data carry the "excluded from backup" flag (TC-198).
DATA=$(xcrun simctl get_app_container "$UDID" "$BUNDLE" data 2>/dev/null)
{
  for d in applicants rentals SQLite; do
    P="$DATA/Documents/$d"
    if [ ! -d "$P" ]; then echo "G05 $d MISSING"; continue; fi
    if xattr -p com.apple.metadata:com_apple_backup_excludeItem "$P" >/dev/null 2>&1; then echo "G05 $d EXCLUDED"; else echo "G05 $d NOT_EXCLUDED"; fi
  done
  ls -la "$DATA/Documents" 2>/dev/null | sed 's/^/  /'
} > "$OUT/g05.txt"

# G-06: backups written into "On My iPhone" (one before the restart, one after it through the bookmark) (TC-199).
{
  if [ -n "$FPS" ]; then
    N=$(find "$FPS" -name 'Evenlease-backup-*.evenlease' 2>/dev/null | wc -l | tr -d ' ')
    echo "G06 backups_in_folder=$N"
    find "$FPS" -name 'Evenlease-backup-*' -exec ls -la {} \; 2>/dev/null | sed 's/^/  /'
  else
    echo "G06 folder_storage_not_found"
  fi
} > "$OUT/g06.txt"

python3 - "$OUT" "$LANE" "$APPEARANCE" "$CONTENT_SIZE" "$SECS" "$CODE" <<'PY'
import json, os, sys, xml.etree.ElementTree as ET
out, lane, app, size, secs, code = sys.argv[1:7]
flows = []
try:
    for tc in ET.parse(os.path.join(out, 'junit.xml')).getroot().iter('testcase'):
        bad = tc.find('failure') if tc.find('failure') is not None else tc.find('error')
        flows.append({'flow': tc.get('name'), 'ok': bad is None, 'secs': tc.get('time'),
                      'why': (bad.get('message') or bad.text or '')[:300] if bad is not None else ''})
except Exception as e:
    flows.append({'flow': 'junit', 'ok': False, 'secs': None, 'why': f'no junit: {e}'})
g05 = open(os.path.join(out, 'g05.txt')).read().split('\n')
g06 = open(os.path.join(out, 'g06.txt')).read().split('\n')
crashes = os.listdir(os.path.join(out, 'crash'))
res = {'lane': lane, 'appearance': app, 'content_size': size, 'seconds': int(secs), 'maestro_exit': int(code),
       'flows': flows, 'g05': [l for l in g05 if l.startswith('G05')], 'g06': [l for l in g06 if l.startswith('G06')],
       'crashes': crashes}
json.dump(res, open(os.path.join(out, 'result.json'), 'w'), indent=1)
print(f'## Lane {lane} ({app}, {size}) — {secs}s, maestro exit {code}')
for f in flows:
    print(f"- {'✅' if f['ok'] else '❌'} {f['flow']} {f['secs'] or ''}s {f['why'][:160]}")
for l in res['g05'] + res['g06']:
    print(f'- {l}')
print(f"- crashes: {len(crashes)}")
PY
exit 0
