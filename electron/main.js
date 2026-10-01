const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

/* ── Mise à jour automatique ──────────────────────────────────────────────
   Au lancement (après 12 s), l'app vérifie le manifeste du site :
   <UPDATE_BASE>/updates/<slug>/manifest.json → si version plus récente,
   téléchargement + remplacement du .exe + redémarrage, tout seul.
   ⚠️ UPDATE_BASE = URL du site marketing — à changer en https://… quand
   le site sera en ligne public (idem SAV_URL dans frontend/src/ChequesApp.tsx). */
const UPDATE_BASE = 'http://localhost:8020';
const UPDATE_SLUG = 'imprime-chequetraite';
const UPDATE_FILE = 'ImprimChequesTraites.exe';

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

// Version de l'app (affichée dans Licence) + ouverture d'un lien dans le navigateur
ipcMain.handle('get-version', () => {
  try { return app.getVersion(); } catch (e) { return ''; }
});

ipcMain.handle('open-external', (_event, url) => {
  try {
    const u = String(url || '');
    if (/^https?:\/\//i.test(u)) { shell.openExternal(u); return true; }
    return false;
  } catch (e) { return false; }
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
const CSS_IMPRESSION = (widthMm, heightMm) =>
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

/* ── Mise à jour automatique : vérifie le site, télécharge, remplace, relance ── */
function startUpdateCheck() {
  const updater = require('./updater');
  let updWin = null;
  const html = "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><style>"
    + "body{margin:0;background:#1f1a14;color:#fff;font:14px/1.45 'Segoe UI',sans-serif;"
    + "display:flex;align-items:center;justify-content:center;height:100vh;-webkit-user-select:none}"
    + ".card{width:100%;padding:20px 24px;box-sizing:border-box}"
    + "h4{margin:0 0 6px;font-size:15px}p{margin:0 0 12px;font-size:12.5px;opacity:.75}"
    + ".bar{height:8px;background:rgba(255,255,255,.14);border-radius:99px;overflow:hidden}"
    + ".fill{height:100%;width:0;background:linear-gradient(90deg,#2563eb,#60a5fa);border-radius:99px;transition:width .25s}"
    + ".pct{margin-top:8px;font-size:12px;opacity:.8;text-align:right}"
    + "</style></head><body><div class=\"card\"><h4>Mise à jour automatique…</h4>"
    + "<p>Téléchargement de la nouvelle version — l'application redémarrera toute seule.</p>"
    + "<div class=\"bar\"><div class=\"fill\" id=\"f\"></div></div>"
    + "<div class=\"pct\" id=\"p\">0 %</div>"
    + "<script>function setPct(p){document.getElementById('f').style.width=p+'%';"
    + "document.getElementById('p').textContent=p+' %'}</script></div></body></html>";
  updater.startAutoUpdate({
    baseUrl: UPDATE_BASE,
    slug: UPDATE_SLUG,
    fileName: UPDATE_FILE,
    currentVersion: app.getVersion(),
    isPackaged: app.isPackaged,
    onStart: function () {
      try {
        updWin = new BrowserWindow({
          width: 440, height: 170, resizable: false, frame: false,
          alwaysOnTop: true, minimizable: false, maximizable: false,
          center: true, title: 'Mise à jour',
          webPreferences: { nodeIntegration: false, contextIsolation: true },
        });
        updWin.on('closed', function () { updWin = null; });
        updWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
      } catch (e) { updWin = null; }
    },
    onProgress: function (pct) {
      if (updWin && !updWin.isDestroyed()) {
        updWin.webContents
          .executeJavaScript('setPct(' + Math.round((pct || 0) * 100) + ')')
          .catch(function () {});
      }
    },
    quit: function () {
      try { if (updWin && !updWin.isDestroyed()) updWin.destroy(); } catch (e) { /* ignore */ }
      app.quit();
    },
  }).catch(function (e) {
    console.log('[update] abandon:', e && e.message);
  });
}

app.whenReady().then(() => {
  createWindow();
  setTimeout(startUpdateCheck, 12000); // vérification mise à jour (lancement calme)
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});