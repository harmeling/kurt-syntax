#!/usr/bin/env bash
# Bring the extension up to a released Kurt: its keyword lists (completions.json) and the bundled
# kurt.py, both from the public repository harmeling/kurt-lang at the release's tag -- never from a
# local checkout (which may be ahead of the release). If anything changed, check it, raise the
# extension's own version, commit, and tag it; pushing the tag (and main) releases the extension
# (release.yml). The workflow sync.yml runs this every day and on its "Run workflow" button.
#
#     scripts/sync-kurt-lang.sh            # the latest release of Kurt
#     scripts/sync-kurt-lang.sh v0.8.1     # a given one
#
# Nothing changed: it says so, and does nothing. A check fails (e.g. a new keyword that the
# hand-written grammars -- syntaxes/kurt.tmLanguage.json, kurt-mode.el, syntax/kurt.vim -- don't
# cover yet): it stops before committing; fix those by hand, then run it again.
set -euo pipefail

repo=harmeling/kurt-lang
root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"

if [ -n "$(git status --porcelain)" ]; then
    echo "commit or stash your changes first: this script commits what it generates"; exit 1
fi

tag=${1:-}
if [ -z "$tag" ]; then
    tag=$(curl -fsSL "https://api.github.com/repos/$repo/releases/latest" | python3 -c "import json, sys; print(json.load(sys.stdin)['tag_name'])")
fi
echo "Kurt $tag"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
git -c advice.detachedHead=false clone -q --depth 1 --branch "$tag" "https://github.com/$repo.git" "$tmp/kurt-lang"
curl -fsSL -o "$tmp/kurt.py" "https://github.com/$repo/releases/download/$tag/kurt.py"

# the keywords and the bundled Kurt of that release
export KURT_LANG_PATH="$tmp/kurt-lang"
python3 scripts/generate_completions.py
mkdir -p bundled
cp "$tmp/kurt.py" bundled/kurt.py

if git diff --quiet -- completions.json bundled/kurt.py && git ls-files --error-unmatch bundled/kurt.py >/dev/null 2>&1; then
    echo "already at Kurt $tag; nothing to do"
    exit 0
fi

# the checks: the editors cover its keywords, the extension builds, the bundled Kurt is that
# release and checks a proof
npm run check
npm run build
[ "$(python3 bundled/kurt.py --version)" = "kurt ${tag#v}" ] || { echo "bundled/kurt.py is not Kurt ${tag#v}"; exit 1; }
printf 'load prop\nbool A, B\nuse A implies B\nuse A\nB\n' > "$tmp/check.kurt"
(cd "$tmp" && python3 "$root/bundled/kurt.py" --no-kurtc check.kurt | grep -q 'Proof checked')
rm -rf bundled/__pycache__

# a new version of the extension (its own numbers: the patch number goes up)
npm version patch --no-git-tag-version >/dev/null
version=$(node -p "require('./package.json').version")
git add completions.json bundled/kurt.py package.json package-lock.json
git commit -q -m "Kurt $tag: the extension $version (keywords and the bundled kurt.py)"
git tag "v$version"
echo "v$version: push with  git push origin HEAD:main v$version"
if [ -n "${GITHUB_OUTPUT:-}" ]; then echo "tag=v$version" >> "$GITHUB_OUTPUT"; fi
