const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

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
function envoyerResultat(event, resultat) {
  try {
    if (event && event.sender && !event.sender.isDestroyed()) {
      event.sender.send('print-result', resultat);
    }
  } catch (e) { /* le renderer peut être fermé */ }
}

ipcMain.on('print-html', (event, { html, w = 176, h = 80 } = {}) => {
  const widthMm = Math.max(50, Number(w) || 176);
  const heightMm = Math.max(40, Number(h) || 80);
  const wc = mainWindow ? mainWindow.webContents : null;
  if (!wc) { envoyerResultat(event, 'noMainWindow'); return; }

  // Imprimer depuis la fenêtre principale (visible et stable) pour que le dialogue
  // système Windows persiste. On y injecte un conteneur d'impression dédié.
  const css = `@page{size:${widthMm}mm ${heightMm}mm;margin:0}`;
  const js = `
    (function(){
      var old = document.getElementById('__printHost');
      if (old) old.parentNode.removeChild(old);
      var host = document.createElement('div');
      host.id = '__printHost';
      host.style.cssText = 'position:absolute;left:-9999px;top:0;width:${widthMm}mm;';
      host.innerHTML = '<style>${css} *{margin:0;padding:0;box-sizing:border-box} html,body{background:#fff;font-family:Arial,sans-serif} </style>' + ${JSON.stringify(html)};
      document.body.appendChild(host);
      return true;
    })()`;

  wc.executeJavaScript(js, true).then(() => {
    wc.print(
      {
        silent: false,
        printBackground: true
      },
      (success, failureReason) => {
        const res = success ? 'success' : (failureReason ? `printFailed:${failureReason}` : 'cancelled');
        console.log('[print] resultat ->', res);
        if (mainWindow && !mainWindow.isDestroyed()) {
          dialog.showMessageBox(mainWindow, {
            type: success ? 'info' : 'warning',
            title: 'Résultat impression',
            message: 'Résultat du print : ' + res,
            buttons: ['OK']
          });
        }
        envoyerResultat(event, res);
      }
    );
  }).catch((err) => {
    const msg = `injectFailed:${String(err && err.message || err)}`;
    console.log('[print] injection a échoué ->', msg);
    if (mainWindow && !mainWindow.isDestroyed()) {
      dialog.showMessageBox(mainWindow, { type: 'error', title: 'Impression', message: msg, buttons: ['OK'] });
    }
    envoyerResultat(event, msg);
    envoyerResultat(event, `injectFailed:${err && err.message ? err.message : String(err)}`);
  });
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});