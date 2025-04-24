import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

let replacements: Record<string, string> = {};

export function activate(context: vscode.ExtensionContext) {
    console.log('🔥 Kurt extension activated');

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

            // Ignore if it's not a single non-alphanumeric character
            if (triggerChar.length !== 1 && triggerChar !== '\n') return;
            if (/^[a-zA-Z0-9]$/.test(triggerChar)) return;

            const doc = event.document;
            const triggerPos = change.range.start;
            const lineText = doc.lineAt(triggerPos.line).text;
            const charIndex = triggerPos.character;

            const textBefore = lineText.substring(0, charIndex);

            const match = textBefore.match(/(\\[a-zA-Z]+)$/);
            if (match) {
                const matchedCommand = match[1];
                const replacement = replacements[matchedCommand];

                if (replacement) {
                    const matchStart = charIndex - matchedCommand.length;
                    const startPos = new vscode.Position(triggerPos.line, matchStart);
                    let endPos: vscode.Position;

                    if (triggerChar === ' ') {
                        // Remove the space
                        endPos = new vscode.Position(triggerPos.line, charIndex + 1);
                    } else if (triggerChar === '\n') {
                        // Remove the newline
                        endPos = new vscode.Position(triggerPos.line + 1, 0);
                    } else {
                        // Keep punctuation etc.
                        endPos = new vscode.Position(triggerPos.line, charIndex);
                    }

                    const range = new vscode.Range(startPos, endPos);
                    const shouldKeepTrigger = triggerChar !== ' ' && triggerChar !== '\n' && triggerChar !== '\\';
                    const finalText = replacement + (shouldKeepTrigger ? triggerChar : '');

                    console.log(`✅ Replacing "${matchedCommand}" triggered by "${triggerChar === '\n' ? '\\n' : triggerChar}" with "${finalText}"`);

                    setTimeout(() => {
                        editor.edit(editBuilder => {
                            editBuilder.replace(range, finalText);
                        }).then(success => {
                            if (!success) {
                                console.error('❌ Edit failed');
                            } else if (triggerChar === '\n') {
                                // Manually insert newline after replacement
                                editor.insertSnippet(new vscode.SnippetString('\n'), editor.selection.active);
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