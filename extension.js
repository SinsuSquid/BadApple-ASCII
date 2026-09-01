const vscode = require('vscode');
const path = require('path');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    // Register Sidebar Webview View Provider
    const sidebarProvider = new BadAppleViewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('badapple.sidebarView', sidebarProvider, {
            webviewOptions: {
                retainContextWhenHidden: true
            }
        })
    );

    // Register Status Bar button
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'badapple.focusSidebar';
    statusBarItem.text = '$(play) Bad Apple!!';
    statusBarItem.tooltip = 'Show Bad Apple!! in Sidebar';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // Command: Focus Sidebar View
    context.subscriptions.push(
        vscode.commands.registerCommand('badapple.focusSidebar', () => {
            vscode.commands.executeCommand('badapple.sidebarView.focus');
        })
    );

    // Command: Open in Editor Tab (Optional Fullscreen Tab)
    let currentPanel = undefined;
    context.subscriptions.push(
        vscode.commands.registerCommand('badapple.openTab', () => {
            const column = vscode.window.activeTextEditor
                ? vscode.window.activeTextEditor.viewColumn
                : undefined;

            if (currentPanel) {
                currentPanel.reveal(column);
                return;
            }

            currentPanel = vscode.window.createWebviewPanel(
                'badAppleAsciiTab',
                'Bad Apple!! ASCII',
                column || vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: [
                        vscode.Uri.file(path.join(context.extensionPath, 'media'))
                    ]
                }
            );

            const iconUri = vscode.Uri.file(path.join(context.extensionPath, 'media', 'icon.png'));
            currentPanel.iconPath = iconUri;
            currentPanel.webview.html = getWebviewContent(currentPanel.webview, context.extensionUri, false);

            currentPanel.onDidDispose(() => {
                currentPanel = undefined;
            }, null, context.subscriptions);
        })
    );
}

class BadAppleViewProvider {
    /**
     * @param {vscode.Uri} _extensionUri
     */
    constructor(_extensionUri) {
        this._extensionUri = _extensionUri;
        this._view = undefined;
    }

    /**
     * @param {vscode.WebviewView} webviewView
     * @param {vscode.WebviewViewResolveContext} context
     * @param {vscode.CancellationToken} _token
     */
    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(this._extensionUri.fsPath, 'media'))
            ]
        };

        webviewView.webview.html = getWebviewContent(webviewView.webview, this._extensionUri, true);

        webviewView.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'alert':
                    vscode.window.showInformationMessage(message.text);
                    return;
                case 'openTab':
                    vscode.commands.executeCommand('badapple.openTab');
                    return;
            }
        });
    }
}

/**
 * @param {vscode.Webview} webview
 * @param {vscode.Uri} extensionUri
 * @param {boolean} isSidebar
 */
function getWebviewContent(webview, extensionUri, isSidebar = false) {
    const mediaPath = path.join(extensionUri.fsPath, 'media');

    const videoUri = webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'bad_apple.mp4')));
    const styleUri = webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'style.css')));
    const scriptUri = webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'player.js')));

    const config = vscode.workspace.getConfiguration('badapple');
    const initialConfig = {
        charset: config.get('charset', 'standard'),
        resolution: config.get('resolution', 'auto'),
        crtScanlines: config.get('crtScanlines', true),
        loop: config.get('loop', true),
        inverted: config.get('inverted', false),
        contrast: config.get('contrast', 1.2),
        isSidebar: isSidebar
    };

    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; media-src ${webview.cspSource} blob: data:; img-src ${webview.cspSource} data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bad Apple!! ASCII</title>
    <link rel="stylesheet" href="${styleUri}">
</head>
<body class="${initialConfig.crtScanlines ? 'crt-scanlines' : ''} ${isSidebar ? 'is-sidebar' : ''}">
    <!-- Video source (completely hidden offscreen, used strictly as frame decoder) -->
    <video id="video-source" src="${videoUri}" playsinline muted preload="auto" style="display: none !important; position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none;" ${initialConfig.loop ? 'loop' : ''}></video>
    <canvas id="render-canvas" style="display: none !important; position: absolute; opacity: 0; pointer-events: none;"></canvas>

    <div id="crt-container" class="crt-screen">
        <!-- Top HUD Header -->
        <header id="hud-bar">
            <div class="hud-left">
                <span class="hud-badge pulse-dot"></span>
                <span class="hud-title">BAD APPLE!!</span>
                <span id="hud-fps" class="hud-stat">30 FPS</span>
                <span id="hud-res" class="hud-stat">60x22</span>
            </div>
            <div class="hud-right">
                <label class="hud-control" title="Character Density">
                    <select id="charset-select">
                        <option value="standard">Standard (10)</option>
                        <option value="detailed">Dense (70)</option>
                        <option value="blocks">Blocks</option>
                        <option value="braille">Braille</option>
                        <option value="matrix">Matrix</option>
                        <option value="binary">Binary</option>
                        <option value="custom">Custom...</option>
                    </select>
                </label>

                <button id="btn-invert" class="hud-btn" title="Toggle Invert">INV</button>
                <button id="btn-crt" class="hud-btn active" title="Toggle CRT Effect">CRT</button>
            </div>
        </header>

        <!-- Main ASCII Display Stage -->
        <main id="stage">
            <div id="ascii-wrapper">
                <pre id="ascii-display" aria-label="Bad Apple ASCII screen"></pre>
            </div>
        </main>

        <!-- Bottom Controls Bar -->
        <footer id="control-bar">
            <div class="controls-left">
                <button id="btn-play" class="ctrl-btn" title="Play/Pause (Space)">
                    <svg id="icon-play" viewBox="0 0 24 24" width="16" height="16"><polygon points="6,4 20,12 6,20" fill="currentColor"/></svg>
                    <svg id="icon-pause" viewBox="0 0 24 24" width="16" height="16" style="display:none;"><rect x="5" y="4" width="4" height="16" fill="currentColor"/><rect x="15" y="4" width="4" height="16" fill="currentColor"/></svg>
                </button>
                <button id="btn-restart" class="ctrl-btn" title="Replay from start">
                    <svg viewBox="0 0 24 24" width="14" height="14"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" fill="currentColor"/></svg>
                </button>
                <span id="time-display" class="time-text">00:00 / 03:39</span>
            </div>

            <div class="controls-center">
                <input type="range" id="seek-bar" min="0" max="100" value="0" step="0.1" title="Seek position">
            </div>

            <div class="controls-right">
                <button id="btn-loop" class="ctrl-btn active" title="Toggle Loop">
                    <svg viewBox="0 0 24 24" width="14" height="14"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" fill="currentColor"/></svg>
                </button>
            </div>
        </footer>
    </div>

    <!-- Custom Charset Modal -->
    <div id="modal-custom-charset" class="modal-backdrop" style="display: none;">
        <div class="modal-card">
            <h3>Custom ASCII Palette</h3>
            <p>Enter characters from dark to bright:</p>
            <input type="text" id="input-custom-charset" value=" .:-=+*#%@" placeholder="Dark -> Bright">
            <div class="modal-actions">
                <button id="btn-save-custom" class="modal-btn confirm">Apply</button>
                <button id="btn-cancel-custom" class="modal-btn cancel">Cancel</button>
            </div>
        </div>
    </div>

    <script nonce="${nonce}">
        window.__INITIAL_CONFIG__ = ${JSON.stringify(initialConfig)};
    </script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
