package com.bahria.paymentlistener;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class LogEntry {
    public final long id;
    public final String timestamp;
    public final boolean isSuccess;
    public final String title;
    public final String details;
    public final String rawText;

    public LogEntry(boolean isSuccess, String title, String details, String rawText) {
        this.id = System.currentTimeMillis();
        this.timestamp = new SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(new Date());
        this.isSuccess = isSuccess;
        this.title = title;
        this.details = details;
        this.rawText = rawText;
    }
}
