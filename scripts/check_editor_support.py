#!/usr/bin/env python3
"""Check that every lightweight editor definition covers Kurt's current commands."""
from __future__ import annotations
import ast, json, re
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
configured = os.environ.get("KURT_LANG_PATH")
candidates = ([Path(configured)] if configured else []) + [ROOT.parent / "kurt-lang", ROOT.parent / "kurt-lang-dev"]
LANG_ROOT = next((path for path in candidates if (path / "src/kurt/kurt.py").is_file()), candidates[0])
LANG = LANG_ROOT / "src" / "kurt" / "kurt.py"
HELPER = {"with"}
CONSTANTS = {"true", "false"}

def language_keywords() -> set[str]:
    tree = ast.parse(LANG.read_text(encoding="utf-8"))
    for node in tree.body:
        if isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name) and node.target.id == "keywords":
            return {key.value for key in node.value.keys if isinstance(key, ast.Constant)}
    raise RuntimeError(f"keywords dictionary not found in {LANG}")

def words(path: Path) -> set[str]:
    return set(re.findall(r"[A-Za-z][A-Za-z0-9_-]*", path.read_text(encoding="utf-8")))

expected = language_keywords() | HELPER | CONSTANTS
files = [ROOT / "syntaxes/kurt.tmLanguage.json", ROOT / "kurt-mode.el", ROOT / "syntax/kurt.vim"]
json.loads(files[0].read_text(encoding="utf-8"))
failures = []
for path in files:
    missing = expected - words(path)
    if missing:
        failures.append(f"{path.relative_to(ROOT)} misses: {', '.join(sorted(missing))}")
# completions.json is generated from kurt-lang (scripts/generate_completions.py): up to date?
import importlib.util
spec = importlib.util.spec_from_file_location("gen", ROOT / "scripts" / "generate_completions.py")
gen = importlib.util.module_from_spec(spec); spec.loader.exec_module(gen)
if json.loads((ROOT / "completions.json").read_text(encoding="utf-8")) != gen.data():
    failures.append("completions.json is out of date: run scripts/generate_completions.py")
if failures:
    raise SystemExit("\n".join(failures))
print(f"editor definitions cover {len(expected)} Kurt words")
