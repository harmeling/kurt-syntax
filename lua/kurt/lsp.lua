-- Neovim: Kurt's language server (`kurt --lsp`) -- errors and todos at their lines, the reason of
-- each checked line (inlay hints; K shows it with its certificate), completion with the state at
-- the cursor (<C-x><C-o>)
local M = {}

function M.start()
  if not vim.lsp or not vim.lsp.start then
    vim.notify('Kurt LSP requires Neovim 0.8 or newer', vim.log.levels.WARN)
    return
  end
  local command = vim.g.kurt_server_path or 'kurt'
  if vim.fn.executable(command) ~= 1 then
    return                                  -- (no `kurt`: highlighting only)
  end
  local cmd = { command }
  for _, argument in ipairs(vim.g.kurt_server_extra_args or {}) do
    table.insert(cmd, argument)
  end
  table.insert(cmd, '--lsp')
  local filename = vim.api.nvim_buf_get_name(0)
  local directory = filename ~= '' and vim.fs.dirname(filename) or vim.fn.getcwd()
  local root = vim.fs.root and vim.fs.root(0, { '.git' }) or directory
  local buffer = vim.api.nvim_get_current_buf()
  vim.lsp.start({
    name = 'kurt',
    cmd = cmd,
    root_dir = root,
    init_options = {
      theoryPaths = vim.g.kurt_theory_paths or {},
      strict = vim.g.kurt_strict == true,
      checkOnType = vim.g.kurt_check_on_type ~= false,
    },
    on_attach = function(_, bufnr)
      if vim.g.kurt_inlay_hints ~= false and vim.lsp.inlay_hint then
        -- (the signature changed in Neovim 0.10)
        if not pcall(vim.lsp.inlay_hint.enable, true, { bufnr = bufnr }) then
          pcall(vim.lsp.inlay_hint.enable, bufnr, true)
        end
      end
    end,
  })
  vim.bo[buffer].omnifunc = 'v:lua.vim.lsp.omnifunc'
end

return M
