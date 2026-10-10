# Kurt for VS Code

[Kurt](https://www.kurt-lang.org) is a small language for writing mathematical proofs the way
people write them, with a checker that tells you right away, line by line, whether each step
follows -- made for students learning to prove things. Kurt is developed by Stefan Harmeling (TU
Dortmund).

- each line of a proof is checked as you type, and its reason appears at its end (`; by 3(4)`)
- errors and `todo`s are marked at their lines -- all errors of a file, not only the first
- hover shows the certificate of a line, with links to the lines it uses
- completion knows the state at the cursor: in a proof, its goal; after `load`, the theories
- highlighting, snippets, and LaTeX-style input (`\forall` → `∀`)

**Status: early, not completely tested.** Please report what doesn't work at
<https://github.com/harmeling/kurt-syntax/issues>.

## Install

- In VS Code: open the Extensions view (Cmd+Shift+X, or Ctrl+Shift+X), search for **Kurt**, and
  install "Kurt" by harmeling.
- From the command line: `code --install-extension harmeling.kurt-lang`

Open a `.kurt` file: it is checked right away. Only Python 3.10 or newer has to be installed.

## A first proof

Save this as `first.kurt`:

```
load prop
bool A, B
use A implies B
use A
B
```

The last line gets its reason, `; by 3(4)`: it follows from line 3 with line 4. Delete line 4,
and the last line is marked as an error.

## Which Kurt runs

The extension comes with Kurt (the single file `kurt.py`). An installed Kurt is used first, if
there is one:

1. the setting `kurt.server.path`;
2. `.venv/bin/kurt` in a trusted workspace (`.venv\Scripts\kurt.exe` on Windows);
3. `kurt` on `PATH` (e.g. after `pip install kurt-lang`);
4. else the `kurt.py` that comes with the extension, with `python3` (`py -3` on Windows; the
   setting `kurt.server.python` names another one).

`kurt.server.importStrategy` = `useBundled` takes the extension's own Kurt first. **Kurt: Show
Version** says which Kurt runs.

## Commands and settings

The status bar shows whether Kurt is running and how many errors are open. The Command Palette has
**Kurt:** commands to restart the server, check the current file, select an executable, show the
Kurt version, and open the server output.

Settings: trusted theory paths, strict mode, all errors (`kurt.allErrors`; off: only the first, as
`kurt` on the command line), check-on-type, the reasons (`kurt.inlayHints.enabled`,
`kurt.reasons.column`), extra command arguments, and protocol tracing.

## Troubleshooting

Nothing is checked: run **Kurt: Show Server Output**. If Python isn't found, set
`kurt.server.python`; if an installed `kurt` isn't found (VS Code started from the Dock may have a
different `PATH` than a terminal), use **Kurt: Select Kurt Executable** or set `kurt.server.path`.
