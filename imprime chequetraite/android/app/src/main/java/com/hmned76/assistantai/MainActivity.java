package com.hmned76.assistantai;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.BroadcastReceiver;
import android.content.IntentFilter;
import android.content.Context;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.ProgressBar;
import android.location.Location;
import android.location.LocationManager;

import java.util.ArrayList;
import java.util.Locale;

import android.util.Log;

public class MainActivity extends Activity {

    private WebView webView;
    private ProgressBar progressBar;

    // La version vient du build.gradle (versionName) pour rester a jour
    // a chaque build (incremente via gradle.properties / build.gradle).
    public static final String VERSION = "" + BuildConfig.VERSION_NAME;

    // Mode AUTONOME (Option A) : l'app appelle directement l'IA sur OpenRouter,
    // SANS avoir besoin du PC ni du tunnel. Le PC (serveur Flask) est uniquement
    // utilise pour SYNCHRONISER les discussions quand il est allume.
    private static final String OPENROUTER_KEY = "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";
    private static final String OPENROUTER_MODEL = "minimax/minimax-m3:free";
    private static final String OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
    private static final String TAG = "AssistantAI";

    private android.media.MediaRecorder enregistreur;
    private java.io.File fichierAudio;
    private boolean enAttente = false;
    private boolean enEcoute = false;
    private String lastCallNumber = "";

    private TextToSpeech tts;
    private static String lastMeteoVille = "";
    private static String lastMeteoCache = null;
    private static long lastMeteoTs = 0;
    private BroadcastReceiver wakeReceiver;
    private android.media.MediaPlayer lecteur;

    public static final String[] PERMISSIONS = {
        Manifest.permission.READ_CONTACTS,
        Manifest.permission.WRITE_CONTACTS,
        Manifest.permission.CALL_PHONE,
        Manifest.permission.READ_PHONE_STATE,
        Manifest.permission.SEND_SMS,
        Manifest.permission.RECEIVE_SMS,
        Manifest.permission.READ_SMS,
        Manifest.permission.ACCESS_FINE_LOCATION,
        Manifest.permission.ACCESS_COARSE_LOCATION,
        Manifest.permission.RECORD_AUDIO,
        Manifest.permission.CAMERA,
        Manifest.permission.POST_NOTIFICATIONS,
        Manifest.permission.READ_EXTERNAL_STORAGE,
        Manifest.permission.WRITE_EXTERNAL_STORAGE,
        Manifest.permission.SYSTEM_ALERT_WINDOW,
        Manifest.permission.FOREGROUND_SERVICE,
        Manifest.permission.REQUEST_INSTALL_PACKAGES,
        Manifest.permission.ACTIVITY_RECOGNITION
    };

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        progressBar = findViewById(R.id.progressBar);
        webView = findViewById(R.id.webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setTextZoom(100);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        webView.clearCache(true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                view.loadUrl(request.getUrl().toString());
                return true;
            }

            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                super.onReceivedError(view, errorCode, description, failingUrl);
                runOnUiThread(() -> ouvrirConfiguration("Connexion impossible. Vérifie l'adresse du serveur :"));
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progressBar.setProgress(newProgress);
                progressBar.setVisibility(newProgress == 100 ? View.GONE : View.VISIBLE);
            }
        });

        webView.addJavascriptInterface(new PontIOS(), "AndroidIOS");

        loadUrlWrapper();

        demanderPermissions();
        handleWakeIntent(getIntent());
        // Auto-start WakeWordService désactivé : évite l'écoute continue et les bips parasites
        // startWakeService();
        registerWakeReceiver();
    }

    private void handleWakeIntent(Intent intent) {
        if (intent == null) return;
        String q = intent.getStringExtra("wake_question");
        if (q != null && !q.trim().isEmpty()) {
            String qq = q.trim();
            evaluerJS("window.__asrResult(" + quote(qq) + ")");
            new Thread(() -> {
                String r = demanderIA(qq);
                evaluerJS("window.__iaReponse(" + quote(convJSON(r)) + ",'')");
                lireText(r);
            }).start();
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleWakeIntent(intent);
    }

    private void registerWakeReceiver() {
        wakeReceiver = new BroadcastReceiver() {
            @Override public void onReceive(Context ctx, Intent intent) {
                String q = intent.getStringExtra("question");
                if (q != null) handleWakeIntent(new Intent().putExtra("wake_question", q));
            }
        };
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(wakeReceiver, new IntentFilter("com.hmned76.assistantai.WAKE_QUESTION"), Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(wakeReceiver, new IntentFilter("com.hmned76.assistantai.WAKE_QUESTION"));
        }
    }

    private void startWakeService() {
        Intent s = new Intent(this, WakeWordService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(s); else startService(s);
    }

    private void stopWakeService() {
        try { stopService(new Intent(this, WakeWordService.class)); } catch (Exception ignored) {}
    }

    // ------------------------------------------------------------------
    // Pont JavaScript <-> Android (bouton micro + haut-parleur)
    // ------------------------------------------------------------------
    private class PontIOS {
        @JavascriptInterface
        public void ecouter() {
            Log.d("HmiedApp", "ecouter() appele par JS");
            runOnUiThread(() -> demarrerEcoutE());
        }

        @JavascriptInterface
        public void arreter() {
            runOnUiThread(() -> stopperEcoutE());
        }

        @JavascriptInterface
        public void parler(String texte) {
            lireText(texte);
        }

        @JavascriptInterface
        public void choisirVoix() {
            runOnUiThread(MainActivity.this::afficherChoixVoix);
        }

        @JavascriptInterface
        public String getVersion() {
            return VERSION;
        }

        @JavascriptInterface
        public String getToken() {
            return token();
        }

        @JavascriptInterface
        public String getUrl() {
            return getSharedPreferences("assistant", MODE_PRIVATE).getString("url", "");
        }

        @JavascriptInterface
        public void ouvrirSite(String url) {
            if (url == null || url.trim().isEmpty()) return;
            final String u = url.trim();
            runOnUiThread(() -> {
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(u));
                    startActivity(intent);
                } catch (Exception e) {
                    // Repli : charger dans la WebView
                    webView.loadUrl(u);
                }
            });
        }

        @JavascriptInterface
        public void appeler(String numero) {
            faireAppel(numero);
        }

        @JavascriptInterface
        public void poserQuestion(String question) {
            // Mode autonome : l'app interroge l'IA directement (sans PC).
            new Thread(() -> {
                String r = demanderIA(question);
                evaluerJS("window.__iaReponse(" + quote(convJSON(r)) + ",'')");
            }).start();
        }

        @JavascriptInterface
        public String chargerHistorique() {
            return MainActivity.this.chargerHistorique();
        }

        @JavascriptInterface
        public void sauverMessage(String role, String texte) {
            MainActivity.this.sauverMessage(role, texte);
        }

        @JavascriptInterface
        public void viderHistorique() {
            MainActivity.this.viderHistorique();
        }

        @JavascriptInterface
        public void synchroniser() {
            MainActivity.this.synchroniser();
        }
    }

    private void demarrerEcoutE() {
        Log.d("HmiedApp", "demarrerEcoutE (permission="
                + (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? checkSelfPermission(Manifest.permission.RECORD_AUDIO) : -1) + ")");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
                checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            enAttente = true;
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, 100);
            return;
        }
        if (enEcoute) {
            Log.d("HmiedApp", "deja en enregistrement, ignore");
            return;
        }
        try {
            enEcoute = true;
            fichierAudio = new java.io.File(getCacheDir(), "hmied_perso.m4a");
            if (fichierAudio.exists()) fichierAudio.delete();
            enregistreur = new android.media.MediaRecorder();
            enregistreur.setAudioSource(android.media.MediaRecorder.AudioSource.VOICE_RECOGNITION);
            enregistreur.setOutputFormat(android.media.MediaRecorder.OutputFormat.MPEG_4);
            enregistreur.setAudioEncoder(android.media.MediaRecorder.AudioEncoder.AAC);
            enregistreur.setAudioSamplingRate(44100);
            enregistreur.setAudioEncodingBitRate(96000);
            enregistreur.setOutputFile(fichierAudio.getAbsolutePath());
            enregistreur.prepare();
            enregistreur.start();
            Log.d("HmiedApp", "enregistrement demarre");
            evaluerJS("window.__asrInterim('🎙️ Enregistrement… parle, puis appuie 🎤 pour envoyer')");
        } catch (Exception e) {
            enEcoute = false;
            Log.e("HmiedApp", "echec enregistrement", e);
            evaluerJS("window.__asrErreur('" + esc(e.getMessage()) + "')");
        }
    }

    private void stopperEcoutE() {
        if (!enEcoute) {
            return;
        }
        enEcoute = false;
        try {
            if (enregistreur != null) {
                enregistreur.stop();
                enregistreur.reset();
                enregistreur.release();
                enregistreur = null;
            }
        } catch (Exception e) {
            Log.w("HmiedApp", "stop enregistreur", e);
        }
        if (fichierAudio == null || !fichierAudio.exists() || fichierAudio.length() < 200) {
            evaluerJS("window.__asrErreur('Tu n'as rien dit. Réessaie.')");
            return;
        }
        evaluerJS("window.__asrInterim('🧠 Transcription en cours…')");
        new Thread(this::envoyerAudioServeur).start();
    }

    private void envoyerAudioServeur() {
        try {
            byte[] audio = lireFichier(fichierAudio);
            String base = getSharedPreferences("assistant", MODE_PRIVATE).getString("url", "");
            if (base.isEmpty()) throw new Exception("Adresse du serveur non configurée.");
            String hote = base.replaceAll("/+$", "");
            java.net.URL url = new java.net.URL(hote + "/api/stt");
            java.net.HttpURLConnection c = (java.net.HttpURLConnection) url.openConnection();
            c.setRequestMethod("POST");
            c.setRequestProperty("Content-Type", "audio/mp4");
            c.setRequestProperty("X-Auth-Token", token());
            c.setDoOutput(true);
            c.setConnectTimeout(15000);
            c.setReadTimeout(120000);
            try (java.io.OutputStream os = c.getOutputStream()) {
                os.write(audio);
            }
            int code = c.getResponseCode();
            String rep = lireReponse(c, code);
            if (code == 200) {
                org.json.JSONObject j = new org.json.JSONObject(rep);
                String texte = j.optString("texte", "").trim();
                Log.d("HmiedApp", "stt -> [" + texte + "]");
                if (texte.isEmpty()) {
                    evaluerJS("window.__asrErreur('Je n'ai pas compris. Réessaie.')");
                } else {
                    evaluerJS("window.__asrResult(" + quote(texte) + ")");
                }
            } else {
                Log.w("HmiedApp", "stt http " + code + " " + rep);
                evaluerJS("window.__asrErreur('Erreur serveur (" + code + "). Réessaie.')");
            }
        } catch (Exception e) {
            Log.e("HmiedApp", "stt exception", e);
            evaluerJS("window.__asrErreur('" + esc(e.getMessage()) + "')");
        }
    }

    private byte[] lireFichier(java.io.File f) throws Exception {
        java.io.ByteArrayOutputStream b = new java.io.ByteArrayOutputStream();
        try (java.io.FileInputStream in = new java.io.FileInputStream(f)) {
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) b.write(buf, 0, n);
        }
        return b.toByteArray();
    }

    private String lireReponse(java.net.HttpURLConnection c, int code) throws Exception {
        java.io.InputStream in = (code >= 200 && code < 300)
                ? c.getInputStream() : c.getErrorStream();
        if (in == null) return "";
        java.io.ByteArrayOutputStream b = new java.io.ByteArrayOutputStream();
        byte[] buf = new byte[4096];
        int n;
        while ((n = in.read(buf)) > 0) b.write(buf, 0, n);
        return new String(b.toByteArray(), "UTF-8");
    }

    // Token securite lu depuis les prefs (configure par relancer.ps1)
    private String token() {
        return getSharedPreferences("assistant", MODE_PRIVATE).getString("token", "");
    }

    private void lireText(String texte) {
        if (texte == null || texte.isEmpty()) return;
        jouerVoixServeur(texte);
    }

    private void jouerVoixServeur(String texte) {
        new Thread(() -> {
            try {
                byte[] audio = appelerTTS(texte);
                if (audio == null || audio.length < 1000) throw new Exception("audio trop court");
                final java.io.File f = new java.io.File(getCacheDir(), "hmied_voix.mp3");
                try (java.io.FileOutputStream os = new java.io.FileOutputStream(f)) {
                    os.write(audio);
                }
                runOnUiThread(() -> {
                    try {
                        if (lecteur != null) {
                            try { lecteur.stop(); lecteur.release(); } catch (Exception ignored) {}
                        }
                        lecteur = new android.media.MediaPlayer();
                        lecteur.setDataSource(f.getAbsolutePath());
                        lecteur.setOnPreparedListener(p -> p.start());
                        lecteur.setOnCompletionListener(p -> { p.release(); lecteur = null; });
                        lecteur.setOnErrorListener((p, w, e) -> { p.release(); lecteur = null; return true; });
                        lecteur.prepareAsync();
                    } catch (Exception e) {
                        lireLocalement(texte);
                    }
                });
            } catch (Exception e) {
                Log.w("HmiedApp", "tts serveur indisponible, repli local");
                lireLocalement(texte);
            }
        }).start();
    }

    private byte[] appelerTTS(String texte) throws Exception {
        String base = getSharedPreferences("assistant", MODE_PRIVATE).getString("url", "");
        if (base.isEmpty()) throw new Exception("Adresse non configurée.");
        String hote = base.replaceAll("/+$", "");
        java.net.URL url = new java.net.URL(hote + "/api/tts");
        java.net.HttpURLConnection c = (java.net.HttpURLConnection) url.openConnection();
        c.setRequestMethod("POST");
        c.setRequestProperty("Content-Type", "application/json");
        c.setRequestProperty("X-Auth-Token", token());
        c.setDoOutput(true);
        c.setConnectTimeout(10000);
        c.setReadTimeout(60000);
        try (java.io.OutputStream os = c.getOutputStream()) {
            os.write(("{\"texte\":" + quote(texte) + "}").getBytes("UTF-8"));
        }
        int code = c.getResponseCode();
        if (code != 200) throw new Exception("serveur " + code);
        java.io.InputStream in = c.getInputStream();
        java.io.ByteArrayOutputStream b = new java.io.ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) > 0) b.write(buf, 0, n);
        return b.toByteArray();
    }

    private void lireLocalement(String texte) {
        runOnUiThread(() -> {
            try {
                if (tts == null) {
                    tts = new TextToSpeech(this, statut -> {
                        if (statut == TextToSpeech.SUCCESS) lireAvecBonneVoix(texte);
                    });
                } else {
                    lireAvecBonneVoix(texte);
                }
            } catch (Exception ignored) {}
        });
    }

    private void lireAvecBonneVoix(String texte) {
        // Texte arabe (transcription tunisienne) -> voix arabe ; sinon voix francaise
        boolean arabe = texte.matches(".*[\\u0600-\\u06FF].*");
        preparerVoixHomme(arabe ? "ar" : "fr");
        tts.speak(texte, TextToSpeech.QUEUE_FLUSH, null, "assistantai");
    }

    private void preparerVoixHomme(String langue) {
        try {
            SharedPreferences sp = getSharedPreferences("assistant", MODE_PRIVATE);
            String nomVoix = sp.getString("voix", "");
            float p = sp.getFloat("pitch", 0.85f);
            if (p < 0.8f) p = 0.8f;
            tts.setPitch(p);
            tts.setSpeechRate(0.95f);
            if (!nomVoix.isEmpty()) {
                for (android.speech.tts.Voice v : tts.getVoices()) {
                    if (v.getName() != null && v.getName().equals(nomVoix)) {
                        tts.setVoice(v);
                        return;
                    }
                }
            }
            // Voix masculine dans la langue du texte, sinon premiere voix de cette langue
            android.speech.tts.Voice reserve = null;
            for (android.speech.tts.Voice v : tts.getVoices()) {
                String n = (v.getName() == null ? "" : v.getName().toLowerCase());
                String l = (v.getLocale() == null ? "" : v.getLocale().getLanguage());
                if (!l.equals(langue)) continue;
                if (reserve == null) reserve = v;
                if (n.contains("male")) {
                    tts.setVoice(v);
                    Log.d("HmiedApp", "voix choisie: " + v.getName() + " (" + langue + ")");
                    return;
                }
            }
            if (reserve != null) {
                tts.setVoice(reserve);
                Log.d("HmiedApp", "voix choisie: " + reserve.getName() + " (" + langue + ")");
            }
        } catch (Exception ignored) {}
    }

    private static final String PHRASE_TEST_VOIX =
        "صحة، أنا حميد. كيفاش نعاونك اليوم؟";

    private void afficherChoixVoix() {
        try {
            if (tts == null) {
                tts = new TextToSpeech(this, st -> {
                    if (st == TextToSpeech.SUCCESS) afficherChoixVoix();
                });
                return;
            }
            // Seules les voix arabe et française, voix masculine en premier, max 4 par langue
            String[] languesPref = {"fr", "ar"};
            final java.util.List<android.speech.tts.Voice> liste = new ArrayList<>();
            for (String lang : languesPref) {
                java.util.List<android.speech.tts.Voice> groupe = new ArrayList<>();
                for (android.speech.tts.Voice v : tts.getVoices()) {
                    String l = v.getLocale() == null ? "" : v.getLocale().getLanguage();
                    if (lang.equals(l)) {
                        String n = v.getName() == null ? "" : v.getName().toLowerCase();
                        if (n.contains("male")) groupe.add(0, v);
                        else groupe.add(v);
                    }
                }
                for (int k = 0; k < groupe.size() && k < 4; k++) liste.add(groupe.get(k));
            }
            for (android.speech.tts.Voice v : tts.getVoices()) {
                if (liste.size() < 1 && v.getLocale() == null) liste.add(v);
            }
            Log.d("HmiedApp", "choix voix -> " + liste.size() + " voix (fr/ar seulement)");
            for (android.speech.tts.Voice v : tts.getVoices()) {
                Log.d("HmiedApp", "voix dispo: " + (v.getName() == null ? "?" : v.getName())
                        + " lang=" + (v.getLocale() == null ? "null" : v.getLocale().getLanguage()));
            }
            if (liste.isEmpty()) {
                toast("Aucune voix installée sur ce téléphone.");
                return;
            }

            final float[] pitch = {getSharedPreferences("assistant", MODE_PRIVATE).getFloat("pitch", 0.85f)};
            final String[] choixNom = {getSharedPreferences("assistant", MODE_PRIVATE).getString("voix", "")};

            android.widget.LinearLayout root = new android.widget.LinearLayout(this);
            root.setOrientation(android.widget.LinearLayout.VERTICAL);
            root.setPadding(40, 20, 40, 8);

            final android.widget.RadioGroup rg = new android.widget.RadioGroup(this);
            rg.setOrientation(android.widget.RadioGroup.VERTICAL);
            for (int i = 0; i < liste.size(); i++) {
                android.speech.tts.Voice v = liste.get(i);
                android.widget.RadioButton rb = new android.widget.RadioButton(this);
                String label = (v.getName() == null ? "?" : v.getName())
                        + "  (" + (v.getLocale() == null ? "?" : v.getLocale()) + ")";
                rb.setText(label);
                rb.setTag(v);
                rb.setChecked(v.getName() != null && v.getName().equals(choixNom[0]));
                final int idx = i;
                rb.setOnCheckedChangeListener((btn, checked) -> {
                    if (checked) {
                        choixNom[0] = liste.get(idx).getName();
                        essayerVoix(liste.get(idx), pitch[0]);
                    }
                });
                rg.addView(rb);
            }

            android.widget.TextView lblPitch = new android.widget.TextView(this);
            lblPitch.setText("Ton de la voix : " + Math.round(pitch[0] * 100) + " %");
            lblPitch.setPadding(0, 12, 0, 12);

            android.widget.LinearLayout row = new android.widget.LinearLayout(this);
            row.setOrientation(android.widget.LinearLayout.HORIZONTAL);
            android.widget.Button bGrave = new android.widget.Button(this);
            bGrave.setText("＋ Grave");
            bGrave.setOnClickListener(v -> {
                pitch[0] = Math.max(0.4f, pitch[0] - 0.08f);
                lblPitch.setText("Ton de la voix : " + Math.round(pitch[0] * 100) + " %");
                essayerVoix(lg_voix_choisie(rg, liste), pitch[0]);
            });
            android.widget.Button bAigu = new android.widget.Button(this);
            bAigu.setText("＋ Aigu");
            bAigu.setOnClickListener(v -> {
                pitch[0] = Math.min(1.6f, pitch[0] + 0.08f);
                lblPitch.setText("Ton de la voix : " + Math.round(pitch[0] * 100) + " %");
                essayerVoix(lg_voix_choisie(rg, liste), pitch[0]);
            });
            android.widget.Button bTest = new android.widget.Button(this);
            bTest.setText("▶ Tester");
            bTest.setOnClickListener(v -> essayerVoix(lg_voix_choisie(rg, liste), pitch[0]));
            row.addView(bGrave);
            row.addView(bAigu);
            row.addView(bTest);

            android.widget.ScrollView sc = new android.widget.ScrollView(this);
            sc.addView(root);
            root.addView(rg);
            root.addView(lblPitch);
            root.addView(row);

            new android.app.AlertDialog.Builder(this)
                    .setTitle("Choisis la voix de Hmied 🎙️")
                    .setView(sc)
                    .setPositiveButton("OK - garder", (d, w) -> {
                        getSharedPreferences("assistant", MODE_PRIVATE)
                                .edit().putString("voix", choixNom[0] == null ? "" : choixNom[0])
                                .putFloat("pitch", pitch[0]).apply();
                    })
                    .setNeutralButton("Fermer", null)
                    .show();
        } catch (Exception e) {
            toast("Erreur avec le moteur vocal : " + e.getMessage());
        }
    }

    private android.speech.tts.Voice lg_voix_choisie(android.widget.RadioGroup rg, java.util.List<android.speech.tts.Voice> liste) {
        int id = rg.getCheckedRadioButtonId();
        for (int i = 0; i < rg.getChildCount(); i++) {
            android.view.View v = rg.getChildAt(i);
            if (v.getId() == id && v instanceof android.widget.RadioButton) {
                return (android.speech.tts.Voice) v.getTag();
            }
        }
        return liste.isEmpty() ? null : liste.get(0);
    }

    private void essayerVoix(android.speech.tts.Voice v, float pitch) {
        try {
            if (v == null) return;
            tts.setVoice(v);
            tts.setPitch(pitch);
            tts.setSpeechRate(0.95f);
            tts.speak(PHRASE_TEST_VOIX, TextToSpeech.QUEUE_FLUSH, null, "test");
        } catch (Exception ignored) {}
    }

    private void toast(String m) {
        runOnUiThread(() -> android.widget.Toast.makeText(this, m, android.widget.Toast.LENGTH_LONG).show());
    }

    private void evaluerJS(String js) {
        runOnUiThread(() -> {
            if (webView != null) webView.evaluateJavascript(js, null);
        });
    }

    private String quote(String s) {
        StringBuilder sb = new StringBuilder("\"");
        for (char c : s.toCharArray()) {
            switch (c) {
                case '"': sb.append("\\\""); break;
                case '\\': sb.append("\\\\"); break;
                case '\n': sb.append("\\n"); break;
                case '\r': break;
                default: sb.append(c);
            }
        }
        return sb.append('"').toString();
    }

    private String esc(String s) {
        if (s == null) return "";
        return s.replace("\\", "").replace("'", "").replace("\"", "");
    }

    // ------------------------------------------------------------------
    // Mode autonome : appel direct a l'IA (OpenRouter) depuis le telephone.
    // ------------------------------------------------------------------
    // Meteo sans PC : appelle Open-Meteo (aucune cle). Retourne null si le
    // message ne demande pas la meteo. Detecte francais + arabe (الطقس/الجو).
    private String demandeMeteo(String question) {
        String t = question.toLowerCase();
        boolean demande = t.contains("meteo") || t.contains("météo") || t.contains("weather")
                || t.contains("quel temps") || t.contains("il fait quoi")
                || t.contains("temperature") || t.contains("احوال") || t.contains("حالة")
                || t.indexOf("طقس") >= 0 || t.indexOf("الجو") >= 0 || t.indexOf("حرارة") >= 0;
        if (!demande) return null;
        String ville = null;
        // prendre la DERNIERE preposition (a Paris demain -> Paris, pas demain)
        String[] prepsFr = {"a ", "à ", "de ", "en ", "sur ", "pour "};
        int bestIdx = -1; String bestPrep = null;
        for (String p : prepsFr) {
            int i = t.lastIndexOf(p);
            if (i > bestIdx) { bestIdx = i; bestPrep = p; }
        }
        if (bestIdx >= 0) ville = t.substring(bestIdx + bestPrep.length()).trim();
        if (ville == null) {
            int f = t.lastIndexOf("في");
            if (f >= 0) ville = t.substring(f + 2).trim();
        }
        // fallback: dernier mot si pas de preposition (ex: meteo sfax)
        if (ville == null) {
            String[] mots = t.split("[^\\p{L}]+");
            for (int k = mots.length-1; k>=0; k--) {
                String w = mots[k].trim();
                if (w.length()>=3 && !w.equals("meteo") && !w.equals("météo") && !w.equals("temps") && !w.equals("climat") && !w.equals("donne") && !w.equals("quelle") && !w.equals("moi") && !w.equals("la") && !w.equals("le") && !w.equals("ma") && !w.equals("mon")) { ville=w; break; }
            }
        }
        if (ville == null) ville = "Tunis";
        // ne garder que le premier mot (ville) et nettoyer
        ville = ville.split("[^\\p{L}'-]+")[0].trim();
        ville = ville.replaceAll("[^\\p{L}'-]", "").trim();
        if (ville.isEmpty()) ville = "Tunis";
        // si aucune ville explicite et que la ville par defaut est Tunis, utiliser la localisation GPS
        boolean hasExplicitCity = t.contains("tunis") || t.indexOf("تونس") >= 0 || t.contains("sfax") || t.contains("sousse") || t.contains("paris") || t.contains("nabeul") || ville.length()>=3 && !ville.equalsIgnoreCase("Tunis");
        // heuriistique simple: si ville == Tunis par defaut et que le texte ne mentionne pas Tunis, essayer GPS
        if (ville.equalsIgnoreCase("Tunis") && !t.contains("tunis") && t.indexOf("تونس") < 0) {
            String viaGps = meteoViaLocation();
            if (viaGps != null) return viaGps;
        }
        return meteoOpenMeteo(ville);
    }

    private String meteoViaLocation() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED && checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) return null;
            LocationManager lm = (LocationManager) getSystemService(LOCATION_SERVICE);
            Location loc = null;
            try { if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) loc = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER); } catch (Exception ignored) {}
            if (loc == null) try { if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) loc = lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER); } catch (Exception ignored) {}
            if (loc == null) return null;
            double lat = loc.getLatitude(), lon = loc.getLongitude();
            java.net.HttpURLConnection f = (java.net.HttpURLConnection) new java.net.URL("https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lon + "&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1").openConnection();
            f.setRequestMethod("GET"); f.setConnectTimeout(6000); f.setReadTimeout(6000);
            int fcode = f.getResponseCode();
            org.json.JSONObject fj = new org.json.JSONObject(lireReponse(f, fcode));
            org.json.JSONObject cur = fj.getJSONObject("current");
            double t2m = cur.getDouble("temperature_2m");
            int wcode = cur.optInt("weather_code", 0);
            String temps = wmo(wcode);
            String resMeteo = "الجو عندك (موقعك الحالي) : " + temps + "، تقريباً " + Math.round(t2m) + " درجة.";
            lastMeteoVille = "gps"; lastMeteoCache = resMeteo; lastMeteoTs = System.currentTimeMillis();
            return resMeteo;
        } catch (Exception e) { return null; }
    }

    // Geocodage + previsions via Open-Meteo, en latin (les noms arabes sont
    // traduits a la volee pour les villes tunisiennes/suisses les plus connues).
    private String meteoOpenMeteo(String ville) {
        // cache 10 min
        long now = System.currentTimeMillis();
        if (ville.equalsIgnoreCase(lastMeteoVille) && lastMeteoCache != null && (now - lastMeteoTs) < 600000) return lastMeteoCache;
        String latin = ville;
        String[][] ar = {
            {"تونس", "Tunis"}, {"باريس", "Paris"}, {"صفاقس", "Sfax"}, {"سوسة", "Sousse"},
            {"بنزرت", "Bizerte"}, {"منوبة", "Manouba"}, {"نابل", "Nabeul"}, {"القيروان", "Kairouan"},
            {"قابس", "Gabes"}, {"مدنين", "Medenine"}, {"تطاوين", "Tataouine"}, {"قفصة", "Gafsa"},
            {"المنستير", "Monastir"}, {"باجة", "Beja"}, {"الكاف", "Le Kef"}, {"قبلي", "Kebili"},
            {"توزر", "Tozeur"}, {"زغوان", "Zaghouan"}, {"جندوبة", "Jendouba"}, {"سليانة", "Siliana"},
            {"أريانة", "Ariana"}, {"ولاية", "Tunis"}, {"جبنيانة", "Djebeniana"}, {"جربة", "Djerba"}
        };
        for (String[] pair : ar) { if (ville.equals(pair[0])) { latin = pair[1]; break; } }
        try {
            String enc = java.net.URLEncoder.encode(latin, "UTF-8");
            java.net.HttpURLConnection g = (java.net.HttpURLConnection) new java.net.URL(
                "https://geocoding-api.open-meteo.com/v1/search?name=" + enc
                + "&count=1&language=fr&format=json").openConnection();
            g.setRequestMethod("GET"); g.setConnectTimeout(6000); g.setReadTimeout(6000);
            int gcode = g.getResponseCode();
            org.json.JSONObject gj = new org.json.JSONObject(lireReponse(g, gcode));
            org.json.JSONArray results = gj.optJSONArray("results");
            if (results == null || results.length() == 0) {
                return "ما لقيتش المدينة " + ville + " بالضبط. جرّب تقول لي اسم مدينة أخرى (متلا تونس ولاّ صفاقس).";
            }
            org.json.JSONObject ge = results.getJSONObject(0);
            double lat = ge.getDouble("latitude"), lon = ge.getDouble("longitude");
            String pays = ge.optString("country", "");
            String nom = ge.optString("name", ville);
            java.net.HttpURLConnection f = (java.net.HttpURLConnection) new java.net.URL(
                "https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lon
                + "&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m"
                + "&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1").openConnection();
            f.setRequestMethod("GET"); f.setConnectTimeout(6000); f.setReadTimeout(6000);
            int fcode = f.getResponseCode();
            org.json.JSONObject fj = new org.json.JSONObject(lireReponse(f, fcode));
            org.json.JSONObject cur = fj.getJSONObject("current");
            double t2m = cur.getDouble("temperature_2m");
            int wcode = cur.optInt("weather_code", 0);
            double vent = cur.optDouble("wind_speed_10m", 0);
            String temps = wmo(wcode);
            String resMeteo = "الجو في " + nom + (pays.isEmpty() ? "" : " (" + pays + ")") + " : " + temps
                + "، تقريباً " + Math.round(t2m) + " درجة.";
            lastMeteoVille = ville; lastMeteoCache = resMeteo; lastMeteoTs = System.currentTimeMillis();
            return resMeteo;
        } catch (Exception e) {
            return "ما قدرتش نجيب الميتيو الآن. تحقق من الأنترنت.";
        }
    }

    // Convertit un code WMO Open-Meteo en description francaise simple.
    private String wmo(int code) {
        if (code == 0) return "صحو";
        if (code <= 1) return "قليل الغيوم";
        if (code == 2) return "غيوم متفرقة";
        if (code == 3) return "السماء مغيمة";
        if (code >= 45 && code <= 48) return "ضباب";
        if (code >= 51 && code <= 57) return "مرذاذ";
        if (code >= 61 && code <= 67) return "ممطر";
        if (code >= 71 && code <= 77) return "ثلج";
        if (code >= 80 && code <= 82) return "مزعزع";
        if (code >= 95) return "عواصف رعدية";
        return "جو عادي";
    }

    // Recherche web autonome (sans PC) : interroge Wikipedia (fiable, gratuit,
    // sans cle) et renvoie l'extrait de la meilleure page. Retourne null si
    // rien de pertinent n'est trouve.
    private String wikiReponse(String question) {
        String enc;
        try { enc = java.net.URLEncoder.encode(question, "UTF-8"); }
        catch (Exception e) { return null; }
        try {
            java.net.HttpURLConnection s = (java.net.HttpURLConnection) new java.net.URL(
                "https://fr.wikipedia.org/w/api.php?action=query&list=search&srsearch=" + enc
                + "&format=json&utf8=1&srlimit=1").openConnection();
            s.setRequestMethod("GET");
            s.setRequestProperty("User-Agent", "HmiedApp/1.0 (Android)");
            s.setConnectTimeout(8000); s.setReadTimeout(8000);
            int scode = s.getResponseCode();
            if (scode != 200) return null;
            org.json.JSONObject sj = new org.json.JSONObject(lireReponse(s, scode));
            org.json.JSONArray hits = sj.optJSONObject("query").optJSONArray("search");
            if (hits == null || hits.length() == 0) return null;
            String title = hits.getJSONObject(0).optString("title", "");
            if (title.isEmpty()) return null;
            String tenc = java.net.URLEncoder.encode(title, "UTF-8");
            java.net.HttpURLConnection p = (java.net.HttpURLConnection) new java.net.URL(
                "https://fr.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1"
                + "&exintro=1&exsentences=4&format=json&utf8=1&titles=" + tenc).openConnection();
            p.setRequestMethod("GET");
            p.setRequestProperty("User-Agent", "HmiedApp/1.0 (Android)");
            p.setConnectTimeout(8000); p.setReadTimeout(8000);
            int pcode = p.getResponseCode();
            if (pcode != 200) return null;
            org.json.JSONObject pj = new org.json.JSONObject(lireReponse(p, pcode));
            org.json.JSONObject pages = pj.optJSONObject("query").optJSONObject("pages");
            if (pages == null) return null;
            java.util.Iterator<String> it = pages.keys();
            if (!it.hasNext()) return null;
            String ex = pages.optJSONObject(it.next()).optString("extract", "").trim();
            return ex.isEmpty() ? null : ex;
        } catch (Exception e) {
            Log.w("HmiedApp", "wiki erreur", e);
            return null;
        }
    }

    // Demande a l'IA directe une reponse derja claire, en lui fournissant le
    // contexte Wikipedia trouve (pour ne pas avoir une reponse vague).
    private String repondreAvecContexte(String question, String contexte) {
        try {
            org.json.JSONObject body = new org.json.JSONObject();
            body.put("model", OPENROUTER_MODEL);
            body.put("messages", new org.json.JSONArray()
                    .put(new org.json.JSONObject().put("role", "system").put("content",
                            "Tu es Hmied (حميد), assistant personnel. Parle TOUJOURS en derja "
                            + "tunisienne, en lettres arabes, sans chiffres substituts (3/7/9/5/2/8). "
                            + "Reponds clairement en 3 a 6 phrases de derja. Use des tournures natives : ياخويا, يا عزيزي, باهي باهي, صحّة, على عيني وراسي, واش, كيفاش, وقتاش, شنوة. Confirme si pas clair : نفهمك باش نعمل... صح؟ Reponds naturellement comme un Tunisien. "
                            + "Mots de la dialecte de Hamdi: صحة زيتو = bonjour ; يعطيك الصحة = merci ; ربي يحفظك = que Dieu te garde ; خلينا نبداو = commençons ; يا خويا = mon frere ; نعاونك = je t'aide ; باش = pour que ; توا = maintenant ; غدوة = demain ; لاباس = ca va ; معلاش = pas grave ; باهي/مليح = bien ; نفهمك = je te comprends."))
                    .put(new org.json.JSONObject().put("role", "user").put("content",
                            "QUESTION : " + question
                            + "\n\nVoici les informations trouvees sur le web :\n" + contexte
                            + "\nReponds a la question en utilisant ces informations, en derja tunisienne.")));
            body.put("temperature", 0.5);
            java.net.HttpURLConnection c = (java.net.HttpURLConnection) new java.net.URL(OPENROUTER_URL).openConnection();
            c.setRequestMethod("POST");
            c.setRequestProperty("Content-Type", "application/json");
            c.setRequestProperty("Authorization", "Bearer " + OPENROUTER_KEY);
            c.setRequestProperty("HTTP-Referer", "https://hmned76.github.io/assistantAI");
            c.setDoOutput(true);
            c.setConnectTimeout(15000);
            c.setReadTimeout(60000);
            try (java.io.OutputStream os = c.getOutputStream()) {
                os.write(body.toString().getBytes("UTF-8"));
            }
            int code = c.getResponseCode();
            String rep = lireReponse(c, code);
            if (code == 200) {
                org.json.JSONObject j = new org.json.JSONObject(rep);
                return j.optJSONArray("choices").optJSONObject(0)
                        .optJSONObject("message").optString("content", "").trim();
            }
            Log.w("HmiedApp", "contexte http " + code + " " + rep);
            return null;
        } catch (Exception e) {
            Log.e("HmiedApp", "contexte exception", e);
            return null;
        }
    }

    private String demanderIA(String question) {
        try {
            final String base = getSharedPreferences("assistant", MODE_PRIVATE).getString("url", "");
            final boolean pcActif = !base.isEmpty();
            // 1) Si le PC est allume (serveur dispo) : on prefere le serveur
            //    (riche : style derja, travaux, actions). Sinon -> IA directe.
            if (pcActif) {
                String srv = interrogerServeur(base, question);
                if (srv != null) return srv;
            }

            // 1b) Controle des applications : ouvre/lance une app
            String tLowApp = question.toLowerCase();
            if (tLowApp.contains("ouvre") || tLowApp.contains("ouvrir") || tLowApp.contains("lance") || tLowApp.contains("lancer") || tLowApp.contains("افتح") || tLowApp.contains("open")) {
                String appNom = question;
                String[] kws = {"ouvre", "ouvrir", "lance", "lancer", "افتح", "open"};
                for (String k : kws) { int idx = tLowApp.indexOf(k); if (idx>=0) { appNom = question.substring(idx + k.length()).trim(); break; } }
                appNom = appNom.replaceAll("^[\\\\p{Punct}\\\\s]+", "").trim();
                appNom = appNom.split("[^\\\\p{L}0-9]+")[0].trim();
                if (!appNom.isEmpty()) {
                    final String appF = appNom;
                    runOnUiThread(() -> ouvrirApp(appF));
                    // tentative synchrone aussi pour reponse immediate
                    boolean ok = ouvrirApp(appNom);
                    if (ok) return "حليتلك " + appNom + " يا خويا.";
                    else return "ما لقيتش التطبيق " + appNom + " على تلفونك.";
                }
            }

            // 2) Meteo vs recherche web : sans PC, on traite ces cas directement.
            String meta = demandeMeteo(question);
            if (meta != null) return meta;
            // fallback force meteo si mot cle mais demandeMeteo a rate (ex: detection ratee)
            String tLowMeteo = question.toLowerCase();
            if (tLowMeteo.contains("meteo") || tLowMeteo.contains("طقس") || tLowMeteo.contains("حرارة") || tLowMeteo.contains("weather") || tLowMeteo.contains("temperature")) {
                String viaGps2 = meteoViaLocation();
                if (viaGps2 != null) return viaGps2;
                String viaTunis = meteoOpenMeteo("Tunis");
                if (viaTunis != null) return viaTunis;
            }

            // 2b) Recherche web autonome : pour une question d'info generale,
            // on cherche sur Wikipedia et on resume en derja avec l'IA directe.
            String wiki = wikiReponse(question);
            if (wiki != null) {
                String avecCtx = repondreAvecContexte(question, wiki);
                if (avecCtx != null) return avecCtx;
            }

            // 3) Sinon : appel direct OpenRouter (aucun PC requis).
            org.json.JSONObject body = new org.json.JSONObject();
            body.put("model", OPENROUTER_MODEL);
            body.put("messages", new org.json.JSONArray()
                    .put(new org.json.JSONObject().put("role", "system").put("content",
                            "Tu es Hmied (حميد), assistant personnel. Ton nom tunisien est Hmied, qui s'ecrit et se prononce « حميد » (lettres ح، م، ي، د). "
                            + "Ne t'appelle jamais « Hamid », « Hamed », « حامد » ni « أحمد » : ton nom est TOUJOURS « حميد » (Hmied). "
                            + "Quand on demande ton nom, reponds « أنا حميد » (Hmied). "
                            + "Tu assistes Hamdi (حمدي) qui vit en Tunisie ; ton proprietaire s'appelle Hamdi (حمدي), PAS Ahmed, JAMAIS Ahmed. "
                            + "Parle TOUJOURS en derja tunisienne, JAMAIS en arabe litteraire ni en francais pur. "
                            + "Ecris la derja en LETTRES ARABES (ex: صحة، باش، واش نعاونك) et N'utilise JAMAIS les chiffres substituts "
                            + "(interdits : 3=ع, 7=ح, 9=ق, 5=خ, 2=أ, 8=غ) ; utilise la vraie lettre arabe. "
                            + "Sois amical, reponds en 3 a 6 phrases de derja claires et utiles. "
                                + "Use des tournures natives tunisiennes : ياخويا, يا عزيزي, برشا, شوية, باهي باهي, صحّة وربي يحفذك, على عيني وراسي, خلينا نشوفو, واش, كيفاش, وقتاش, شنوة. Pour confirmer : نفهمك باش نعمل... صح؟, اش قلت؟ Reponds naturellement comme un Tunisien du quotidien. "
                                + "Mots de la dialecte tunisienne DE TON MAITRE Hamdi, utilise-les naturellement: صحة زيتو = bonjour/salut ; يعطيك الصحة = merci ; ربي يحفظك = que Dieu te garde ; خلينا نبداو = commençons ; على عيني وراسي = volontiers ; يا خويا = mon frere ; يا عزيزي = mon cher ; يا بعدي = mon cheri ; نعاونك = je t'aide ; كيفاش = comment ; وقتاش = quand ; شنوّة/شنوة = quoi ; واش = qu'est-ce que ; باش = pour que ; تنجم = tu peux ; توا = maintenant ; غدوة = demain ; البارح = hier ; برشا = beaucoup ; لاباس = ca va ; معلاش = pas grave ; باهي/مليح = bien ; فرحان = heureux ; نخمّم = je pense ; نفهمك = je te comprends."))
                    .put(new org.json.JSONObject().put("role", "user").put("content", question)));
            body.put("temperature", 0.7);
            java.net.HttpURLConnection c = (java.net.HttpURLConnection) new java.net.URL(OPENROUTER_URL).openConnection();
            c.setRequestMethod("POST");
            c.setRequestProperty("Content-Type", "application/json");
            c.setRequestProperty("Authorization", "Bearer " + OPENROUTER_KEY);
            c.setRequestProperty("HTTP-Referer", "https://hmned76.github.io/assistantAI");
            c.setDoOutput(true);
            c.setConnectTimeout(15000);
            c.setReadTimeout(60000);
            try (java.io.OutputStream os = c.getOutputStream()) {
                os.write(body.toString().getBytes("UTF-8"));
            }
            int code = c.getResponseCode();
            String rep = lireReponse(c, code);
            if (code == 200) {
                org.json.JSONObject j = new org.json.JSONObject(rep);
                return j.optJSONArray("choices").optJSONObject(0)
                        .optJSONObject("message").optString("content", "").trim();
            }
            Log.w("HmiedApp", "ia direct http " + code + " " + rep);
            return "Je n'ai pas pu joindre l'IA (" + code + "). Vérifie ta connexion.";
        } catch (Exception e) {
            Log.e("HmiedApp", "ia direct exception", e);
            return "Erreur IA : " + (e.getMessage() == null ? e.toString() : e.getMessage());
        }
    }

    // Interroge le serveur Flask du PC si accessible (mode PC allume).
    private String interrogerServeur(String base, String question) {
        try {
            String hote = base.replaceAll("/+$", "");
            java.net.HttpURLConnection c = (java.net.HttpURLConnection) new java.net.URL(hote + "/api/chat").openConnection();
            c.setRequestMethod("POST");
            c.setRequestProperty("Content-Type", "application/json");
            c.setRequestProperty("X-Auth-Token", token());
            c.setDoOutput(true);
            c.setConnectTimeout(5000);
            c.setReadTimeout(60000);
            try (java.io.OutputStream os = c.getOutputStream()) {
                os.write(("{\"message\":" + quote(question) + "}").getBytes("UTF-8"));
            }
            int code = c.getResponseCode();
            if (code != 200) return null;
            String rep = lireReponse(c, code);
            org.json.JSONObject j = new org.json.JSONObject(rep);
            // Execute les actions (ex: appel téléphonique) renvoyees par le serveur
            org.json.JSONArray actions = j.optJSONArray("actions");
            if (actions != null && actions.length() > 0) {
                for (int i = 0; i < actions.length(); i++) {
                    try {
                        org.json.JSONObject act = actions.optJSONObject(i);
                        if (act == null) continue;
                        String type = act.optString("type", "");
                        org.json.JSONObject res = act.optJSONObject("resultat");
                        if (type.equals("call") && res != null && !res.optString("numero", "").isEmpty()) {
                            final String numero = res.optString("numero");
                            // L'appel doit se faire sur le thread UI (WebView + Intent)
                            runOnUiThread(() -> faireAppel(numero));
                        }
                    } catch (Exception ignored) {}
                }
            }
            return j.optString("reponse", null);
        } catch (Exception e) {
            return null; // PC inaccessible -> on bascule sur l'IA directe
        }
    }

    // Convertit une reponse brute en JSON valide pour le callback JS.
    private String convJSON(String s) {
        return s == null ? "" : s;
    }

    // ------------------------------------------------------------------
    // Historique local (discussions) + synchronisation vers le PC.
    // ------------------------------------------------------------------
    private java.io.File fichierHistorique() {
        return new java.io.File(getFilesDir(), "historique.json");
    }

    // Charge l'historique stocke sur le telephone (JSON) pour l'interface.
    public String chargerHistorique() {
        try {
            java.io.File f = fichierHistorique();
            if (f.exists()) {
                java.io.ByteArrayOutputStream b = new java.io.ByteArrayOutputStream();
                byte[] buf = new byte[8192];
                try (java.io.FileInputStream in = new java.io.FileInputStream(f)) {
                    int n;
                    while ((n = in.read(buf)) > 0) b.write(buf, 0, n);
                }
                return new String(b.toByteArray(), "UTF-8");
            }
        } catch (Exception ignored) {}
        return "[]";
    }

    // Stocke un message dans l'historique local (append).
    public void sauverMessage(String role, String texte) {
        try {
            org.json.JSONArray arr;
            java.io.File f = fichierHistorique();
            if (f.exists()) arr = new org.json.JSONArray(chargerHistorique());
            else arr = new org.json.JSONArray();
            org.json.JSONObject m = new org.json.JSONObject();
            m.put("role", role);
            m.put("texte", texte);
            m.put("quand", System.currentTimeMillis());
            arr.put(m);
            try (java.io.FileOutputStream os = new java.io.FileOutputStream(f)) {
                os.write(arr.toString().getBytes("UTF-8"));
            }
        } catch (Exception ignored) {}
    }

    // Vide l'historique local (apres une synchro reussie, par ex.).
    public void viderHistorique() {
        try {
            java.io.File f = fichierHistorique();
            if (f.exists()) f.delete();
        } catch (Exception ignored) {}
    }

    // Synchronise les discussions vers le PC si le serveur est joignable.
    public void synchroniser() {
        new Thread(() -> {
            try {
                String base = getSharedPreferences("assistant", MODE_PRIVATE).getString("url", "");
                if (base.isEmpty()) return;
                java.io.File f = fichierHistorique();
                if (!f.exists()) return;
                String donnees = chargerHistorique();
                String hote = base.replaceAll("/+$", "");
                java.net.HttpURLConnection c = (java.net.HttpURLConnection) new java.net.URL(hote + "/api/historique").openConnection();
                c.setRequestMethod("POST");
                c.setRequestProperty("Content-Type", "application/json");
                c.setRequestProperty("X-Auth-Token", token());
                c.setDoOutput(true);
                c.setConnectTimeout(5000);
                c.setReadTimeout(15000);
                try (java.io.OutputStream os = c.getOutputStream()) {
                    os.write(("{\"messages\":" + donnees + "}").getBytes("UTF-8"));
                }
                int code = c.getResponseCode();
                if (code == 200) viderHistorique();
            } catch (Exception e) {
                Log.w("HmiedApp", "synchro echec: " + (e.getMessage() == null ? e.toString() : e.getMessage()));
            }
        }).start();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == 100) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                if (enAttente) {
                    enAttente = false;
                    demarrerEcoutE();
                }
            } else {
                evaluerJS("window.__asrErreur('Autorise le micro dans les parametres.')");
            }
        }
        if (requestCode == 200) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                faireAppel(lastCallNumber);
            } else {
                toast("Autorise l'appel telephone dans les parametres.");
            }
        }
    }

    private void loadUrlWrapper() {
        // Interface embarquee dans l'APK : elle s'affiche instantanement, meme
        // sans serveur. L'adresse du serveur (pour chat/STT/TTS) est lue par le JS
        // via AndroidIOS.getUrl(). Si aucune adresse n'est configuree, on demande
        // a l'utilisateur de la saisir une premiere fois.
        SharedPreferences sp = getSharedPreferences("assistant", MODE_PRIVATE);
        String url = sp.getString("url", "");
        if (url.isEmpty()) {
            ouvrirConfiguration("Bienvenue dans AssistantAI !\nEntre l'adresse du serveur :");
        }
        webView.loadUrl("file:///android_asset/index.html");
        verifierEtRafraichirUrl();
    }

    // Annuaire permanent sur GitHub : l'app y trouve l'adresse actuelle du
    // serveur, meme si le tunnel Cloudflare a change (utilisable dehors).
    private static final String URL_ANNUAIRE = "https://raw.githubusercontent.com/hmned76/assistantAI-url/main/url.txt";

    private void verifierEtRafraichirUrl() {
        new Thread(() -> {
            try {
                final SharedPreferences sp = getSharedPreferences("assistant", MODE_PRIVATE);
                String actuelle = sp.getString("url", "").trim();
                if (!actuelle.isEmpty() && urlRepond(actuelle)) return; // l'URL actuelle marche, rien a faire

                // L'URL sauvegardee ne repond pas -> on interroge l'annuaire GitHub.
                String nouvelle = lireAnnuaire();
                if (nouvelle == null || nouvelle.isEmpty()) {
                    Log.d(TAG, "Annuaire GitHub injoignable ou vide");
                    return;
                }
                final String n = nouvelle.trim();
                if (n.equals(actuelle)) return;
                getSharedPreferences("assistant", MODE_PRIVATE).edit().putString("url", n).apply();
                Log.d(TAG, "URL rafraichie depuis GitHub : " + n);
                runOnUiThread(() -> {
                    try { webView.evaluateJavascript("window.__refreshUrl && window.__refreshUrl();", null); } catch (Exception ignored) {}
                });
            } catch (Exception e) {
                Log.d(TAG, "verifierEtRafraichirUrl erreur: " + e.getMessage());
            }
        }).start();
    }

    private boolean urlRepond(String url) {
        try {
            java.net.HttpURLConnection c = (java.net.HttpURLConnection) new java.net.URL(url).openConnection();
            c.setConnectTimeout(8000);
            c.setReadTimeout(8000);
            c.setInstanceFollowRedirects(true);
            c.setRequestMethod("GET");
            int code = c.getResponseCode();
            c.disconnect();
            return code == 200 || code == 302;
        } catch (Exception ignored) {
            return false;
        }
    }

    private String lireAnnuaire() {
        // cdn.jsdelivr.net sert les fichiers GitHub frais ; raw peut rester en cache
        String[] sources = {
            "https://cdn.jsdelivr.net/gh/hmned76/assistantAI-url@main/url.txt",
            URL_ANNUAIRE
        };
        for (String src : sources) {
            try {
                java.net.HttpURLConnection c = (java.net.HttpURLConnection) new java.net.URL(src).openConnection();
                c.setConnectTimeout(12000);
                c.setReadTimeout(12000);
                c.setRequestMethod("GET");
                int code = c.getResponseCode();
                if (code != 200) { c.disconnect(); continue; }
                java.io.BufferedReader br = new java.io.BufferedReader(new java.io.InputStreamReader(c.getInputStream()));
                String s = "";
                String ligne;
                while ((ligne = br.readLine()) != null) s = s + ligne.trim();
                c.disconnect();
                if (s != null && !s.trim().isEmpty()) return s.trim();
            } catch (Exception e) {
                Log.d(TAG, "lireAnnuaire erreur " + src + ": " + e.getMessage());
            }
        }
        return null;
    }

    private void charger(String url) {
        String sep = url.contains("?") ? "&" : "?";
        webView.loadUrl(url + sep + "v=" + System.currentTimeMillis());
    }

    private void ouvrirConfiguration(String titre) {
        final EditText input = new EditText(this);
        input.setHint("https://xxxx.trycloudflare.com");
        input.setText(getSharedPreferences("assistant", MODE_PRIVATE).getString("url", "https://xxxx.trycloudflare.com"));
        android.app.AlertDialog dialog = new android.app.AlertDialog.Builder(this)
                .setTitle(titre)
                .setView(input)
                .setPositiveButton("OK", (d, w) -> {
                    String url = input.getText().toString().trim();
                    if (!url.isEmpty()) {
                        getSharedPreferences("assistant", MODE_PRIVATE)
                                .edit().putString("url", url).apply();
                        webView.loadUrl("file:///android_asset/index.html");
                    }
                })
                .setNeutralButton("Fermer", null)
                .create();
        dialog.show();
    }

    private void demanderPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            requestPermissions(PERMISSIONS, 1);
        }
    }

    private boolean ouvrirApp(String nom) {
        try {
            String q = nom.toLowerCase().trim();
            android.content.pm.PackageManager pm = getPackageManager();
            android.content.Intent launch = null;
            if (q.contains("whatsapp")) { launch = pm.getLaunchIntentForPackage("com.whatsapp"); if (launch==null) launch = pm.getLaunchIntentForPackage("com.whatsapp.w4b"); }
            else if (q.contains("facebook")) launch = pm.getLaunchIntentForPackage("com.facebook.katana");
            else if (q.contains("instagram")) launch = pm.getLaunchIntentForPackage("com.instagram.android");
            else if (q.contains("youtube")) launch = pm.getLaunchIntentForPackage("com.google.android.youtube");
            else if (q.contains("maps") || q.contains("خرائط") || q.contains("map")) launch = pm.getLaunchIntentForPackage("com.google.android.apps.maps");
            else if (q.contains("camera") || q.contains("كاميرا") || q.contains("appareil photo")) { launch = new android.content.Intent(android.provider.MediaStore.ACTION_IMAGE_CAPTURE); }
            else if (q.contains("galerie") || q.contains("photos")) launch = pm.getLaunchIntentForPackage("com.google.android.apps.photos");
            else if (q.contains("chrome") || q.contains("navigateur")) launch = pm.getLaunchIntentForPackage("com.android.chrome");
            else if (q.contains("telephone") || q.contains("phone")) launch = new android.content.Intent(android.content.Intent.ACTION_DIAL);
            if (launch == null) {
                java.util.List<android.content.pm.ApplicationInfo> apps = pm.getInstalledApplications(0);
                for (android.content.pm.ApplicationInfo ai : apps) {
                    String label = pm.getApplicationLabel(ai).toString().toLowerCase();
                    if (label.contains(q) || q.contains(label)) { launch = pm.getLaunchIntentForPackage(ai.packageName); if (launch != null) break; }
                }
            }
            if (launch != null) { launch.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK); startActivity(launch); return true; }
        } catch (Exception e) { android.util.Log.w("HmiedApp", "ouvrirApp err "+e); }
        return false;
    }

    private void faireAppel(String numero) {
        if (numero == null || numero.isEmpty()) {
            toast("Numero de telephone inconnu.");
            return;
        }
        lastCallNumber = numero;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
                checkSelfPermission(Manifest.permission.CALL_PHONE) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.CALL_PHONE}, 200);
            toast("Autorisation d'appel demandee...");
            return;
        }
        try {
            Intent intent = new Intent(Intent.ACTION_CALL);
            intent.setData(Uri.parse("tel:" + numero));
            startActivity(intent);
            lireText("Bonjour, je t'appelle des maintenant.");
        } catch (Exception e) {
            toast("Impossible d'appeler : " + e.getMessage());
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onStop() {
        super.onStop();
        if (enregistreur != null) {
            try { enregistreur.stop(); } catch (Exception ignored) {}
            try { enregistreur.release(); } catch (Exception ignored) {}
            enregistreur = null;
            enEcoute = false;
        }
    }

    @Override
    protected void onDestroy() {
        if (enregistreur != null) {
            try { enregistreur.stop(); } catch (Exception ignored) {}
            try { enregistreur.release(); } catch (Exception ignored) {}
            enregistreur = null;
        }
        if (tts != null) {
            try { tts.stop(); tts.shutdown(); } catch (Exception ignored) {}
        }
        super.onDestroy();
    }
}
