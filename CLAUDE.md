# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A VS Code extension (+ a companion Emacs major mode) that adds editor
support for "Kurt", a custom proof/DSL language (`.kurt` files): syntax
highlighting and inline macro-expansion (typing a backslash command like
`\alpha` followed by a trigger character auto-replaces it with the mapped
text).

## Commands

- Type-check and bundle TypeScript into `out/`: `npm run build`
- Watch/rebundle on change: `npm run watch`
- Package into a `.vsix`: `npm run package` (runs `vsce package`)
- Package + install into local VS Code: `./install.sh`, or
  `npm run package && npm run install`

There is no test suite and no linter configured in this repo.

## Architecture

- `extension/extension.ts` — the entire VS Code extension. It starts the Kurt language server,
  registers its commands/settings/status, loads `replacements.json`, and listens for document text changes; when
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
- `lua/kurt/lsp.lua` and `ftplugin/kurt.vim` start the built-in Neovim LSP client; `kurt-mode.el`
  registers the server with Emacs Eglot.
- `example.kurt` — a sample file in the language, useful as a reference
  when changing the grammar or macro set.
