# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A VS Code extension (+ a companion Emacs major mode) that adds editor
support for "Kurt", a custom proof/DSL language (`.kurt` files): syntax
highlighting and inline macro-expansion (typing a backslash command like
`\alpha` followed by a trigger character auto-replaces it with the mapped
text).

## Commands

- Build (TypeScript → `out/`): `npm run build`
- Watch/rebuild on change: `npm run watch`
- Package into a `.vsix`: `npm run package` (runs `vsce package`)
- Package + install into local VS Code: `./install.sh`, or
  `npm run package && npm run install`

There is no test suite and no linter configured in this repo.

## Architecture

- `extension/extension.ts` — the entire VS Code extension. On activation
  it loads `replacements.json` and listens for document text changes; when
  a `\word` sequence is immediately followed by a non-alphanumeric trigger
  character (space, newline, or punctuation), it replaces `\word` with the
  mapped string from `replacements.json`.
- `replacements.json` — the shared macro dictionary (`\command` →
  replacement text). Both `extension/extension.ts` (VS Code) and
  `kurt-mode.el` (Emacs) load this same file at runtime, so it's the
  single source of truth for macro expansion across both editors — update
  it once, not per-editor.
- `kurt-mode.el` — an independent Emacs major mode implementation for the
  same language: syntax highlighting via its own keyword groups plus the
  same `replacements.json`-driven expansion behavior as the VS Code side.
- `syntaxes/kurt.tmLanguage.json` + `language-configuration.json` — the
  TextMate grammar and language config that give VS Code syntax
  highlighting for `.kurt` files; wired up via the `contributes` section
  of `package.json`.
- `package.json` `contributes.snippets` points at
  `snippets/kurt-snippets.json`, which does not currently exist in the
  repo — packaging/loading that references snippets will need that file
  added or the reference removed.
- `example.kurt` — a sample file in the language, useful as a reference
  when changing the grammar or macro set.
