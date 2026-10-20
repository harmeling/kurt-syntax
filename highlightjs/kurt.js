/*
 * Kurt for highlight.js (and so for reveal.js, Marp and other tools built on it).
 *
 * In a page:      <script src="kurt.js"></script> after highlight.js -- it registers `kurt` itself.
 * In reveal.js:   Reveal.initialize({ plugins: [RevealMarkdown, RevealHighlight],
 *                   highlight: { beforeHighlight: hljs => hljs.registerLanguage('kurt', hljsDefineKurt) } })
 * With Node:      hljs.registerLanguage('kurt', require('./kurt.js'))
 *
 * The keywords are those of syntaxes/kurt.tmLanguage.json (scripts/check_editor_support.py checks
 * that every keyword of Kurt is here too).
 */
(function () {
  function kurt(hljs) {
    return {
      name: 'Kurt',
      aliases: ['kurt'],
      case_insensitive: false,
      keywords: {
        $pattern: /[A-Za-z][A-Za-z0-9_]*/,
        // declarations
        type: 'var const infix postfix prefix brackets arity bindop chain flat sym bool prop calc alias ' +
              'sort default everything builtin',
        // statements and blocks
        keyword: 'load use assume case show def inline tex lean let pick proof qed with parse tokenize ' +
                 'format summary info syntax theory list help save local sandbox expect cert hint break breakpoint',
        literal: 'contradiction true false',
        built_in: 'todo'
      },
      contains: [
        hljs.COMMENT(';', '$'),
        { scope: 'string', begin: '"', end: '"', illegal: '\\n' },
        // variables: `$x`, `$$x` (polymorphic), `%A` (a statement), with primes
        { scope: 'variable', match: /(\$\$?|%%?)[A-Za-zͰ-Ͽ][A-Za-z0-9]*'*/ },
        { scope: 'number', match: /\b\d+(\.\d+)?\b/ }
      ]
    };
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = kurt;
  } else if (typeof window !== 'undefined') {
    window.hljsDefineKurt = kurt;
    if (window.hljs) window.hljs.registerLanguage('kurt', kurt);
  }
})();
