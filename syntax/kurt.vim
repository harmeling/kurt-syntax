if exists("b:current_syntax") | finish | endif
syn keyword kurtDeclaration var const infix postfix prefix brackets arity bindop chain flat sym bool calc alias sort builtin
syn keyword kurtProof load save use show def local proof qed todo assume case let pick with sandbox expect break breakpoint
syn keyword kurtInspection help hint parse tokenize format summary syntax theory list cert
syn keyword kurtConstant true false
syn match kurtSchemaVariable /%[[:alnum:]_]\+/
syn match kurtTermVariable /\$[[:alnum:]_]\+/
syn match kurtNumber /\<[0-9]\+\%\(\.[0-9]\+\)\?\>/
syn region kurtString start=/"/ skip=/\\"/ end=/"/
syn match kurtComment /;.*/ contains=@Spell
hi def link kurtDeclaration Keyword
hi def link kurtProof Statement
hi def link kurtInspection Function
hi def link kurtConstant Constant
hi def link kurtSchemaVariable Identifier
hi def link kurtTermVariable Identifier
hi def link kurtNumber Number
hi def link kurtString String
hi def link kurtComment Comment
let b:current_syntax = "kurt"
