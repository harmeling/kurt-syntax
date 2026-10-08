local M = {}

function M.start()
  if not vim.lsp or not vim.lsp.start then
    vim.notify('Kurt LSP requires Neovim 0.8 or newer', vim.log.levels.WARN)
    return
  end
  local command = vim.g.kurt_server_path or 'kurt'
  local cmd = { command }
  for _, argument in ipairs(vim.g.kurt_server_extra_args or {}) do
    table.insert(cmd, argument)
  end
  table.insert(cmd, '--lsp')
  local filename = vim.api.nvim_buf_get_name(0)
  local directory = filename ~= '' and vim.fs.dirname(filename) or vim.fn.getcwd()
  local root = vim.fs.root(0, { '.git' }) or directory
  vim.lsp.start({
    name = 'kurt',
    cmd = cmd,
    root_dir = root,
    init_options = {
      theoryPaths = vim.g.kurt_theory_paths or {},
      strict = vim.g.kurt_strict == true,
      checkOnType = vim.g.kurt_check_on_type ~= false,
    },
  })
end

return M
