-- Neovim: Kurt's language server (`kurt --lsp`), if `kurt` is installed -- errors and todos at
-- their lines, the reason of each checked line (inlay hints, `vim.lsp.inlay_hint.enable()`, and
-- K on a line), completion with the state at the cursor (<C-x><C-o>)
if vim.fn.executable('kurt') == 1 and vim.lsp and vim.lsp.start then
  vim.lsp.start({
    name = 'kurt',
    cmd = { 'kurt', '--lsp' },
    root_dir = vim.fs.dirname(vim.api.nvim_buf_get_name(0)),
  })
  vim.bo.omnifunc = 'v:lua.vim.lsp.omnifunc'
end
