import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { LanguageClient, LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node';

let replacements: Record<string, string> = {};
let client: LanguageClient | undefined;

// Kurt's language server (`kurt --lsp`): errors and todos at their lines, the reason of each checked
// line (an inlay hint and on hover), completion with the state at the cursor. Without it (Kurt not
// installed, or switched off), the static completion below: keywords, theories, the names here.
async function startServer(context: vscode.ExtensionContext): Promise<boolean> {
    const config = vscode.workspace.getConfiguration('kurt.server');
    if (!config.get<boolean>('enabled', true)) return false;
    const [command, ...args] = config.get<string[]>('command', ['kurt', '--lsp']);
    const serverOptions: ServerOptions = { command, args };
    const clientOptions: LanguageClientOptions = { documentSelector: [{ language: 'kurt' }] };
    client = new LanguageClient('kurt', 'Kurt', serverOptions, clientOptions);
    try {
        await client.start();
        return true;
    } catch (err) {
        client = undefined;
        vscode.window.showInformationMessage(`Kurt's language server didn't start (${command}): only the static completion. Install Kurt (pip install kurt-lang) or set kurt.server.command.`);
        return false;
    }
}

function staticCompletion(context: vscode.ExtensionContext): vscode.Disposable {
    let data = { keywords: [] as string[], theories: [] as string[] };
    try { data = JSON.parse(fs.readFileSync(path.join(context.extensionPath, 'completions.json'), 'utf8')); } catch {}
    return vscode.languages.registerCompletionItemProvider('kurt', {
        provideCompletionItems(document, position) {
            const before = document.lineAt(position.line).text.substring(0, position.character);
            if (/^\s*load\b/.test(before)) {
                return data.theories.map(t => new vscode.CompletionItem(t, vscode.CompletionItemKind.Module));
            }
            const text = document.getText();
            const names = new Set<string>();
            for (const m of text.matchAll(/^\s*(?:const|var|bool|def|arity|infix|prefix|postfix|bindop|let|pick)\s+([^;\n]+)/gm)) {
                for (const name of m[1].split(/[\s,=]+/)) if (/^[$%]?[A-Za-z][A-Za-z0-9]*$/.test(name)) names.add(name);
            }
            const labels = new Set<string>([...text.matchAll(/"([^"\n]+)"/g)].map(m => m[1]));
            return [
                ...data.keywords.map(k => new vscode.CompletionItem(k, vscode.CompletionItemKind.Keyword)),
                ...[...names].map(n => new vscode.CompletionItem(n, vscode.CompletionItemKind.Variable)),
                ...[...labels].map(l => new vscode.CompletionItem(l, vscode.CompletionItemKind.Reference)),
            ];
        }
    }, ' ', '"');
}

export async function activate(context: vscode.ExtensionContext) {
    console.log('🔥 Kurt extension activated');

    if (!(await startServer(context))) {
        context.subscriptions.push(staticCompletion(context));
    }

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
            if (event.document.languageId !== 'kurt') return;

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
                    const finalText = replacement;

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

export function deactivate(): Thenable<void> | undefined {
    return client?.stop();
}