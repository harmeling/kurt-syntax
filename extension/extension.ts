import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

let replacements: Record<string, string> = {};

export function activate(context: vscode.ExtensionContext) {
    console.log('🔥 Kurt extension activated');

    // Load replacements.json
    const replacementsPath = path.join(context.extensionPath, 'replacements.json');
    try {
        const jsonContent = fs.readFileSync(replacementsPath, 'utf8');
        replacements = JSON.parse(jsonContent);
        console.log('✅ Loaded replacements:', replacements);
    } catch (err) {
        console.error('❌ Failed to load replacements.json:', err);
        replacements = {};
    }

    const disposable = vscode.workspace.onDidChangeTextDocument(event => {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor || event.document !== editor.document) return;

            const changes = event.contentChanges;
            if (changes.length === 0) return;

            const change = changes[0];
            if (change.text !== ' ' && change.text !== '\n') return;

            const doc = event.document;
            const spacePos = change.range.start;
            const lineText = doc.lineAt(spacePos.line).text;
            const charIndex = spacePos.character;

            const textBefore = lineText.substring(0, charIndex);

            // Match last \command before space
            const match = textBefore.match(/(\\[a-zA-Z]+)$/);

            if (match) {
                const matchedCommand = match[1];
                const replacement = replacements[matchedCommand];

                if (replacement) {
                    // Check if cursor is exactly after the command — i.e., the space is not separating a following word
                    const matchStart = charIndex - matchedCommand.length;
                    const matchEnd = charIndex;

                    // But ALSO include the space in the range
                    const startPos = new vscode.Position(spacePos.line, matchStart);
                    const endPos = new vscode.Position(spacePos.line, matchEnd + 1); // include the space that was typed
                    const range = new vscode.Range(startPos, endPos);

                    console.log(`✅ Replacing "${matchedCommand} " with "${replacement}"`);

                    setTimeout(() => {
                        editor.edit(editBuilder => {
                            editBuilder.replace(range, replacement);
                        }).then(success => {
                            if (!success) {
                                console.error('❌ Edit failed');
                            } else {
                                console.log('✅ Replacement succeeded');
                            }
                        });
                    }, 0);
                }
            }
        } catch (err) {
            console.error('❌ Extension error:', err);
        }
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}