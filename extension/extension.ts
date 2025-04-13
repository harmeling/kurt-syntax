import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.workspace.onDidChangeTextDocument(event => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || event.document !== editor.document) return;

        const changes = event.contentChanges;
        if (changes.length === 0) return;

        const lastChange = changes[0];
        const text = lastChange.text;

        if (text.endsWith('\\not')) {
            const start = lastChange.range.start;
            const end = lastChange.range.end;
            const range = new vscode.Range(
                new vscode.Position(start.line, start.character - 4),
                end
            );

            editor.edit(editBuilder => {
                editBuilder.replace(range, '¬');
            });
        }
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}