#!/bin/bash

# compile the package
vsce package

# install it in vscode
code --install-extension kurt-syntax-0.0.1.vsix
