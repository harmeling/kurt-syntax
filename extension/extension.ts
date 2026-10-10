import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { execFile, execFileSync } from 'child_process';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    State,
} from 'vscode-languageclient/node';

let replacements: Record<string, string> = {};
let client: LanguageClient | undefined;
let output: vscode.OutputChannel;
let status: vscode.StatusBarItem;
let restartQueue: Promise<void> = Promise.resolve();
let stateSubscription: vscode.Disposable | undefined;
let reasonDecoration: vscode.TextEditorDecorationType;
let reasonTimer: ReturnType<typeof setTimeout> | undefined;
let extensionPath = '';

function configuration(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration('kurt');
}

function workspaceFolder(): vscode.WorkspaceFolder | undefined {
    const document = vscode.window.activeTextEditor?.document;
    return document ? vscode.workspace.getWorkspaceFolder(document.uri) : vscode.workspace.workspaceFolders?.[0];
}

// the Kurt that runs the language server: an installed one (the setting `kurt.server.path`, a
// `.venv` of the workspace, `kurt` on PATH), else the `kurt.py` that comes with the extension, run
// with Python -- or the other way round, with `kurt.server.importStrategy` = `useBundled`
type Server = { command: string, args: string[], source: string };

function onPath(name: string): string | undefined {
    const names = process.platform === 'win32' ? [`${name}.exe`, `${name}.cmd`, `${name}.bat`] : [name];
    for (const folder of (process.env.PATH ?? '').split(path.delimiter)) {
        for (const candidate of names) {
            const full = path.join(folder, candidate);
            if (folder && fs.existsSync(full)) return full;
        }
    }
    return undefined;
}

function installed(): Server | undefined {
    const configured = configuration().get<string>('server.path', '').trim();
    const folder = workspaceFolder();
    if (configured) {
        const command = path.isAbsolute(configured) || !folder ? configured : path.join(folder.uri.fsPath, configured);
        return { command, args: [], source: 'the setting kurt.server.path' };
    }
    if (vscode.workspace.isTrusted && folder) {
        const local = process.platform === 'win32'
            ? path.join(folder.uri.fsPath, '.venv', 'Scripts', 'kurt.exe')
            : path.join(folder.uri.fsPath, '.venv', 'bin', 'kurt');
        if (fs.existsSync(local)) return { command: local, args: [], source: 'the .venv of the workspace' };
    }
    const found = onPath('kurt');
    return found ? { command: found, args: [], source: 'kurt on PATH' } : undefined;
}

function python(): string[] | undefined {
    // a Python 3.10 or newer: the setting `kurt.server.python`, else the usual names
    const configured = configuration().get<string>('server.python', '').trim();
    const candidates = configured ? [[configured]]
        : process.platform === 'win32' ? [['py', '-3'], ['python'], ['python3']] : [['python3'], ['python']];
    for (const [command, ...args] of candidates) {
        try {
            execFileSync(command, [...args, '-c', 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)'],
                         { timeout: 10000, stdio: 'ignore' });
            return [command, ...args];
        } catch {
            // not there, or too old
        }
    }
    return undefined;
}

function bundled(): Server | undefined {
    const script = path.join(extensionPath, 'bundled', 'kurt.py');
    if (!fs.existsSync(script)) return undefined;
    const interpreter = python();
    if (!interpreter) return undefined;
    const [command, ...args] = interpreter;
    return { command, args: [...args, script], source: 'the kurt.py that comes with the extension' };
}

function server(): Server | undefined {
    if (configuration().get<string>('server.importStrategy', 'fromEnvironment') === 'useBundled') {
        return bundled() ?? installed();
    }
    return installed() ?? bundled();
}

function setStatus(text: string, tooltip: string, command = 'kurt.showServerOutput'): void {
    status.text = text;
    status.tooltip = tooltip;
    status.command = command;
    status.show();
}

function refreshProblemStatus(): void {
    if (!client || client.state !== State.Running) return;
    let problems = 0;
    for (const document of vscode.workspace.textDocuments.filter(doc => doc.languageId === 'kurt')) {
        problems += vscode.languages.getDiagnostics(document.uri).length;
    }
    setStatus(problems ? `Kurt: ${problems} problem${problems === 1 ? '' : 's'}` : 'Kurt $(check)',
              problems ? 'Kurt diagnostics' : 'Kurt language server is running');
}

async function recoveryMessage(error: unknown): Promise<void> {
    output.appendLine(`Unable to start Kurt: ${error instanceof Error ? error.message : String(error)}`);
    setStatus('Kurt unavailable', 'Kurt language server did not start', 'kurt.selectExecutable');
    const choice = await vscode.window.showErrorMessage(
        'Kurt could not start. It needs Python 3.10 or newer (python.org), or an installed Kurt ' +
        '(`pip install kurt-lang`), or its executable selected.',
        'Select Executable', 'Setup', 'Show Output');
    if (choice === 'Select Executable') await vscode.commands.executeCommand('kurt.selectExecutable');
    if (choice === 'Setup') await vscode.env.openExternal(vscode.Uri.parse('https://www.kurt-lang.org'));
    if (choice === 'Show Output') output.show(true);
}

async function startServer(): Promise<void> {
    if (client) return;
    const config = configuration();
    const found = server();
    if (!found) {
        await recoveryMessage(new Error('neither an installed kurt nor a Python 3.10 or newer for the bundled kurt.py was found'));
        return;
    }
    const command = found.command;
    const args = [...found.args, ...config.get<string[]>('server.extraArgs', []), '--lsp'];
    output.appendLine(`Kurt: ${found.source} (${command} ${args.join(' ')})`);
    const serverOptions: ServerOptions = { command, args };
    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'kurt' }, { scheme: 'untitled', language: 'kurt' }],
        outputChannel: output,
        initializationOptions: {
            theoryPaths: config.get<string[]>('server.theoryPaths', []),
            strict: config.get<boolean>('server.strict', false),
            checkOnType: config.get<boolean>('checkOnType', true),
            allErrors: config.get<boolean>('allErrors', true),
        },
        middleware: {
            // the reasons are drawn by `refreshReasons` (aligned at a column), not as inlay hints
            provideInlayHints: () => null,
        },
    };
    const next = new LanguageClient('kurt', 'Kurt Language Server', serverOptions, clientOptions);
    client = next;
    stateSubscription = next.onDidChangeState(event => {
        if (event.newState === State.Starting) setStatus('Kurt: starting…', `${found.source}: ${command} ${args.join(' ')}`);
        if (event.newState === State.Running) {
            refreshProblemStatus();
            scheduleReasons();
        }
        if (event.newState === State.Stopped && client === next) {
            setStatus('Kurt unavailable', 'Kurt language server stopped', 'kurt.restartServer');
        }
    });
    try {
        await next.start();
    } catch (error) {
        if (client === next) client = undefined;
        await recoveryMessage(error);
    }
}

async function stopServer(): Promise<void> {
    const old = client;
    client = undefined;
    stateSubscription?.dispose();
    stateSubscription = undefined;
    if (old) await old.stop();
}

async function restartServer(): Promise<void> {
    setStatus('Kurt: restarting…', 'Restarting Kurt language server');
    await stopServer();
    await startServer();
}

function queueRestart(): Promise<void> {
    restartQueue = restartQueue.then(restartServer, restartServer);
    return restartQueue;
}

function registerReplacements(context: vscode.ExtensionContext): void {
    try {
        replacements = JSON.parse(fs.readFileSync(path.join(context.extensionPath, 'replacements.json'), 'utf8'));
    } catch (error) {
        output.appendLine(`Could not load replacements.json: ${String(error)}`);
    }
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || event.document !== editor.document || event.document.languageId !== 'kurt') return;
        const change = event.contentChanges[0];
        if (!change || (change.text.length !== 1 && change.text !== '\n') || /^[a-zA-Z0-9]$/.test(change.text)) return;
        const trigger = change.range.start;
        const before = event.document.lineAt(trigger.line).text.substring(0, trigger.character);
        const match = before.match(/(\\[a-zA-Z]+)$/);
        if (!match || !replacements[match[1]]) return;
        const start = new vscode.Position(trigger.line, trigger.character - match[1].length);
        const end = change.text === ' ' ? new vscode.Position(trigger.line, trigger.character + 1)
            : change.text === '\n' ? new vscode.Position(trigger.line + 1, 0) : trigger;
        setTimeout(async () => {
            const changed = await editor.edit(builder => builder.replace(new vscode.Range(start, end), replacements[match[1]]));
            if (changed && change.text === '\n') await editor.insertSnippet(new vscode.SnippetString('\n'), editor.selection.active);
        }, 0);
    }));
}

// The reason of each checked line (`; 5 by 3(4)`), after its end and aligned at a column, as in
// Kurt's own output: the server's inlay hints, drawn as decorations -- an inlay hint can't be
// padded to a column without a background box over the padding.
function visualWidth(text: string, tabSize: number): number {
    let width = 0;
    for (const character of text) {
        width = character === '\t' ? width + tabSize - (width % tabSize) : width + 1;
    }
    return width;
}

type ReasonHint = { position: { line: number }, label: string | { value: string }[] };

function labelText(label: string | { value: string }[]): string {
    return typeof label === 'string' ? label : label.map(part => part.value).join('');
}

async function refreshReasons(): Promise<void> {
    const enabled = configuration().get<boolean>('inlayHints.enabled', true);
    const column = configuration().get<number>('reasons.column', 42);
    for (const editor of vscode.window.visibleTextEditors) {
        const document = editor.document;
        if (document.languageId !== 'kurt') continue;
        if (!enabled || !client || client.state !== State.Running) {
            editor.setDecorations(reasonDecoration, []);
            continue;
        }
        const whole = new vscode.Range(0, 0, document.lineCount, 0);
        let hints: ReasonHint[] | null = null;
        try {
            hints = await client.sendRequest<ReasonHint[] | null>('textDocument/inlayHint', {
                textDocument: { uri: document.uri.toString() },
                range: client.code2ProtocolConverter.asRange(whole),
            });
        } catch (error) {
            continue;                     // (the server restarts, or the document closed)
        }
        const tabSize = typeof editor.options.tabSize === 'number' ? editor.options.tabSize : 4;
        const decorations: vscode.DecorationOptions[] = [];
        for (const hint of hints ?? []) {
            const line = hint.position.line;
            if (line >= document.lineCount) continue;
            const text = document.lineAt(line).text;
            const reason = labelText(hint.label).replace(/^\s*;\s*/, '');
            const pad = Math.max(2, column - visualWidth(text, tabSize));
            decorations.push({         // (its hover comes from the server: the certificate of the line)
                range: new vscode.Range(line, text.length, line, text.length),
                renderOptions: { after: { contentText: `; ${reason}`, margin: `0 0 0 ${pad}ch` } },
            });
        }
        editor.setDecorations(reasonDecoration, decorations);
    }
}

function scheduleReasons(): void {
    if (reasonTimer) clearTimeout(reasonTimer);
    reasonTimer = setTimeout(() => { void refreshReasons(); }, 100);
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    extensionPath = context.extensionPath;
    reasonDecoration = vscode.window.createTextEditorDecorationType({
        after: { color: new vscode.ThemeColor('editorInlayHint.foreground') },
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    });
    context.subscriptions.push(reasonDecoration);
    output = vscode.window.createOutputChannel('Kurt Language Server');
    status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 20);
    context.subscriptions.push(output, status);
    registerReplacements(context);

    context.subscriptions.push(
        vscode.commands.registerCommand('kurt.restartServer', queueRestart),
        vscode.commands.registerCommand('kurt.showServerOutput', () => output.show(true)),
        vscode.commands.registerCommand('kurt.selectExecutable', async () => {
            const selected = await vscode.window.showOpenDialog({ canSelectMany: false, openLabel: 'Select Kurt executable' });
            if (!selected?.[0]) return;
            await configuration().update('server.path', selected[0].fsPath,
                workspaceFolder() ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global);
        }),
        vscode.commands.registerCommand('kurt.checkCurrentFile', async () => {
            const document = vscode.window.activeTextEditor?.document;
            if (!document || document.languageId !== 'kurt' || !client) return;
            setStatus('Kurt: checking…', 'Checking current Kurt file');
            await client.sendRequest('kurt/check', { textDocument: { uri: document.uri.toString() } });
            refreshProblemStatus();
        }),
        vscode.commands.registerCommand('kurt.showVersion', () => {
            const found = server();
            if (!found) {
                void vscode.window.showErrorMessage('Kurt: no installed kurt, and no Python 3.10 or newer for the bundled kurt.py');
                return;
            }
            execFile(found.command, [...found.args, '--version'], (error, stdout, stderr) => {
                const message = error ? stderr || error.message : `${stdout.trim()} (${found.source})`;
                if (error) output.appendLine(message);
                void vscode.window.showInformationMessage(error ? `Kurt: ${message}` : message);
            });
        }),
        vscode.languages.onDidChangeDiagnostics(() => {
            refreshProblemStatus();
            scheduleReasons();            // (the server publishes them after each check)
        }),
        vscode.window.onDidChangeVisibleTextEditors(scheduleReasons),
        vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('kurt.server') || event.affectsConfiguration('kurt.checkOnType') || event.affectsConfiguration('kurt.allErrors')) {
                void queueRestart();
            }
            if (event.affectsConfiguration('kurt.inlayHints') || event.affectsConfiguration('kurt.reasons')) {
                scheduleReasons();
            }
        }),
    );
    await startServer();
}

export async function deactivate(): Promise<void> {
    await stopServer();
}
