package com.bahria.paymentlistener;

import android.Manifest;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import java.util.List;
import java.util.Random;

public class MainActivity extends AppCompatActivity implements LogRepository.LogListener {

    private TextView tvGlobalStatus;
    private TextView tvNotifPermissionDesc;
    private Button btnGrantNotifPermission;
    private TextView tvBatteryDesc;
    private Button btnExemptBattery;
    private Button btnSendTestPayment;
    private View headerSettingsToggle;
    private TextView tvSettingsToggleIcon;
    private View containerSettings;
    private EditText etWebhookUrl;
    private EditText etWebhookSecret;
    private Button btnSaveSettings;
    private TextView btnClearLogs;
    private TextView tvEmptyLogs;
    private LinearLayout logsContainer;

    private AppPreferences prefs;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        prefs = new AppPreferences(this);
        bindViews();
        setupListeners();
        checkAndRequestPermissions();

        // Start 24/7 background foreground service
        KeepAliveService.start(this);
    }

    @Override
    protected void onResume() {
        super.onResume();
        updatePermissionStatus();
        LogRepository.addListener(this);
    }

    @Override
    protected void onPause() {
        super.onPause();
        LogRepository.removeListener(this);
    }

    private void bindViews() {
        tvGlobalStatus = findViewById(R.id.tvGlobalStatus);
        tvNotifPermissionDesc = findViewById(R.id.tvNotifPermissionDesc);
        btnGrantNotifPermission = findViewById(R.id.btnGrantNotifPermission);
        tvBatteryDesc = findViewById(R.id.tvBatteryDesc);
        btnExemptBattery = findViewById(R.id.btnExemptBattery);
        btnSendTestPayment = findViewById(R.id.btnSendTestPayment);
        headerSettingsToggle = findViewById(R.id.headerSettingsToggle);
        tvSettingsToggleIcon = findViewById(R.id.tvSettingsToggleIcon);
        containerSettings = findViewById(R.id.containerSettings);
        etWebhookUrl = findViewById(R.id.etWebhookUrl);
        etWebhookSecret = findViewById(R.id.etWebhookSecret);
        btnSaveSettings = findViewById(R.id.btnSaveSettings);
        btnClearLogs = findViewById(R.id.btnClearLogs);
        tvEmptyLogs = findViewById(R.id.tvEmptyLogs);
        logsContainer = findViewById(R.id.logsContainer);

        etWebhookUrl.setText(prefs.getWebhookUrl());
        etWebhookSecret.setText(prefs.getWebhookSecret());
    }

    private void setupListeners() {
        headerSettingsToggle.setOnClickListener(v -> {
            boolean isVisible = containerSettings.getVisibility() == View.VISIBLE;
            containerSettings.setVisibility(isVisible ? View.GONE : View.VISIBLE);
            tvSettingsToggleIcon.setText(isVisible ? "[Edit]" : "[Close]");
        });

        btnSaveSettings.setOnClickListener(v -> {
            String url = etWebhookUrl.getText().toString().trim();
            String secret = etWebhookSecret.getText().toString().trim();
            if (!url.isEmpty()) {
                prefs.setWebhookUrl(url);
                prefs.setWebhookSecret(secret);
                Toast.makeText(this, "Settings saved!", Toast.LENGTH_SHORT).show();
                containerSettings.setVisibility(View.GONE);
                tvSettingsToggleIcon.setText("[Edit]");
            } else {
                Toast.makeText(this, "Webhook URL cannot be empty", Toast.LENGTH_SHORT).show();
            }
        });

        btnGrantNotifPermission.setOnClickListener(v -> openNotificationSettings());
        btnExemptBattery.setOnClickListener(v -> requestIgnoreBatteryOptimization());
        btnSendTestPayment.setOnClickListener(v -> sendTestPayment());
        btnClearLogs.setOnClickListener(v -> LogRepository.clear());
    }

    private void checkAndRequestPermissions() {
        java.util.List<String> perms = new java.util.ArrayList<>();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                perms.add(Manifest.permission.POST_NOTIFICATIONS);
            }
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECEIVE_SMS) != PackageManager.PERMISSION_GRANTED) {
            perms.add(Manifest.permission.RECEIVE_SMS);
        }
        if (!perms.isEmpty()) {
            ActivityCompat.requestPermissions(this, perms.toArray(new String[0]), 101);
        }

        if (!isNotificationAccessGranted()) {
            new androidx.appcompat.app.AlertDialog.Builder(this)
                .setTitle("⚠️ Enable Notification Access")
                .setMessage("To automatically capture and verify Zindigi, Raast & bank transactions, please turn ON 'Notification Access' for this app in Settings.\n\nTap 'Enable Now' and toggle this app ON.")
                .setPositiveButton("Enable Now", (dialog, which) -> openNotificationSettings())
                .setNegativeButton("Later", null)
                .show();
        }
    }

    private boolean isNotificationAccessGranted() {
        ComponentName cn = new ComponentName(this, EasypaisaNotificationService.class);
        String flat = Settings.Secure.getString(getContentResolver(), "enabled_notification_listeners");
        return flat != null && flat.contains(cn.flattenToString());
    }

    private boolean isBatteryOptimized() {
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            return !pm.isIgnoringBatteryOptimizations(getPackageName());
        }
        return false;
    }

    private void updatePermissionStatus() {
        boolean notifGranted = isNotificationAccessGranted();
        boolean batteryOptimized = isBatteryOptimized();

        if (notifGranted) {
            tvNotifPermissionDesc.setText("Granted — Active for Zindigi, Raast, Easypaisa, JazzCash & Banks");
            tvNotifPermissionDesc.setTextColor(ContextCompat.getColor(this, R.color.success_green));
            btnGrantNotifPermission.setText("Active");
            btnGrantNotifPermission.setEnabled(false);
        } else {
            tvNotifPermissionDesc.setText("Permission REQUIRED to capture Zindigi / Raast payments");
            tvNotifPermissionDesc.setTextColor(ContextCompat.getColor(this, R.color.error_red));
            btnGrantNotifPermission.setText("Grant Access");
            btnGrantNotifPermission.setEnabled(true);
        }

        if (!batteryOptimized) {
            tvBatteryDesc.setText("Exempted - 24/7 background mode allowed");
            tvBatteryDesc.setTextColor(ContextCompat.getColor(this, R.color.success_green));
            btnExemptBattery.setText("Active");
            btnExemptBattery.setEnabled(false);
        } else {
            tvBatteryDesc.setText("Recommended: Prevent Android from killing service");
            tvBatteryDesc.setTextColor(ContextCompat.getColor(this, R.color.warning_yellow));
            btnExemptBattery.setText("Exempt");
            btnExemptBattery.setEnabled(true);
        }

        if (notifGranted) {
            tvGlobalStatus.setText("ONLINE");
            tvGlobalStatus.setBackgroundResource(R.drawable.bg_badge_active);
            tvGlobalStatus.setTextColor(ContextCompat.getColor(this, R.color.success_green));
        } else {
            tvGlobalStatus.setText("SETUP NEEDED");
            tvGlobalStatus.setBackgroundResource(R.drawable.bg_badge_warning);
            tvGlobalStatus.setTextColor(ContextCompat.getColor(this, R.color.error_red));
        }
    }

    private void openNotificationSettings() {
        try {
            startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS));
            Toast.makeText(this, "Find 'Payment Forwarder' and turn toggle ON", Toast.LENGTH_LONG).show();
        } catch (Exception e) {
            Toast.makeText(this, "Could not open settings: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    private void requestIgnoreBatteryOptimization() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(Uri.parse("package:" + getPackageName()));
                startActivity(intent);
            } catch (Exception e) {
                try {
                    startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
                } catch (Exception ex) {
                    Toast.makeText(this, "Battery settings not available", Toast.LENGTH_SHORT).show();
                }
            }
        }
    }

    private void sendTestPayment() {
        long randomDigits = 10000000L + (long) (new Random().nextDouble() * 89999999L);
        String testTrxId = "489" + randomDigits;
        String testSender = "HAMID RAZA";
        String testPhone = "03292092724";
        double testAmount = 1000.0;

        String rawMsg = "Trx ID: " + testTrxId + " You have received Rs. 1000.00 through Raast Payment Received from " + testSender + " (" + testPhone + ").";
        ParsedPayment parsed = new ParsedPayment(testTrxId, testAmount, testSender, testPhone, rawMsg);

        Toast.makeText(this, "Testing Zindigi Webhook: TRX " + testTrxId, Toast.LENGTH_SHORT).show();

        WebhookSender.send(
            this,
            "com.jsbl.zindigi",
            "Transaction Alert",
            rawMsg,
            parsed,
            (success, message) -> {
                Toast.makeText(
                    MainActivity.this,
                    success ? "Verified Live: " + message : "Failed: " + message,
                    Toast.LENGTH_LONG
                ).show();
            }
        );
    }

    @Override
    public void onLogsUpdated(List<LogEntry> logs) {
        if (logs.isEmpty()) {
            tvEmptyLogs.setVisibility(View.VISIBLE);
            logsContainer.removeAllViews();
            return;
        }

        tvEmptyLogs.setVisibility(View.GONE);
        logsContainer.removeAllViews();

        LayoutInflater inflater = LayoutInflater.from(this);
        int max = Math.min(logs.size(), 25);
        for (int i = 0; i < max; i++) {
            LogEntry entry = logs.get(i);
            View itemView = inflater.inflate(R.layout.item_log, logsContainer, false);

            View indicatorDot = itemView.findViewById(R.id.indicatorDot);
            TextView tvLogTitle = itemView.findViewById(R.id.tvLogTitle);
            TextView tvLogTime = itemView.findViewById(R.id.tvLogTime);
            TextView tvLogDetails = itemView.findViewById(R.id.tvLogDetails);

            tvLogTitle.setText(entry.title);
            tvLogTime.setText(entry.timestamp);
            tvLogDetails.setText(entry.details);
            indicatorDot.setBackgroundResource(entry.isSuccess ? R.drawable.bg_badge_active : R.drawable.bg_badge_warning);

            logsContainer.addView(itemView);
        }
    }
}
