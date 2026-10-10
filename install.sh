#!/bin/bash
# build the extension and install it in VS Code (the same as: npm run package && npm run install-extension)
set -e
npm run package
npm run install-extension
