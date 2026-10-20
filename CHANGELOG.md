# Changelog

The extension's version is Kurt's, since 0.9.0 (up to 0.8.6 it had its own numbers; each of
those releases says which Kurt it comes with).

## Unreleased

- Fixed: a restart of the server with the Output panel (or a file outside the workspace) active
  skipped the workspace's `.venv` and took `kurt` on PATH -- the first workspace folder counts then.

- "Kurt: Show Version" shows which `kurt.py` runs (from Kurt 0.10 on): its path and its SHA-256, and
  where the extension found it (bundled, `.venv`, `PATH`, the setting). The sync compares the first
  line of `kurt --version` only.

- `highlightjs/kurt.js`: Kurt for highlight.js -- code blocks ```` ```kurt ```` in reveal.js, Marp,
  and web pages (README, "Slides and web pages"); in the keyword check with the grammars.

- For Kurt 0.10: the keyword `prop` (Kurt's `bool` is `prop` from 0.10 on; `bool` stays highlighted
  for files of 0.9), and the first proof of the README with `load propositional` and `prop`.

## 0.9.0 (2026-10-16)

- Comes with Kurt 0.9.0.

- The extension is **Kurt Proof Language**, `harmeling.kurt-lang` (as the Python package
  `kurt-lang`): the VS Code Marketplace keeps the ID and the display name of a removed extension
  for good, and `harmeling.kurt` ("Kurt", uploaded 2026-10-10) was removed by mistake. Nothing
  else changes: the language `kurt`, the settings `kurt.*`, the commands. Uninstall the old
  `harmeling.kurt` (from a `.vsix`), or two servers check each file -- the extension offers to.
  The file of a release is `kurt-lang.vsix` (was `kurt.vsix`).
- The reasons start at a column that fits the file: `kurt.reasons.column` is `"auto"` by default,
  two after the 95th percentile of the widths of the lines with a reason (at least 20; one long
  line doesn't move them); a number is a fixed column, as before (42 is Kurt's own).

## 0.8.3

- The ID is `harmeling.kurt` again (0.8.2 was `harmeling.kurt-lang`: uninstall that one). Until it
  is on the VS Code Marketplace, install `kurt.vsix` from the GitHub release with `code
  --install-extension kurt.vsix`.

## 0.8.2

- The extension's ID is now `harmeling.kurt-lang` (as the Python package `kurt-lang`): the
  Marketplace no longer accepts `harmeling.kurt`. Its name is still **Kurt**, its settings `kurt.*`.
- A new icon: the logo "⊢kurt" (the turnstile: "proves"), in Inconsolata (`scripts/make_icon.py`).
- The Marketplace page is a README for VS Code only (`extension/README.md`).

## 0.8.1

- The extension is now **Kurt** (`harmeling.kurt`), formerly "Kurt Syntax".
- It comes with Kurt 0.8.0 (`kurt.py`, run with Python 3.10 or newer) and uses it when no Kurt is
  installed (`kurt.server.importStrategy`, `kurt.server.python`); **Kurt: Show Version** says which
  Kurt runs. It is updated with each release of Kurt.
- All errors of a file, not only the first (`kurt.allErrors`; with Kurt 0.8.1 or newer).
- The reasons aligned at a column (`kurt.reasons.column`), line numbers on for `.kurt` files.
- Hover shows the certificate of a line, with links to the lines it uses; a line without one says
  what it is (an axiom, a claim, ...).
