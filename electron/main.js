const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

let mainWindow;

// Détection robuste : si le dist buildé existe, c'est la prod (même dans l'exe)
const distIndex = path.join(__dirname, '..', 'frontend', 'dist', 'index.html');
const IS_DEV = !fs.existsSync(distIndex);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'ImprimChèques Traites - Tunisie',
    icon: path.join(__dirname, '..', 'frontend', 'public', 'favicon.svg'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: !IS_DEV,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  const startUrl = IS_DEV
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '..', 'frontend', 'dist', 'index.html')}`;

  mainWindow.loadURL(startUrl);

  mainWindow.webContents.on('did-finish-load', () => {
    if (IS_DEV) {
      mainWindow.webContents.executeJavaScript(
        "typeof window.electronAPI !== 'undefined' && typeof window.electronAPI.printHTML === 'function'",
        true
      ).then((ok) => {
        console.log('[diag] preload electronAPI chargé =', ok);
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'Diagnostic impression',
          message: 'Préchargement electronAPI : ' + (ok ? 'OK ✓' : 'ABSENT ✗'),
          detail: ok
            ? "L'IPC printHTML est disponible. Testez l'impression d'un chèque."
            : "Le preload ne s'est pas chargé. Vérifiez preload.js et contextIsolation.",
          buttons: ['OK']
        });
      }).catch((err) => {
        console.error('[diag] executeJavaScript a échoué', err);
      });
    }
  });

  // Menu dev : test d'impression (Ctrl+Shift+P) — uniquement en dev
  if (IS_DEV) {
    const template = [
      {
        label: 'Diagnostic',
        submenu: [
          {
            label: 'Imprimer un test (chèque 176x80)',
            accelerator: 'Ctrl+Shift+P',
            click: () => {
              const testHtml = `<div style="width:176mm;height:80mm;padding:2mm;border:1px solid #000;font-family:Arial,sans-serif;font-size:20px;">
                <h3>TEST IMPRESSION CHÈQUE</h3>
                <p>Ceci est un test d'impression via Electron (IPC).</p>
                <p>Format : 176 × 80 mm</p>
              </div>`;
              const evt = { sender: mainWindow.webContents };
              ipcMain.emit('print-html', evt, { html: testHtml, w: 176, h: 80 });
            }
          },
          { role: 'reload' },
          { role: 'toggleDevTools' }
        ]
      }
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ---- Impression via IPC ----
// Dialogue d'impression intégré à l'app (style Chrome/Edge) : l'app affiche
// l'aperçu à gauche et les options imprimante/copies/couleur à droite, puis
// envoie directement à l'imprimante (silencieux, sans navigateur ni dialogue natif).
function envoyerResultat(event, resultat) {
  try {
    if (event && event.sender && !event.sender.isDestroyed()) {
      event.sender.send('print-result', resultat);
    }
  } catch (e) { /* le renderer peut être fermé */ }
}

// Liste des imprimantes système pour la liste déroulante "Destination"
ipcMain.handle('get-printers', async () => {
  try {
    const wc = mainWindow ? mainWindow.webContents : null;
    if (!wc) return [];
    const list = await wc.getPrintersAsync();
    return list.map((p) => ({
      name: p.name,
      displayName: (p.displayName || p.name || 'Imprimante'),
      isDefault: !!p.isDefault
    }));
  } catch (e) {
    console.log('[print] getPrinters a échoué', e);
    return [];
  }
});

// ==== Scans de chèques par banque (aperçu à l'écran uniquement) ====
// L'utilisateur scanne son chèque réel : stocké dans %APPDATA%\imprimcheques\cheques\{abbr}.{ext}
function dossierScans() { return path.join(app.getPath('appData'), 'imprimcheques', 'cheques'); }

// Import d'un scan : dialogue de sélection, copie dans le dossier dédié
ipcMain.handle('import-scan', async (event, abbr) => {
  const code = String(abbr || '').toLowerCase();
  if (!code) return { ok: false, error: 'Banque inconnue' };
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  const res = await dialog.showOpenDialog(win, {
    title: 'Importer le scan du chèque (' + code.toUpperCase() + ')',
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'webp', 'gif'] }]
  });
  if (res.canceled || !res.filePaths || !res.filePaths.length) return { ok: false, canceled: true };
  const src = res.filePaths[0];
  const ext = (path.extname(src) || '.png').slice(1).toLowerCase() || 'png';
  try {
    const dir = dossierScans();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const existing = fs.readdirSync(dir).filter((f) => f.toLowerCase().startsWith(code + '.'));
    for (const f of existing) { try { fs.unlinkSync(path.join(dir, f)); } catch (e) { /* ignore */ } }
    fs.copyFileSync(src, path.join(dir, code + '.' + ext));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
});

// Lecture d'un scan : renvoie une data URL (évite les blocages file:// avec webSecurity)
ipcMain.handle('get-cheque-scan', async (_event, abbr) => {
  const code = String(abbr || '').toLowerCase();
  if (!code) return '';
  const mimes = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', bmp: 'image/bmp', webp: 'image/webp', gif: 'image/gif' };
  try {
    const dir = dossierScans();
    if (!fs.existsSync(dir)) return '';
    const found = fs.readdirSync(dir).find((f) => f.toLowerCase().startsWith(code + '.'));
    if (!found) return '';
    const data = fs.readFileSync(path.join(dir, found));
    const mime = mimes[path.extname(found).slice(1).toLowerCase()] || 'image/png';
    return `data:${mime};base64,${data.toString('base64')}`;
  } catch (e) {
    return '';
  }
});

// Suppression d'un scan importé (retour à l'image par défaut / placeholder)
ipcMain.handle('remove-scan', async (_event, abbr) => {
  const code = String(abbr || '').toLowerCase();
  if (!code) return { ok: false };
  try {
    const dir = dossierScans();
    if (!fs.existsSync(dir)) return { ok: true };
    const existing = fs.readdirSync(dir).filter((f) => f.toLowerCase().startsWith(code + '.'));
    for (const f of existing) { try { fs.unlinkSync(path.join(dir, f)); } catch (e) { /* ignore */ } }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
});

// Fenêtre d'impression cachée contenant UNIQUEMENT le document (valeurs seules)
// offsetX / offsetY (mm) : décale l'ensemble des valeurs sur le papier pour caler
// l'impression sur le formulaire pré-imprimé (guide-papier / orientation 180°).
const CSS_IMPRESSION = (widthMm: number, heightMm: number) =>
  `@page{size:${widthMm}mm ${heightMm}mm;margin:0}*{margin:0;padding:0;box-sizing:border-box}html,body{width:${widthMm}mm;height:${heightMm}mm;margin:0;padding:0;background:#fff;font-family:Arial,sans-serif;overflow:hidden}body{display:flex;align-items:flex-start;justify-content:flex-start}`;

function creerFenetreImpression(html, widthMm, heightMm, deviceName, copies, color, offsetX, offsetY, cb) {
  const css = CSS_IMPRESSION(widthMm, heightMm);
  const decalage = (offsetX && offsetY)
    ? `<div style="width:${widthMm}mm;height:${heightMm}mm;transform:translate(${offsetX}mm,${offsetY}mm)">${html}</div>`
    : html;
  const doc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${decalage}</body></html>`;
  const file = path.join(os.tmpdir(), `imprimcheques_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.html`);
  try { fs.writeFileSync(file, doc, 'utf-8'); } catch (e) { cb('writeFailed:' + String(e && e.message || e)); return; }

  const win = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });

  const cleanup = () => {
    try { fs.unlinkSync(file); } catch (e) { /* déjà supprimé */ }
    if (!win.isDestroyed()) win.destroy();
  };

  win.loadFile(file).then(() => {
    setTimeout(() => {
      win.webContents.print(
        {
          silent: true,
          deviceName: deviceName || undefined,
          copies: Math.max(1, Number(copies) || 1),
          color: color !== false,
          printBackground: true
        },
        (success, reason) => {
          const res = success ? 'success' : (reason ? `printFailed:${reason}` : 'cancelled');
          console.log('[print] resultat ->', res);
          cleanup();
          cb(res);
        }
      );
    }, 350);
  }).catch((err) => {
    console.log('[print] chargement fenêtre échoué ->', String(err && err.message || err));
    cleanup();
    cb('loadFailed:' + String(err && err.message || err));
  });
}

ipcMain.on('print-html', (event, { html, w = 176, h = 80, deviceName, copies, color, offsetX, offsetY } = {}) => {
  const widthMm = Math.max(50, Number(w) || 176);
  const heightMm = Math.max(40, Number(h) || 80);
  const ox = parseFloat(offsetX) || 0;
  const oy = parseFloat(offsetY) || 0;
  creerFenetreImpression(String(html || ''), widthMm, heightMm, deviceName, copies, color, ox, oy, (resultat) => {
    if (resultat && resultat !== 'success' && resultat !== 'cancelled' && mainWindow && !mainWindow.isDestroyed()) {
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Impression',
        message: 'Échec de l\'impression',
        detail: resultat,
        buttons: ['OK']
      });
    }
    envoyerResultat(event, resultat);
  });
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});