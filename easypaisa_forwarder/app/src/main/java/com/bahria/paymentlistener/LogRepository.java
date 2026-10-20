package com.bahria.paymentlistener;

import android.os.Handler;
import android.os.Looper;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

public class LogRepository {

    public interface LogListener {
        void onLogsUpdated(List<LogEntry> logs);
    }

    private static final List<LogEntry> logs = new ArrayList<>();
    private static final List<LogListener> listeners = new CopyOnWriteArrayList<>();
    private static final Handler mainHandler = new Handler(Looper.getMainLooper());
    private static final Object lock = new Object();

    public static void addListener(LogListener listener) {
        listeners.add(listener);
        notifyListeners();
    }

    public static void removeListener(LogListener listener) {
        listeners.remove(listener);
    }

    public static void addLog(boolean isSuccess, String title, String details, String rawText) {
        synchronized (lock) {
            LogEntry entry = new LogEntry(isSuccess, title, details, rawText);
            logs.add(0, entry);
            if (logs.size() > 100) {
                logs.remove(logs.size() - 1);
            }
        }
        notifyListeners();
    }

    public static void clear() {
        synchronized (lock) {
            logs.clear();
        }
        notifyListeners();
    }

    public static List<LogEntry> getLogs() {
        synchronized (lock) {
            return Collections.unmodifiableList(new ArrayList<>(logs));
        }
    }

    private static void notifyListeners() {
        mainHandler.post(() -> {
            List<LogEntry> currentLogs = getLogs();
            for (LogListener listener : listeners) {
                listener.onLogsUpdated(currentLogs);
            }
        });
    }
}
