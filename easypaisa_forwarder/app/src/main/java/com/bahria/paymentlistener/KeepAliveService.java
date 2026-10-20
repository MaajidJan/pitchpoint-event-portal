package com.bahria.paymentlistener;

import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

public class KeepAliveService extends Service {

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private final android.os.Handler queueHandler = new android.os.Handler(android.os.Looper.getMainLooper());
    private final Runnable queueRunnable = new Runnable() {
        @Override
        public void run() {
            WebhookSender.flushOfflineQueue(getApplicationContext());
            WebhookSender.sendHeartbeat(getApplicationContext());
            queueHandler.postDelayed(this, 30000);
        }
    };

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Intent openAppIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            0,
            openAppIntent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, ForwarderApp.CHANNEL_ID)
            .setContentTitle("Payment Forwarder Active")
            .setContentText("Monitoring Zindigi, Raast & Bank payments 24/7...")
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(
                ForwarderApp.NOTIFICATION_ID,
                builder.build(),
                ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
            );
        } else {
            startForeground(ForwarderApp.NOTIFICATION_ID, builder.build());
        }

        queueHandler.removeCallbacks(queueRunnable);
        queueHandler.postDelayed(queueRunnable, 5000);

        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        queueHandler.removeCallbacks(queueRunnable);
    }

    public static void start(Context context) {
        Intent intent = new Intent(context, KeepAliveService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }

    public static void stop(Context context) {
        context.stopService(new Intent(context, KeepAliveService.class));
    }
}
