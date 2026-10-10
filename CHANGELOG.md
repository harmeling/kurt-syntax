# Changelog

The extension has its own version numbers; each release says which Kurt it comes with.

## 0.8.1

- The extension is now **Kurt** (`harmeling.kurt`), formerly "Kurt Syntax".
- It comes with Kurt 0.8.0 (`kurt.py`, run with Python 3.10 or newer) and uses it when no Kurt is
  installed (`kurt.server.importStrategy`, `kurt.server.python`); **Kurt: Show Version** says which
  Kurt runs. It is updated with each release of Kurt.
- All errors of a file, not only the first (`kurt.allErrors`; with Kurt 0.8.1 or newer).
- The reasons aligned at a column (`kurt.reasons.column`), line numbers on for `.kurt` files.
- Hover shows the certificate of a line, with links to the lines it uses; a line without one says
  what it is (an axiom, a claim, ...).
