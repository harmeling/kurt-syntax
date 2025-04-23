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
            const triggerChar = change.text;

            // Only trigger on single non-alphanumeric characters (e.g., space, punctuation)
            if (!/^[^a-zA-Z0-9]$/.test(triggerChar)) return;

            const doc = event.document;
            const triggerPos = change.range.start;
            const lineText = doc.lineAt(triggerPos.line).text;
            const charIndex = triggerPos.character;

            const textBefore = lineText.substring(0, charIndex);

            // Match last \command before the trigger character
            const match = textBefore.match(/(\\[a-zA-Z]+)$/);
            if (match) {
                const matchedCommand = match[1];
                const replacement = replacements[matchedCommand];

                if (replacement) {
                    const matchStart = charIndex - matchedCommand.length;
                    const matchEnd = charIndex;

                    const startPos = new vscode.Position(triggerPos.line, matchStart);
                    const endPos = new vscode.Position(triggerPos.line, matchEnd);
                    const range = new vscode.Range(startPos, endPos);

                    console.log(`✅ Replacing "${matchedCommand}" with "${replacement}" before "${triggerChar}"`);

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