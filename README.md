# Kurt editor support

Editor support for the [Kurt proof language](https://www.kurt-lang.org), currently aligned with Kurt 0.7. Kurt is developed by Stefan Harmeling (TU Dortmund University).

## VS Code

Run `npm install`, then `npm run build` or `npm run package`. The extension provides `.kurt` highlighting, snippets, comments, bracket handling, and LaTeX-style symbol replacement such as `\\forall` → `∀`.

## Emacs

Put `kurt-mode.el` and `replacements.json` in the same directory on your load path, then add `(require 'kurt-mode)` to your configuration. The mode provides highlighting, comments, basic block indentation, and the same symbol replacements.

## Vim and Neovim

Use this repository as a plugin, for example with Vim's native packages by cloning it below `~/.vim/pack/plugins/start/kurt-syntax`, or below Neovim's configured plugin directory. Filetype detection, highlighting, comments, and four-space indentation are included.

## Keeping pace with Kurt

`python3 scripts/check_editor_support.py` compares all three editor definitions with the adjacent `../kurt-lang` checkout and fails if a current command is missing. Run it after changing Kurt's `keywords` dictionary.
