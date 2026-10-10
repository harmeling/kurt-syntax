#!/usr/bin/env bash
# Resync this extension's keyword coverage with a kurt-lang checkout (default: ../kurt-lang, the
# public repository -- run this after releasing a new kurt-lang, with that checkout updated to the
# new tag) and, if anything the editors need to cover actually changed, bump this extension's own
# version, ready to push.
#
#     scripts/sync-kurt-lang.sh [../kurt-lang]
#
# If nothing changed, there is nothing to publish and the script says so. If something did change
# but `npm run check` still fails, a new keyword needs a human decision about which highlighting
# group it belongs in (syntaxes/kurt.tmLanguage.json, kurt-mode.el, syntax/kurt.vim are
# hand-maintained, not generated) -- fix those by hand, then run this again.
#
# On success: `git push && git push --tags` triggers release.yml, which builds, packages, and
# publishes the new version (Marketplace/Open VSX/GitHub release, each gated as documented there).
set -euo pipefail

lang_dir=${1:-../kurt-lang}
root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"

[ -f "$lang_dir/src/kurt/kurt.py" ] || { echo "no Kurt checkout at $lang_dir"; exit 1; }
if [ -n "$(git status --porcelain)" ]; then
    echo "commit or stash your changes first: this script commits what it generates"; exit 1
fi

export KURT_LANG_PATH
KURT_LANG_PATH=$(cd "$lang_dir" && pwd)
python3 scripts/generate_completions.py

if git diff --quiet -- completions.json; then
    echo "no keyword changes since the last sync; nothing to publish"
    exit 0
fi

npm run check

version=$(cd "$lang_dir" && git describe --tags --always)
git add completions.json
git commit -q -m "Sync with Kurt $version"
npm version patch
echo "Bumped to $(node -p "require('./package.json').version") -- push with: git push && git push --tags"
