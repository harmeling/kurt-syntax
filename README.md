# Kurt editor support

Editor support for the [Kurt proof language](https://www.kurt-lang.org), currently aligned with Kurt 0.7. Kurt is developed by Stefan Harmeling (TU Dortmund). In addition to highlighting and symbol replacement, the editors can start `kurt --lsp` for diagnostics, proof reasons, hover, and completion.

## VS Code

Run `npm install`, then `npm run build` or `npm run package`. Install the resulting VSIX, or use **Run Extension** from this repository in VS Code. The extension provides `.kurt` highlighting, snippets, comments, bracket handling, and LaTeX-style symbol replacement such as `\\forall` → `∀`.

Opening a Kurt file starts the language server. The extension looks for the executable in this order:

1. `kurt.server.path`;
2. `.venv/bin/kurt` in a trusted workspace (`.venv\\Scripts\\kurt.exe` on Windows);
3. `kurt` on `PATH`.

The status bar shows whether the server is running and how many Kurt diagnostics are open. The Command Palette has actions to restart the server, check the current file, select an executable, show the Kurt version, and open the server output. Settings control trusted theory paths, strict mode, check-on-type, inlay hints, extra command arguments, and protocol tracing. Settings that change the server restart it automatically.

Install Kurt into a virtual environment with `pip install -e /path/to/kurt-lang`, or install a released package with `pip install kurt-lang`. Kurt 0.7.6 supports the base protocol; the current Kurt development version adds live debounced checks, unsaved dependency buffers, portable Unicode positions, and these initialization settings.

## Emacs

Put `kurt-mode.el` and `replacements.json` in the same directory on your load path, then add `(require 'kurt-mode)` to your configuration. The mode provides highlighting, comments, basic block indentation, and the same symbol replacements. When `kurt` is on `PATH`, the mode registers `kurt --lsp` with the built-in Eglot client and starts it automatically. Set `kurt-enable-eglot` to `nil` to disable that, or customize `kurt-lsp-command` when the executable has another path.

## Vim and Neovim

Use this repository as a plugin, for example with Vim's native packages by cloning it below `~/.vim/pack/plugins/start/kurt-syntax`, or below Neovim's configured plugin directory. Filetype detection, highlighting, comments, and four-space indentation are included.

Neovim 0.8 or newer starts `kurt --lsp` automatically through its built-in client. Set `vim.g.kurt_lsp_enabled = 0` before loading the plugin to disable it. These optional globals configure the client:

```lua
vim.g.kurt_server_path = '/path/to/kurt'
vim.g.kurt_server_extra_args = {}
vim.g.kurt_theory_paths = { '/path/to/trusted/theories' }
vim.g.kurt_strict = false
vim.g.kurt_check_on_type = true
```

Classic Vim continues to use the syntax and filetype support without LSP.

## Troubleshooting

`kurt --version` and `kurt --lsp` must work in the environment launched by the editor. GUI editors often have a different `PATH` from a terminal; select the executable explicitly in VS Code, customize `kurt-lsp-command` in Emacs, or set `vim.g.kurt_server_path` in Neovim. VS Code's **Kurt: Show Server Output** command and `kurt.trace.server` setting show startup and protocol details.

## Keeping pace with Kurt

`python3 scripts/check_editor_support.py` compares all three editor definitions with an adjacent `../kurt-lang` or `../kurt-lang-dev` checkout and fails if a current command is missing. Set `KURT_LANG_PATH` for another location. Run it after changing Kurt's `keywords` dictionary.
