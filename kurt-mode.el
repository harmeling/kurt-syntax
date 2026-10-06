;;; kurt-mode.el --- Minimal major mode for Kurt -*- lexical-binding: t -*-
(require 'json)
(require 'subr-x) ;; for when-let

(define-derived-mode kurt-mode prog-mode "Kurt"
  "A minimal major mode for the Kurt language."
  ;; Comment syntax
  (setq-local comment-start ";")
  (setq-local comment-end "")

  ;; Define keyword groups
  (defconst kurt-keywords-first
    '("var" "const" "infix" "postfix" "prefix"
      "brackets" "arity" "bindop" "chain" "flat" "sym" "bool" "calc" "alias"))

  (defconst kurt-keywords-second
    '("load" "save" "use" "assume" "case" "let" "pick" "with" "show" "def" "local" "proof"
      "qed" "todo" "sandbox" "expect" "break"))

  (defconst kurt-keywords-third
    '("help" "hint" "verbose" "parse" "tokenize" "format" "level" "mode" "context" "trail" "syntax" "theory" "cert" "breakpoint" "true" "false"))

  ;; Font-lock (syntax highlighting), could use font-lock-{keyword,builtin,constant}-face
  (setq-local font-lock-defaults
              `((

                 ;; First group — keyword face
                 (,(regexp-opt kurt-keywords-first 'words) . font-lock-keyword-face)

                 ;; Second group — builtin face
                 (,(regexp-opt kurt-keywords-second 'words) . font-lock-keyword-face)

                 ;; Third group — constant face
                 (,(regexp-opt kurt-keywords-third 'words) . font-lock-constant-face)

                 ;; Strings
                 ("\"[^\"]*\"" . font-lock-string-face)

                 ;; Comments
                 (";.*$" . font-lock-comment-face)
                 ))))

(defvar kurt-replacements (make-hash-table :test #'equal)
  "Table of replacement strings like \\R → ℝ.")

(defun kurt-load-replacements ()
  "Load replacements from replacements.json."
  (let ((file (expand-file-name "replacements.json"
                                kurt-mode-directory)))
    (when (file-exists-p file)
      (let* ((json-object-type 'hash-table)
             (json (json-read-file file)))
        (setq kurt-replacements json)
        (message "✅ Loaded replacements from %s" file)))))

(defun kurt-check-and-replace ()
  "Check for \\command before point and replace it if in replacements.
Works when the user types a space or newline right after the command."
  (when (and (eq major-mode 'kurt-mode)
             (member last-command-event '(?\s ?\n)))
    (let* ((pos (point))
           (start-search (max (point-min) (- pos 50)))
           (text-before (buffer-substring-no-properties start-search pos)))
      (when (string-match "\\(\\\\[a-zA-Z]+\\)[ \n]*$" text-before)
        (let* ((match (match-string 1 text-before))
               (replacement (gethash match kurt-replacements)))
          (when replacement
            (let* ((full-match (match-string 0 text-before))
                   (start (- pos (length full-match)))
                   (end pos)
                   (trailing last-command-event))
              (delete-region start end)
              (goto-char start)
              (insert replacement)
              (when (eq trailing ?\n)
                (insert "\n"))
              (goto-char (+ start (length replacement)
                            (if (eq trailing ?\n) 1 0))))))))))

(add-hook 'kurt-mode-hook #'kurt-load-replacements)
(add-hook 'post-self-insert-hook #'kurt-check-and-replace)

;; Completion without the language server (`completion-at-point', M-TAB): keywords, the theories
;; after `load', and the names and labels of this buffer; the lists are in completions.json,
;; generated from kurt-lang
(defvar kurt-completions nil "Keywords and theories, from completions.json.")

(defun kurt-load-completions ()
  (let ((file (expand-file-name "completions.json"
                                (file-name-directory (or load-file-name (locate-library "kurt-mode"))))))
    (when (file-readable-p file)
      (setq kurt-completions (json-read-file file)))))

(defun kurt-completion-at-point ()
  "Complete a keyword, a theory after `load', or a name or label of this buffer."
  (let* ((end (point))
         (start (save-excursion (skip-chars-backward "^ \t\n()[]{},=\"") (point)))
         (line (buffer-substring-no-properties (line-beginning-position) end))
         (keywords (append (alist-get 'keywords kurt-completions) nil))
         (theories (append (alist-get 'theories kurt-completions) nil))
         (names '()))
    (save-excursion
      (goto-char (point-min))
      (while (re-search-forward "^\\s-*\\(?:const\\|var\\|bool\\|def\\|arity\\|let\\|pick\\)\\s-+\\([^;\n]+\\)" nil t)
        (dolist (name (split-string (match-string 1) "[ ,=]+" t))
          (when (string-match-p "\\`[$%]?[A-Za-z][A-Za-z0-9]*\\'" name) (push name names))))
      (goto-char (point-min))
      (while (re-search-forward "\"\\([^\"\n]+\\)\"" nil t) (push (match-string 1) names)))
    (list start end (if (string-match-p "\\`\\s-*load\\b" line) theories (append keywords names)))))

(add-hook 'kurt-mode-hook
          (lambda ()
            (unless kurt-completions (kurt-load-completions))
            (add-hook 'completion-at-point-functions #'kurt-completion-at-point nil t)))

;; Kurt's language server (`kurt --lsp'): `M-x eglot' in a .kurt file starts it -- errors and
;; todos at their lines, the reason of each checked line, completion with the state at the cursor
(with-eval-after-load 'eglot
  (add-to-list 'eglot-server-programs '(kurt-mode . ("kurt" "--lsp"))))

;; Automatically use kurt-mode for .kurt files
(add-to-list 'auto-mode-alist '("\\.kurt\\'" . kurt-mode))

(provide 'kurt-mode)

;;; kurt-mode.el ends here

