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
      "brackets" "arity" "bindop" "flat" "sym" "bool" "alias"))

  (defconst kurt-keywords-second
    '("load", "use" "assume" "let" "show" "def" "proof"
      "qed" "thus" "theorem" "lemma" "proposition" "because"))

  (defconst kurt-keywords-third
    '("contradiction" "true" "false"))

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
                                (file-name-directory (or load-file-name buffer-file-name)))))
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

;; Automatically use kurt-mode for .kurt files
(add-to-list 'auto-mode-alist '("\\.kurt\\'" . kurt-mode))

(provide 'kurt-mode)

;;; kurt-mode.el ends here

