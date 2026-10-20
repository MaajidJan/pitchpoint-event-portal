package com.bahria.paymentlistener;

import android.app.Application;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;

public class ForwarderApp extends Application {

    public static final String CHANNEL_ID = "easypaisa_forwarder_channel";
    public static final int NOTIFICATION_ID = 1001;

    @Override
    public void onCreate() {
        super.onCreate() ;
        createNotificationChannels();
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Easypaisa Payment Forwarder Service",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Keeps notification listener active 24/7");
            channel.setShowBadge(false);

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }
}
