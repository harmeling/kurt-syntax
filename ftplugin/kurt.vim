setlocal commentstring=;%s
setlocal comments=:;
setlocal expandtab shiftwidth=4 softtabstop=4
if get(g:, 'kurt_line_numbers', 1)
  setlocal number
endif
let b:undo_ftplugin = "setlocal commentstring< comments< expandtab< shiftwidth< softtabstop< number<"

if has('nvim') && get(g:, 'kurt_lsp_enabled', 1)
  lua require('kurt.lsp').start()
endif
