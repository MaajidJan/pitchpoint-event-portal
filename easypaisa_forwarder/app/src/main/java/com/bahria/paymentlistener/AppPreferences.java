package com.bahria.paymentlistener;

import android.content.Context;
import android.content.SharedPreferences;

public class AppPreferences {

    public static final String DEFAULT_URL = "https://your-worker-subdomain.workers.dev/api/webhook/payment";
    public static final String DEFAULT_SECRET = "YOUR_SECURE_WEBHOOK_SECRET";

    private static final String PREF_NAME = "easypaisa_forwarder_prefs";
    private static final String KEY_WEBHOOK_URL = "webhook_url";
    private static final String KEY_WEBHOOK_SECRET = "webhook_secret";
    private static final String KEY_EASYPAISA_ONLY = "easypaisa_only";

    private final SharedPreferences prefs;

    public AppPreferences(Context context) {
        this.prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
    }

    public String getWebhookUrl() {
        return prefs.getString(KEY_WEBHOOK_URL, DEFAULT_URL);
    }

    public void setWebhookUrl(String url) {
        prefs.edit().putString(KEY_WEBHOOK_URL, url.trim()).apply();
    }

    public String getWebhookSecret() {
        return prefs.getString(KEY_WEBHOOK_SECRET, DEFAULT_SECRET);
    }

    public void setWebhookSecret(String secret) {
        prefs.edit().putString(KEY_WEBHOOK_SECRET, secret.trim()).apply();
    }

    public boolean isListenEasypaisaOnly() {
        return prefs.getBoolean(KEY_EASYPAISA_ONLY, false);
    }

    public void setListenEasypaisaOnly(boolean value) {
        prefs.edit().putBoolean(KEY_EASYPAISA_ONLY, value).apply();
    }

    private static final String KEY_OFFLINE_QUEUE = "offline_queue";

    public synchronized void enqueueOfflinePayload(String payload) {
        try {
            String existing = prefs.getString(KEY_OFFLINE_QUEUE, "[]");
            org.json.JSONArray arr = new org.json.JSONArray(existing);
            arr.put(payload);
            prefs.edit().putString(KEY_OFFLINE_QUEUE, arr.toString()).apply();
        } catch (Exception e) {
            // ignore
        }
    }

    public synchronized java.util.List<String> getAndClearOfflineQueue() {
        java.util.List<String> list = new java.util.ArrayList<>();
        try {
            String existing = prefs.getString(KEY_OFFLINE_QUEUE, "[]");
            org.json.JSONArray arr = new org.json.JSONArray(existing);
            for (int i = 0; i < arr.length(); i++) {
                list.add(arr.getString(i));
            }
            prefs.edit().putString(KEY_OFFLINE_QUEUE, "[]").apply();
        } catch (Exception e) {
            // ignore
        }
        return list;
    }

    public synchronized int getOfflineQueueCount() {
        try {
            String existing = prefs.getString(KEY_OFFLINE_QUEUE, "[]");
            org.json.JSONArray arr = new org.json.JSONArray(existing);
            return arr.length();
        } catch (Exception e) {
            return 0;
        }
    }
}
