package com.bahria.paymentlistener;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

public class EasypaisaNotificationService extends NotificationListenerService {

    private static final String TAG = "EasypaisaNotifService";
    private final Map<String, Long> recentlyProcessed = new HashMap<>();

    @Override
    public void onListenerConnected() {
        super.onListenerConnected();
        Log.i(TAG, "Notification Listener connected");
        LogRepository.addLog(
            true,
            "Service Connected",
            "Notification Listener service active and ready.",
            null
        );
    }

    @Override
    public void onListenerDisconnected() {
        super.onListenerDisconnected();
        Log.w(TAG, "Notification Listener disconnected");
        LogRepository.addLog(
            false,
            "Service Disconnected",
            "Listener service disconnected. Check settings.",
            null
        );
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null) return;

        String packageName = sbn.getPackageName();
        if (packageName == null) return;

        Notification notification = sbn.getNotification();
        if (notification == null) return;

        Bundle extras = notification.extras;
        if (extras == null) return;

        CharSequence titleSeq = extras.getCharSequence(Notification.EXTRA_TITLE);
        CharSequence textSeq = extras.getCharSequence(Notification.EXTRA_TEXT);
        CharSequence bigTextSeq = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);
        CharSequence subTextSeq = extras.getCharSequence(Notification.EXTRA_SUB_TEXT);

        String title = titleSeq != null ? titleSeq.toString() : "";
        String text = textSeq != null ? textSeq.toString() : "";
        String bigText = bigTextSeq != null ? bigTextSeq.toString() : "";
        String subText = subTextSeq != null ? subTextSeq.toString() : "";

        List<String> parts = new ArrayList<>();
        if (!title.isEmpty()) parts.add(title);
        if (!text.isEmpty() && !parts.contains(text)) parts.add(text);
        if (!bigText.isEmpty() && !parts.contains(bigText)) parts.add(bigText);
        if (!subText.isEmpty() && !parts.contains(subText)) parts.add(subText);

        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < parts.size(); i++) {
            if (i > 0) sb.append("\n");
            sb.append(parts.get(i));
        }
        String combined = sb.toString().trim();
        if (combined.isEmpty()) return;

        boolean isCandidate = PaymentParser.isPaymentNotification(packageName, title, combined);
        if (!isCandidate) {
            return;
        }

        // Deduplication
        String dedupeKey = packageName + "_" + combined.hashCode();
        long now = System.currentTimeMillis();
        synchronized (recentlyProcessed) {
            Long lastSeen = recentlyProcessed.get(dedupeKey);
            if (lastSeen != null && (now - lastSeen < 15000)) {
                Log.d(TAG, "Duplicate notification skipped within 15s");
                return;
            }
            recentlyProcessed.put(dedupeKey, now);

            Iterator<Map.Entry<String, Long>> it = recentlyProcessed.entrySet().iterator();
            while (it.hasNext()) {
                if (now - it.next().getValue() > 60000) {
                    it.remove();
                }
            }
        }

        Log.i(TAG, "Captured notification from " + packageName + ": " + combined);

        ParsedPayment parsed = PaymentParser.parse(combined);

        LogRepository.addLog(
            true,
            "Captured: " + packageName,
            "TRX: " + (parsed.trxId != null ? parsed.trxId : "Detecting...") + " | Rs. " + (parsed.amount != null ? parsed.amount : "?") + "\n" + combined,
            combined
        );

        WebhookSender.send(
            getApplicationContext(),
            packageName,
            title.isEmpty() ? "Easypaisa Notification" : title,
            combined,
            parsed,
            null
        );
    }
}
