# Kurt for VS Code, Emacs and Vim

Editor support for [Kurt](https://www.kurt-lang.org), a small language for writing mathematical
proofs the way people write them, with a checker that tells you right away, line by line, whether
each step follows -- made for students learning to prove things. Kurt is developed by Stefan
Harmeling (TU Dortmund).

- each line of a proof is checked as you type, and its reason appears at its end (`; by 3(4)`)
- errors and `todo`s are marked at their lines -- all errors of a file, not only the first
- hover shows the certificate of a line, with links to the lines it uses
- completion knows the state at the cursor: in a proof, its goal; after `load`, the theories
- highlighting, snippets, and LaTeX-style input (`\forall` → `∀`)

**Status: early, not completely tested.** The VS Code extension has been tried on macOS, Emacs
(Eglot) and Neovim (0.10 or newer) briefly; expect rough edges, and please report what doesn't
work at <https://github.com/harmeling/kurt-syntax/issues>.

## VS Code

Install **Kurt** (`harmeling.kurt`) from the Extensions view, or download `kurt.vsix` from the
[latest release](https://github.com/harmeling/kurt-syntax/releases/latest) and install it with
`code --install-extension kurt.vsix`. Open a `.kurt` file: it is checked right away.

**Which Kurt runs.** The extension comes with Kurt (the single file `kurt.py`, run with Python 3.10
or newer -- only Python has to be installed). An installed Kurt is used first, if there is one:

1. the setting `kurt.server.path`;
2. `.venv/bin/kurt` in a trusted workspace (`.venv\Scripts\kurt.exe` on Windows);
3. `kurt` on `PATH` (e.g. after `pip install kurt-lang`);
4. else the `kurt.py` that comes with the extension, with `python3` (`py -3` on Windows; the
   setting `kurt.server.python` names another one).

`kurt.server.importStrategy` = `useBundled` takes the extension's own Kurt first. **Kurt: Show
Version** says which Kurt runs. The extension is updated with each release of Kurt.

The status bar shows whether the server is running and how many Kurt diagnostics are open. The
Command Palette has actions to restart the server, check the current file, select an executable,
show the Kurt version, and open the server output. Settings control trusted theory paths, strict
mode, all errors (`kurt.allErrors`; off: only the first, as `kurt` on the command line),
check-on-type, the reasons (`kurt.inlayHints.enabled`, `kurt.reasons.column`), extra command
arguments, and protocol tracing. Settings that change the server restart it automatically.

To build it yourself: `npm install`, then `npm run package`.

## Emacs

Put `kurt-mode.el` and `replacements.json` in the same directory on your load path, then add `(require 'kurt-mode)` to your configuration. The mode provides highlighting, comments, basic block indentation, and the same symbol replacements. When `kurt` is on `PATH`, the mode registers `kurt --lsp` with the built-in Eglot client and starts it automatically. Set `kurt-enable-eglot` to `nil` to disable that, or customize `kurt-lsp-command` when the executable has another path. Line numbers are on, since the reasons refer to lines by number; set `kurt-line-numbers` to `nil` to turn them off.

## Vim and Neovim

Use this repository as a plugin, for example with Vim's native packages by cloning it below `~/.vim/pack/plugins/start/kurt-syntax`, or below Neovim's configured plugin directory. Filetype detection, highlighting, comments, and four-space indentation are included.

Neovim 0.8 or newer starts `kurt --lsp` automatically through its built-in client. Set `vim.g.kurt_lsp_enabled = 0` before loading the plugin to disable it. These optional globals configure the client:

```lua
vim.g.kurt_server_path = '/path/to/kurt'
vim.g.kurt_server_extra_args = {}
vim.g.kurt_theory_paths = { '/path/to/trusted/theories' }
vim.g.kurt_strict = false
vim.g.kurt_check_on_type = true
vim.g.kurt_inlay_hints = true   -- the reasons at the ends of the lines
vim.g.kurt_all_errors = true    -- all errors of a file, not only the first
vim.g.kurt_line_numbers = 1     -- (also in Vim)
```

The reasons appear as inlay hints (Neovim 0.10 or newer), `K` on a line shows its reason with its certificate, and `<C-x><C-o>` completes with the state at the cursor (in a proof: its goal).

Classic Vim continues to use the syntax and filetype support without LSP.

## Troubleshooting

`kurt --version` and `kurt --lsp` must work in the environment launched by the editor. GUI editors often have a different `PATH` from a terminal; select the executable explicitly in VS Code, customize `kurt-lsp-command` in Emacs, or set `vim.g.kurt_server_path` in Neovim. VS Code's **Kurt: Show Server Output** command and `kurt.trace.server` setting show startup and protocol details.

## Keeping pace with Kurt

Every day, and on its "Run workflow" button (Actions, **Sync with Kurt**), the workflow `sync.yml`
looks for a newer release of Kurt. If there is one, `scripts/sync-kurt-lang.sh` takes its keywords
and its `kurt.py` from the public repository at that release, checks them (`npm run check`, the
build, the bundled Kurt checks a proof), and makes a new version of the extension, which
`release.yml` releases (a GitHub release with `kurt.vsix`; the VS Code Marketplace and Open VSX
once switched on). If a check fails -- a new keyword that the hand-written grammars
(`syntaxes/kurt.tmLanguage.json`, `kurt-mode.el`, `syntax/kurt.vim`) don't cover yet -- nothing is
released and GitHub sends an email; fix them, then press the button. The extension has its own
version numbers.

`python3 scripts/check_editor_support.py` compares all three editor definitions with a Kurt
checkout (`KURT_LANG_PATH`, else `../kurt-lang` or `../kurt-lang-dev`) and fails if a current
command is missing.
