/* ── Mise à jour automatique (portable Electron) ───────────────────────────
   Le manifeste vit sur le site marketing :
     <baseUrl>/updates/<slug>/manifest.json?ts=...
   { product, version, file, size?, sha256?, notes? }

   Si version distante > version locale :
     1. téléchargement du .exe dans %TEMP% (fenêtre de progression côté app),
     2. vérification taille + sha256 si fournis,
     3. script .cmd qui attend la fin du processus, remplace le .exe d'origine
        puis le relance (l'app est « portable » : un seul fichier .exe),
     4. l'app quitte — aucune action utilisateur requise.

   Tout échec = abandon silencieux (l'app continue de fonctionner).
   Fonctions pures exportées pour tests unitaires (pas d'require('electron')). */

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

/* remote > local ? (comparaison par segments numériques, 1.1.0 > 1.0.0) */
function isNewerVersion(remote, local) {
  const r = String(remote || "0").split(".").map((n) => parseInt(n, 10) || 0);
  const l = String(local || "0").split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(r.length, l.length); i++) {
    const a = r[i] || 0, b = l[i] || 0;
    if (a > b) return true;
    if (a < b) return false;
  }
  return false;
}

/* .exe « original » (celui du client, pas la copie extraite en %TEMP%) :
   electron-builder portable exporte PORTABLE_EXECUTABLE_FILE/_DIR. */
function resolveOriginalExe(env, execPath, fileName) {
  const e = env || {};
  if (e.PORTABLE_EXECUTABLE_FILE) return e.PORTABLE_EXECUTABLE_FILE;
  if (e.PORTABLE_EXECUTABLE_DIR) return path.join(e.PORTABLE_EXECUTABLE_DIR, fileName);
  return execPath;
}

/* GET → Buffer (avec redirections limitées) */
function fetchBuffer(url, redirects) {
  redirects = redirects === undefined ? 3 : redirects;
  return new Promise((resolve, reject) => {
    const mod = String(url).startsWith("https") ? https : http;
    const req = mod.get(url, { timeout: 20000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
        res.resume();
        return resolve(fetchBuffer(new URL(res.headers.location, url).toString(), redirects - 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error("HTTP " + res.statusCode)); }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}

/* Téléchargement vers un fichier avec progression (0..1) */
function downloadToFile(url, dest, onProgress, redirects) {
  redirects = redirects === undefined ? 3 : redirects;
  return new Promise((resolve, reject) => {
    const mod = String(url).startsWith("https") ? https : http;
    const req = mod.get(url, { timeout: 60000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
        res.resume();
        return resolve(downloadToFile(new URL(res.headers.location, url).toString(), dest, onProgress, redirects - 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error("HTTP " + res.statusCode)); }
      const total = parseInt(res.headers["content-length"] || "0", 10) || 0;
      let got = 0;
      const out = fs.createWriteStream(dest);
      res.on("data", (c) => {
        got += c.length;
        if (onProgress && total) onProgress(Math.min(1, got / total), got, total);
      });
      res.pipe(out);
      out.on("finish", () => out.close(() => resolve({ size: got, total })));
      out.on("error", reject);
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}

function sha256File(file) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash("sha256");
    const s = fs.createReadStream(file);
    s.on("data", (c) => h.update(c));
    s.on("end", () => resolve(h.digest("hex")));
    s.on("error", reject);
  });
}

/* Script ANSI/ASCII pur (lu par cmd.exe — jamais d'accents/unicode) :
   attend la fin du processus, remplace le .exe, le relance, se supprime. */
function buildReplaceScript(pid, newFile, originalExe) {
  const q = (p) => '"' + String(p).replace(/"/g, '""') + '"';
  return [
    "@echo off",
    "setlocal enableextensions",
    ":wait",
    "tasklist /FI \"PID eq " + pid + "\" 2>nul | find \"" + pid + "\" >nul",
    "if not errorlevel 1 (",
    "  timeout /t 1 /nobreak >nul",
    "  goto wait",
    ")",
    "move /Y " + q(newFile) + " " + q(originalExe) + " >nul 2>&1",
    "if errorlevel 1 copy /Y " + q(newFile) + " " + q(originalExe) + " >nul 2>&1",
    "start \"\" " + q(originalExe),
    "del /F /Q " + q(newFile) + " >nul 2>&1",
    "(goto) 2>nul & del \"%~f0\"",
    ""
  ].join("\r\n");
}

/* Écrit le script .cmd (ASCII) et le lance détaché */
function launchReplaceScript(pid, newFile, originalExe, scriptPath) {
  fs.writeFileSync(scriptPath, buildReplaceScript(pid, newFile, originalExe), "ascii");
  const child = spawn("cmd.exe", ["/c", scriptPath], {
    detached: true, windowsHide: true, stdio: "ignore",
  });
  child.unref();
  return scriptPath;
}

/* Flux complet. opts :
   baseUrl, slug, fileName (nom du .exe chez le client),
   currentVersion, isPackaged, tmpDir,
   onStart(), onProgress(pct), dryRun,
   quit() (appeler pour fermer l'app après lancement du script)
   Retour : { update:false } | { update:true, version, applied? } | null (erreur) */
async function startAutoUpdate(opts) {
  try {
    if (!opts.isPackaged && !opts.dryRun) return { update: false, skipped: "dev" };
    const base = String(opts.baseUrl).replace(/\/+$/, "");
    const manUrl = base + "/updates/" + opts.slug + "/manifest.json?ts=" + Date.now();
    const man = JSON.parse((await fetchBuffer(manUrl)).toString("utf8"));
    if (!man || !man.version || !isNewerVersion(man.version, opts.currentVersion)) {
      return { update: false, remote: man && man.version, local: opts.currentVersion };
    }
    const fileUrl = new URL(man.file || opts.fileName, manUrl).toString();
    const dest = path.join(opts.tmpDir || require("os").tmpdir(),
      (opts.slug || "app") + "-update-" + Date.now() + ".exe");
    if (opts.onStart) opts.onStart();
    await downloadToFile(fileUrl, dest, opts.onProgress);
    const size = fs.statSync(dest).size;
    if (man.size && size !== Number(man.size)) throw new Error("taille invalide (" + size + " != " + man.size + ")");
    if (man.sha256) {
      const got = await sha256File(dest);
      if (got.toLowerCase() !== String(man.sha256).toLowerCase()) throw new Error("sha256 invalide");
    }
    if (opts.dryRun) return { update: true, version: man.version, dest, size };
    const original = resolveOriginalExe(process.env, process.execPath, opts.fileName);
    const script = path.join(opts.tmpDir || require("os").tmpdir(),
      (opts.slug || "app") + "-replace.cmd");
    launchReplaceScript(process.pid, dest, original, script);
    if (opts.quit) opts.quit();
    return { update: true, version: man.version, applied: true, original };
  } catch (e) {
    console.log("[update] abandon:", e && e.message);
    return null;
  }
}

module.exports = {
  isNewerVersion,
  resolveOriginalExe,
  fetchBuffer,
  downloadToFile,
  sha256File,
  buildReplaceScript,
  launchReplaceScript,
  startAutoUpdate,
};
