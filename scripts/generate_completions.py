#!/usr/bin/env python3
"""Write completions.json -- Kurt's keywords and the theories that come with it, for the editors'
completion without a language server -- from the kurt-lang checkout next to this repository."""
from __future__ import annotations
import ast, json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LANG = ROOT.parent / "kurt-lang" / "src" / "kurt"

def data() -> dict:
    tree = ast.parse((LANG / "kurt.py").read_text(encoding="utf-8"))
    keywords = next(sorted(k.value for k in node.value.keys if isinstance(k, ast.Constant))
                    for node in tree.body if isinstance(node, ast.AnnAssign) and getattr(node.target, "id", "") == "keywords")
    theories = sorted(p.stem for p in (LANG / "theories").glob("*.kurt") if p.stem != "minimal")
    return {"keywords": keywords + ["with"], "theories": theories}

if __name__ == "__main__":
    (ROOT / "completions.json").write_text(json.dumps(data(), indent=1) + "\n", encoding="utf-8")
    print(f"wrote completions.json ({len(data()['keywords'])} keywords, {len(data()['theories'])} theories)")
