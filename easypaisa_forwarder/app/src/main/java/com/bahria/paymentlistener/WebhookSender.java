package com.bahria.paymentlistener;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class WebhookSender {

    private static final String TAG = "WebhookSender";
    private static final ExecutorService executor = Executors.newSingleThreadExecutor();
    private static final Handler mainHandler = new Handler(Looper.getMainLooper());

    public interface Callback {
        void onResult(boolean success, String message);
    }

    public static void send(
        Context context,
        String packageName,
        String title,
        String rawText,
        ParsedPayment parsed,
        Callback callback
    ) {
        AppPreferences prefs = new AppPreferences(context);
        String targetUrl = prefs.getWebhookUrl();
        String secret = prefs.getWebhookSecret();

        executor.execute(() -> {
            boolean success = false;
            String message = "";
            HttpURLConnection connection = null;

            try {
                JSONObject json = new JSONObject();
                json.put("raw_text", rawText);
                json.put("source", PaymentParser.detectSource(packageName, title, rawText));
                json.put("package", packageName);
                json.put("title", title);
                json.put("timestamp", System.currentTimeMillis());

                if (parsed.trxId != null && !parsed.trxId.isEmpty()) {
                    json.put("trx_id", parsed.trxId);
                }
                if (parsed.amount != null && parsed.amount > 0) {
                    json.put("amount", parsed.amount);
                }
                if (parsed.senderName != null && !parsed.senderName.isEmpty()) {
                    json.put("sender_name", parsed.senderName);
                }
                if (parsed.senderPhone != null && !parsed.senderPhone.isEmpty()) {
                    json.put("sender_phone", parsed.senderPhone);
                }

                String payload = json.toString();
                Log.d(TAG, "Posting to " + targetUrl + ": " + payload);

                URL url = new URL(targetUrl);
                connection = (HttpURLConnection) url.openConnection();
                connection.setRequestMethod("POST");
                connection.setConnectTimeout(15000);
                connection.setReadTimeout(15000);
                connection.setDoOutput(true);
                connection.setDoInput(true);
                connection.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
                connection.setRequestProperty("Accept", "application/json");
                connection.setRequestProperty("User-Agent", "EasypaisaForwarder-Android/1.0");

                if (secret != null && !secret.isEmpty()) {
                    connection.setRequestProperty("x-webhook-secret", secret);
                }

                try (OutputStreamWriter writer = new OutputStreamWriter(connection.getOutputStream(), StandardCharsets.UTF_8)) {
                    writer.write(payload);
                    writer.flush();
                }

                int statusCode = connection.getResponseCode();
                success = (statusCode >= 200 && statusCode < 300);

                InputStream is = success ? connection.getInputStream() : connection.getErrorStream();
                String responseBody = "";
                if (is != null) {
                    try (BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
                        StringBuilder sb = new StringBuilder();
                        String line;
                        while ((line = reader.readLine()) != null) {
                            sb.append(line);
                        }
                        responseBody = sb.toString();
                    }
                }

                message = "HTTP " + statusCode + ": " + responseBody;

                if (success) {
                    LogRepository.addLog(
                        true,
                        "Forwarded: " + (parsed.trxId != null ? parsed.trxId : "Payment"),
                        "Rs. " + (parsed.amount != null ? parsed.amount : "?") + " -> " + message,
                        rawText
                    );
                    flushOfflineQueue(context);
                } else {
                    prefs.enqueueOfflinePayload(payload);
                    LogRepository.addLog(
                        false,
                        "Webhook Error (Queued)",
                        message + " (Saved to offline queue)",
                        rawText
                    );
                }

            } catch (Exception e) {
                Log.e(TAG, "Exception posting webhook", e);
                message = e.getClass().getSimpleName() + ": " + e.getMessage();
                try {
                    JSONObject fallbackJson = new JSONObject();
                    fallbackJson.put("raw_text", rawText);
                    fallbackJson.put("source", "pk.com.telenor.phoenix".equals(packageName) ? "EASYPAISA_APP" : "NOTIFICATION_LISTENER");
                    if (parsed.trxId != null) fallbackJson.put("trx_id", parsed.trxId);
                    if (parsed.amount != null) fallbackJson.put("amount", parsed.amount);
                    prefs.enqueueOfflinePayload(fallbackJson.toString());
                } catch (Exception ignored) {}
                LogRepository.addLog(
                    false,
                    "Offline (Queued)",
                    message + " - Stored on phone, will auto-send when internet connects.",
                    rawText
                );
            } finally {
                if (connection != null) {
                    connection.disconnect();
                }
            }

            final boolean finalSuccess = success;
            final String finalMessage = message;
            mainHandler.post(() -> {
                if (callback != null) {
                    callback.onResult(finalSuccess, finalMessage);
                }
            });
        });
    }

    public static void flushOfflineQueue(Context context) {
        AppPreferences prefs = new AppPreferences(context);
        java.util.List<String> queued = prefs.getAndClearOfflineQueue();
        if (queued.isEmpty()) return;

        executor.execute(() -> {
            String targetUrl = prefs.getWebhookUrl();
            String secret = prefs.getWebhookSecret();
            java.util.List<String> failed = new java.util.ArrayList<>();

            for (String payload : queued) {
                HttpURLConnection conn = null;
                try {
                    URL url = new URL(targetUrl);
                    conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("POST");
                    conn.setConnectTimeout(10000);
                    conn.setReadTimeout(10000);
                    conn.setDoOutput(true);
                    conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
                    if (secret != null && !secret.isEmpty()) {
                        conn.setRequestProperty("x-webhook-secret", secret);
                    }
                    try (OutputStreamWriter writer = new OutputStreamWriter(conn.getOutputStream(), StandardCharsets.UTF_8)) {
                        writer.write(payload);
                        writer.flush();
                    }
                    int code = conn.getResponseCode();
                    if (code >= 200 && code < 300) {
                        Log.i(TAG, "Offline payment synced successfully: " + payload);
                        LogRepository.addLog(true, "Offline Sync Success", "Payment synced after reconnecting.", payload);
                    } else {
                        failed.add(payload);
                    }
                } catch (Exception e) {
                    failed.add(payload);
                } finally {
                    if (conn != null) conn.disconnect();
                }
            }

            // Re-queue any that still couldn't be sent
            for (String f : failed) {
                prefs.enqueueOfflinePayload(f);
            }
        });
    }

    public static void sendHeartbeat(Context context) {
        AppPreferences prefs = new AppPreferences(context);
        String targetUrl = prefs.getWebhookUrl();
        String secret = prefs.getWebhookSecret();

        executor.execute(() -> {
            HttpURLConnection conn = null;
            try {
                JSONObject json = new JSONObject();
                json.put("type", "HEARTBEAT");
                json.put("source", "ANDROID_FORWARDER");
                json.put("timestamp", System.currentTimeMillis());

                URL url = new URL(targetUrl);
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setConnectTimeout(8000);
                conn.setReadTimeout(8000);
                conn.setDoOutput(true);
                conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
                if (secret != null && !secret.isEmpty()) {
                    conn.setRequestProperty("x-webhook-secret", secret);
                }
                try (OutputStreamWriter writer = new OutputStreamWriter(conn.getOutputStream(), StandardCharsets.UTF_8)) {
                    writer.write(json.toString());
                    writer.flush();
                }
                int code = conn.getResponseCode();
                Log.d(TAG, "Heartbeat ping response: " + code);
            } catch (Exception ignored) {
            } finally {
                if (conn != null) conn.disconnect();
            }
        });
    }
}
