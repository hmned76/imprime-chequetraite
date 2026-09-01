package com.hmned76.assistantai;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.util.Log;

import java.util.ArrayList;
import java.util.Locale;

public class WakeWordService extends Service {
    private static final String TAG = "HmiedWake";
    private static final String CHANNEL_ID = "hmied_wake";
    private SpeechRecognizer recognizer;
    private boolean destroyed = false;
    private boolean listening = false;
    private Handler handler;
    private float maxRms = 0;

    @Override
    public void onCreate() {
        super.onCreate();
        handler = new Handler(getMainLooper());
        createChannel();
        startForeground(1, buildNotification("Écoute 'حميد' active..."));
        startListening();
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "Hmied écoute", NotificationManager.IMPORTANCE_DEFAULT);
            ch.setDescription("Écoute du mot-clé حميد en arrière-plan");
            ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(ch);
        }
    }

    private Notification buildNotification(String text) {
        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) b = new Notification.Builder(this, CHANNEL_ID);
        else b = new Notification.Builder(this);
        b.setContentTitle("AssistantAI - Hmied").setContentText(text).setSmallIcon(android.R.drawable.ic_btn_speak_now);
        return b.build();
    }

    private void startListening() {
        if (destroyed) return;
        maxRms = 0;
        listening = false;
        if (SpeechRecognizer.isRecognitionAvailable(this) == false) return;
        if (recognizer != null) try { recognizer.destroy(); } catch (Exception ignored) {}
        recognizer = SpeechRecognizer.createSpeechRecognizer(this);
        recognizer.setRecognitionListener(new RecognitionListener() {
            @Override public void onReadyForSpeech(Bundle p) {}
            @Override public void onBeginningOfSpeech() {}
            @Override public void onRmsChanged(float v) { if (v > maxRms) maxRms = v; }
            @Override public void onBufferReceived(byte[] b) {}
            @Override public void onEndOfSpeech() {}
            @Override public void onError(int e) {
                handler.postDelayed(new Runnable() {
                    @Override public void run() { if (!destroyed) startListening(); }
                }, 1500);
            }
            @Override public void onResults(Bundle results) {
                ArrayList<String> list = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                if (list != null && !list.isEmpty()) {
                    String txt = list.get(0).toLowerCase(Locale.ROOT).trim();
                    Log.d(TAG, "heard: " + txt + " rms=" + maxRms);
                    if (maxRms < 2.0f) {
                        Log.d(TAG, "ignore low rms=" + maxRms);
                        if (!destroyed) startListening();
                        return;
                    }
                    if (listening) {
                        listening = false;
                        onCommand(txt);
                        return;
                    }
                    if (isWakeWord(txt)) {
                        Log.d(TAG, "WAKE DETECTED");
                        beep();
                        listening = true;
                        handler.postDelayed(new Runnable() {
                            @Override public void run() {
                                if (listening) {
                                    listening = false;
                                    stopSelf();
                                }
                            }
                        }, 5000);
                    }
                }
                if (!destroyed) {
                    handler.postDelayed(new Runnable() {
                        @Override public void run() { if (!destroyed) startListening(); }
                    }, 500);
                }
            }
            @Override public void onPartialResults(Bundle p) {}
            @Override public void onEvent(int t, Bundle p) {}
        });
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ar-TN");
        intent.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getPackageName());
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        try { recognizer.startListening(intent); } catch (Exception e) { Log.e(TAG, "startListening", e); }
    }

    private boolean isWakeWord(String t) {
        t = t.trim().toLowerCase();
        return t.equals("حميد") || t.equals("hmied") || t.equals("hmid") || t.equals("حميده");
    }

    private void beep() {
        try { ToneGenerator tg = new ToneGenerator(AudioManager.STREAM_MUSIC, 100); tg.startTone(ToneGenerator.TONE_PROP_BEEP, 200); } catch (Exception ignored) {}
    }

    private void onCommand(String question) {
        Log.d(TAG, "command: " + question);
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(1, buildNotification("J'écoute... parle !"));
        Intent i = new Intent(this, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        i.putExtra("wake_question", question);
        startActivity(i);
        Intent bc = new Intent("com.hmned76.assistantai.WAKE_QUESTION");
        bc.putExtra("question", question);
        sendBroadcast(bc);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        destroyed = true;
        if (recognizer != null) try { recognizer.destroy(); } catch (Exception ignored) {}
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}