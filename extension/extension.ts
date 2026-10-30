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
// the heat map (Kurt 0.12): the lines checked so far and the line at work while a check runs (`kurt/progress`), and how long the
// search for each line took (`kurt/profile`) -- tinted backgrounds, the slower the redder
let progressDone: vscode.TextEditorDecorationType;
let progressNow: vscode.TextEditorDecorationType;
let heatLevels: vscode.TextEditorDecorationType[] = [];
const HEAT_SECONDS = [0.05, 0.25, 1, 2.5];          // a line slower than the first is tinted, the more so the slower it is
const progressOf = new Map<string, { line: number, done: boolean }>();
const profileOf = new Map<string, { line: number, seconds: number, steps: number }[]>();
let extensionPath = '';

function configuration(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration('kurt');
}

function workspaceFolder(): vscode.WorkspaceFolder | undefined {
    // the folder of the active editor's file -- else (the Output panel, a file outside the workspace:
    // no folder) the first folder, so that its `.venv` is still found (a restart from the Output panel
    // took `kurt` on PATH, 2026-10-20)
    const document = vscode.window.activeTextEditor?.document;
    return (document ? vscode.workspace.getWorkspaceFolder(document.uri) : undefined) ?? vscode.workspace.workspaceFolders?.[0];
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

// the hover of the status item (shown above it): a headline, the progress bar of a running check, and the commands as links
const STATUS_COMMANDS = ['kurt.cancelCheck', 'kurt.restartServer', 'kurt.showProblems', 'kurt.showServerOutput', 'kurt.toggleHover', 'kurt.toggleHeat'];

function progressBar(done: number, total: number, width = 20): string {
    const filled = total > 0 ? Math.max(0, Math.min(width, Math.round(width * done / total))) : 0;
    return '█'.repeat(filled) + '░'.repeat(width - filled);
}

// the lines of each file that its last check went through (kept after the check ends: the stats of the hover)
const checkedLines = new Map<string, number>();

function statusTooltip(state: string): vscode.MarkdownString {
    const box = (on: boolean) => on ? '☑' : '☐';
    const hover = configuration().get<boolean>('hover.enabled', true);
    const heat = configuration().get<boolean>('heat.enabled', true);
    const version = client?.initializeResult?.serverInfo?.version;
    const md = new vscode.MarkdownString(undefined, true);
    md.isTrusted = { enabledCommands: STATUS_COMMANDS };
    md.appendMarkdown(`**Kurt language server**${version ? ` ${version}` : ''}  \n${state}\n\n`);
    const open = vscode.workspace.textDocuments.filter(doc => doc.languageId === 'kurt');
    const lines = open.reduce((sum, doc) => sum + (checkedLines.get(doc.uri.toString()) ?? 0), 0);
    md.appendMarkdown(`${open.length} Kurt file${open.length === 1 ? '' : 's'} open, ${lines} lines checked\n\n`);
    if (checking.size > 0) {
        for (const [uri, progress] of checking) {
            const name = path.basename(vscode.Uri.parse(uri).fsPath);
            const percent = progress.lines > 0 ? Math.round(100 * progress.line / progress.lines) : 0;
            const count = progress.lines > 0 ? `${percent}% (line ${progress.line} of ${progress.lines})` : `line ${progress.line}`;
            md.appendMarkdown(`$(file) \`${name}\`  \n\`${progressBar(progress.line, progress.lines)}\` ${count}\n\n`);
        }
        md.appendMarkdown('[$(debug-stop) Cancel the check](command:kurt.cancelCheck)\n\n');
    } else {
        const current = vscode.window.activeTextEditor?.document;
        if (current?.languageId === 'kurt' && checkedLines.has(current.uri.toString())) {
            md.appendMarkdown(`$(file) \`${path.basename(current.uri.fsPath)}\`  \n\`${progressBar(1, 1)}\` 100%\n\n`);
        }
    }
    // one entry per line (`  \n` is a line break without the gap of a paragraph)
    md.appendMarkdown('[$(debug-restart) Restart](command:kurt.restartServer)  \n' +
                      '[$(warning) Problems](command:kurt.showProblems)  \n' +
                      '[$(output) Output](command:kurt.showServerOutput)\n\n---\n\n' +
                      `[${box(hover)}](command:kurt.toggleHover) **Hover boxes**  \n` +
                      '<sub>hover over a line: its certificate, and what a fact rests on (axioms, `todo`s)</sub>  \n' +
                      `[${box(heat)}](command:kurt.toggleHeat) **Heat map**  \n` +
                      '<sub>tints the lines: green checked, yellow at work, orange to red the slower the search</sub>');
    md.supportHtml = true;
    return md;
}

function setStatus(text: string, tooltip: string, command = 'kurt.statusMenu'): void {
    status.text = text;
    status.tooltip = statusTooltip(tooltip);
    status.command = command;
    status.show();
}

function refreshProblemStatus(): void {
    if (!client || client.state !== State.Running) return;
    // errors and warnings (a `todo` is one) -- not the hints, e.g. "not used" for a line no later line
    // cites, which VS Code shows faded (counted as problems until 2026-10-20)
    let problems = 0;
    for (const document of vscode.workspace.textDocuments.filter(doc => doc.languageId === 'kurt')) {
        problems += vscode.languages.getDiagnostics(document.uri)
            .filter(d => d.severity === vscode.DiagnosticSeverity.Error || d.severity === vscode.DiagnosticSeverity.Warning).length;
    }
    if (checking.size > 0) { showChecking(); return; }       // (a check runs: its progress is the status, until it ends)
    setStatus(problems ? `Kurt: ${problems} problem${problems === 1 ? '' : 's'}` : 'Kurt $(check)',
              problems ? `Running: ${problems} problem${problems === 1 ? '' : 's'}` : 'Running: no problems');
}

// the status while a check runs (`kurt/progress` of Kurt 0.12): `Kurt: checking 12/84`, the file name in the tooltip
const checking = new Map<string, { line: number, lines: number }>();

function showChecking(): void {
    const entries = [...checking.entries()];
    const [uri, progress] = entries[entries.length - 1];
    const name = path.basename(vscode.Uri.parse(uri).fsPath);
    const where = progress.lines > 0 ? `line ${progress.line} of ${progress.lines}` : `line ${progress.line}`;
    setStatus(`$(sync~spin) Kurt: checking ${progress.lines > 0 ? `${progress.line}/${progress.lines}` : progress.line}`,
              `Checking ${name}: ${where}`);
}

function cancelChecks(): void {
    for (const uri of checking.keys()) void client?.sendNotification('kurt/cancel', { uri });
}

async function toggleSetting(name: string): Promise<void> {
    const target = workspaceFolder() ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;
    await configuration().update(name, !configuration().get<boolean>(name, true), target);
}

// the menu of the status item (the click; the hover has the same commands)
async function statusMenu(): Promise<void> {
    const hover = configuration().get<boolean>('hover.enabled', true);
    const heat = configuration().get<boolean>('heat.enabled', true);
    const items: { label: string, id: string }[] = [];
    if (checking.size > 0) items.push({ label: '$(debug-stop) Cancel the check', id: 'cancel' });
    items.push({ label: '$(debug-restart) Restart Kurt', id: 'restart' },
               { label: '$(warning) Show the problems', id: 'problems' },
               { label: '$(output) Show Kurt\'s output', id: 'output' },
               { label: hover ? '$(eye-closed) Switch off the hover boxes' : '$(eye) Switch on the hover boxes', id: 'hover' },
               { label: heat ? '$(circle-slash) Switch off the heat map' : '$(flame) Switch on the heat map', id: 'heat' });
    const choice = await vscode.window.showQuickPick(items, { placeHolder: 'Kurt' });
    const target = workspaceFolder() ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;
    switch (choice?.id) {
        case 'cancel': cancelChecks(); break;
        case 'restart': await queueRestart(); break;
        case 'problems': await vscode.commands.executeCommand('workbench.actions.view.problems'); break;
        case 'output': output.show(true); break;
        case 'hover': await configuration().update('hover.enabled', !hover, target); break;
        case 'heat': await configuration().update('heat.enabled', !heat, target); break;
    }
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
            heat: config.get<boolean>('heat.enabled', true),
        },
        middleware: {
            // the reasons are drawn by `refreshReasons` (aligned at a column), not as inlay hints
            provideInlayHints: () => null,
            // the hover boxes (the certificate of a line, what a fact rests on) can be switched off in the status menu
            provideHover: (document, position, token, next) =>
                configuration().get<boolean>('hover.enabled', true) ? next(document, position, token) : undefined,
        },
    };
    const next = new LanguageClient('kurt', 'Kurt Language Server', serverOptions, clientOptions);
    client = next;
    next.onNotification('kurt/progress', (params: { uri: string, line: number, lines: number, done: boolean }) => {
        if (params.done) {
            if (params.lines > 0) checkedLines.set(params.uri, params.lines);
            progressOf.delete(params.uri);
            checking.delete(params.uri);
            refreshProblemStatus();
        } else {
            progressOf.set(params.uri, { line: params.line, done: false });
            checking.set(params.uri, { line: params.line, lines: params.lines });
            if (params.lines > 0) checkedLines.set(params.uri, params.lines);
            showChecking();
        }
        refreshHeat(params.uri);
    });
    next.onNotification('kurt/profile', (params: { uri: string, lines: { line: number, seconds: number, steps: number }[] }) => {
        profileOf.set(params.uri, params.lines);
        progressOf.delete(params.uri);
        checking.delete(params.uri);
        refreshProblemStatus();
        refreshHeat(params.uri);
    });
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

// The column of the reasons with `kurt.reasons.column: "auto"`: two after the 95th percentile of the
// widths of the lines that get a reason (the whole file, so that the reasons don't move when
// scrolling; one long line hardly moves it, so they don't jump while typing), at least 20. The
// editor's width can't be known: VS Code has no API for it. A longer line gets its reason two
// spaces after it.
export function reasonColumn(widths: number[]): number {
    if (widths.length === 0) return 20;
    const sorted = [...widths].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(0.95 * (sorted.length - 1))];     // (the lower one: in a short file, its longest line doesn't count)
    return Math.max(20, p95 + 2);
}

async function refreshReasons(): Promise<void> {
    const enabled = configuration().get<boolean>('inlayHints.enabled', true);
    const setting = configuration().get<number | string>('reasons.column', 'auto');
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
        const widths = (hints ?? []).filter(hint => hint.position.line < document.lineCount)
            .map(hint => visualWidth(document.lineAt(hint.position.line).text, tabSize));
        const column = typeof setting === 'number' ? setting : reasonColumn(widths);
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

// the tints of one document: the lines before the one at work, that one, and -- when no check runs -- the heat of each line
function refreshHeat(uri?: string): void {
    const showProgress = configuration().get<boolean>('heat.progress', true);
    for (const editor of vscode.window.visibleTextEditors) {
        const document = editor.document;
        if (document.languageId !== 'kurt' || (uri !== undefined && document.uri.toString() !== uri)) continue;
        const key = document.uri.toString();
        const enabled = configuration().get<boolean>('heat.enabled', true);
        const progress = progressOf.get(key);
        const done: vscode.Range[] = [];
        const now: vscode.Range[] = [];
        if (enabled && showProgress && progress) {
            if (progress.line > 1) done.push(new vscode.Range(0, 0, Math.min(progress.line - 2, document.lineCount - 1), 0));
            if (progress.line - 1 < document.lineCount) now.push(new vscode.Range(progress.line - 1, 0, progress.line - 1, 0));
        }
        editor.setDecorations(progressDone, done.map(range => ({ range: new vscode.Range(range.start, range.end), })));
        editor.setDecorations(progressNow, now);
        const levels: vscode.Range[][] = heatLevels.map(() => []);
        if (enabled && !progress) {
            for (const entry of profileOf.get(key) ?? []) {
                const level = HEAT_SECONDS.filter(limit => entry.seconds >= limit).length - 1;
                if (level >= 0 && entry.line - 1 < document.lineCount) levels[level].push(new vscode.Range(entry.line - 1, 0, entry.line - 1, 0));
            }
        }
        heatLevels.forEach((type, i) => editor.setDecorations(type, levels[i]));
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
    progressDone = vscode.window.createTextEditorDecorationType({ isWholeLine: true, backgroundColor: 'rgba(80, 180, 120, 0.07)' });
    progressNow = vscode.window.createTextEditorDecorationType({ isWholeLine: true, backgroundColor: 'rgba(255, 200, 0, 0.28)' });
    heatLevels = [0.10, 0.20, 0.32, 0.45].map(alpha =>
        vscode.window.createTextEditorDecorationType({ isWholeLine: true, backgroundColor: `rgba(255, 90, 40, ${alpha})`,
            overviewRulerColor: `rgba(255, 90, 40, ${alpha + 0.2})`, overviewRulerLane: vscode.OverviewRulerLane.Right }));
    context.subscriptions.push(progressDone, progressNow, ...heatLevels);
    output = vscode.window.createOutputChannel('Kurt Language Server');
    status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 20);
    context.subscriptions.push(output, status);
    registerReplacements(context);

    context.subscriptions.push(
        vscode.commands.registerCommand('kurt.restartServer', queueRestart),
        vscode.commands.registerCommand('kurt.statusMenu', statusMenu),
        vscode.commands.registerCommand('kurt.cancelCheck', cancelChecks),
        vscode.commands.registerCommand('kurt.showProblems', () => vscode.commands.executeCommand('workbench.actions.view.problems')),
        vscode.commands.registerCommand('kurt.toggleHover', () => toggleSetting('hover.enabled')),
        vscode.commands.registerCommand('kurt.toggleHeat', () => toggleSetting('heat.enabled')),
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
                // (from Kurt 0.10 on three lines: the version, the path and the SHA-256 of the kurt.py that runs)
                const message = error ? stderr || error.message : `${stdout.trim().split(/\r?\n/).join(', ')} (${found.source})`;
                if (error) output.appendLine(message);
                void vscode.window.showInformationMessage(error ? `Kurt: ${message}` : message);
            });
        }),
        vscode.languages.onDidChangeDiagnostics(() => {
            refreshProblemStatus();
            scheduleReasons();            // (the server publishes them after each check)
        }),
        vscode.window.onDidChangeVisibleTextEditors(() => { scheduleReasons(); refreshHeat(); }),
        vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('kurt.heat')) refreshHeat();
            if (event.affectsConfiguration('kurt.hover')) refreshProblemStatus();
            if (event.affectsConfiguration('kurt.server') || event.affectsConfiguration('kurt.checkOnType') || event.affectsConfiguration('kurt.allErrors') || event.affectsConfiguration('kurt.heat.enabled')) {
                void queueRestart();
            }
            if (event.affectsConfiguration('kurt.inlayHints') || event.affectsConfiguration('kurt.reasons')) {
                scheduleReasons();
            }
        }),
    );
    await startServer();
    offerToUninstallTheOldExtension();
}

// the extension was `harmeling.kurt` ("Kurt") until 0.8.6, installed from a `.vsix`; the
// Marketplace keeps the ID and the name of a removed extension, so it is `harmeling.kurt-lang`
// now -- both installed means two servers for each file
function offerToUninstallTheOldExtension(): void {
    const old = vscode.extensions.getExtension('harmeling.kurt');
    if (!old) return;
    const uninstall = 'Uninstall it';
    void vscode.window.showWarningMessage(
        'Kurt: the older extension "Kurt" (harmeling.kurt) is installed too; this one, "Kurt Proof Language", replaces it.', uninstall)
        .then(choice => {
            if (choice === uninstall) {
                void vscode.commands.executeCommand('workbench.extensions.uninstallExtension', 'harmeling.kurt');
            }
        });
}

export async function deactivate(): Promise<void> {
    await stopServer();
}
