import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('Kurt extension activated!');

    const disposable = vscode.workspace.onDidChangeTextDocument(event => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || event.document !== editor.document) return;

        const changes = event.contentChanges;
        if (changes.length === 0) return;

        const change = changes[0];

        if (change.text !== ' ') return;

        const position = change.range.end;
        const lineText = event.document.lineAt(position.line).text;
        const beforeCursor = lineText.substring(0, position.character - 1);

        console.log('Typed space. Before cursor:', beforeCursor);

        if (beforeCursor.endsWith('\\not')) {
            const startPos = position.translate(0, -5); // \not + space
            const range = new vscode.Range(startPos, position);

            console.log('Replacing \\not with ¬');

            setTimeout(() => {
                editor.edit(editBuilder => {
                    editBuilder.replace(range, '¬');
                });
            }, 0);
        }
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}