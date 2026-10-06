setlocal commentstring=;%s
setlocal comments=:;
setlocal expandtab shiftwidth=4 softtabstop=4
" <C-x><C-o> completes the keywords of the syntax file (in Neovim, ftplugin/kurt.lua replaces it
" by Kurt's language server, if `kurt` is installed)
setlocal omnifunc=syntaxcomplete#Complete
let b:undo_ftplugin = "setlocal commentstring< comments< expandtab< shiftwidth< softtabstop< omnifunc<"
