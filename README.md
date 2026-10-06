# Kurt editor support

Editor support for the [Kurt proof language](https://www.kurt-lang.org), currently aligned with Kurt 0.7. Kurt is developed by Stefan Harmeling (TU Dortmund).

## Kurt's language server

With Kurt installed (`pip install kurt-lang`, version 0.7.5 or later), the editors use its language
server, `kurt --lsp`: errors and `todo`s at their lines, the reason of each checked line at its end
(an inlay hint) and on hover, and completion with the state at the cursor -- the next step (`proof`,
the goal, `qed`, `case B`), the value after `=` with `calc on`, LaTeX shortcuts, theories, names. A
file is checked when it is opened and saved. Without it, the completion is static: keywords, the
theories after `load`, the names and labels of the file (`completions.json`).

## VS Code

Run `npm install`, then `npm run build` or `npm run package`. The extension provides `.kurt` highlighting, snippets, comments, bracket handling, and LaTeX-style symbol replacement such as `\\forall` → `∀`, and starts Kurt's language server. The settings `kurt.server.enabled` and `kurt.server.command` (default `["kurt", "--lsp"]`, e.g. `["python3", "/path/to/kurt.py", "--lsp"]`) say whether and how.

## Emacs

Put `kurt-mode.el`, `replacements.json` and `completions.json` in the same directory on your load path, then add `(require 'kurt-mode)` to your configuration. The mode provides highlighting, comments, basic block indentation, the same symbol replacements, and completion (`M-TAB`). `M-x eglot` in a `.kurt` file starts Kurt's language server.

## Vim and Neovim

Use this repository as a plugin, for example with Vim's native packages by cloning it below `~/.vim/pack/plugins/start/kurt-syntax`, or below Neovim's configured plugin directory. Filetype detection, highlighting, comments, four-space indentation, and keyword completion (`<C-x><C-o>`) are included. Neovim starts Kurt's language server by itself if `kurt` is installed (`ftplugin/kurt.lua`; inlay hints with `vim.lsp.inlay_hint.enable()`).

## Keeping pace with Kurt

`python3 scripts/check_editor_support.py` compares all three editor definitions with the adjacent `../kurt-lang` checkout and fails if a current command is missing, or if `completions.json` is out of date (`python3 scripts/generate_completions.py` writes it). Run it after changing Kurt's `keywords` dictionary or its theories.
