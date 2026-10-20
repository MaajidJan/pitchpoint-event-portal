package com.bahria.paymentlistener;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.provider.Telephony;
import android.telephony.SmsMessage;
import android.util.Log;

public class SmsReceiver extends BroadcastReceiver {

    private static final String TAG = "SmsReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) {
            return;
        }

        try {
            SmsMessage[] messages = Telephony.Sms.Intents.getMessagesFromIntent(intent);
            if (messages == null || messages.length == 0) return;

            StringBuilder fullBody = new StringBuilder();
            String sender = messages[0].getDisplayOriginatingAddress();
            if (sender == null) sender = messages[0].getOriginatingAddress();
            if (sender == null) sender = "Unknown";

            for (SmsMessage msg : messages) {
                if (msg != null && msg.getMessageBody() != null) {
                    fullBody.append(msg.getMessageBody());
                }
            }

            String body = fullBody.toString().trim();
            if (body.isEmpty()) return;

            Log.i(TAG, "Incoming SMS from " + sender + ": " + body);

            boolean isCandidate = PaymentParser.isPaymentNotification("com.android.sms", sender, body);
            if (!isCandidate) {
                return;
            }

            ParsedPayment parsed = PaymentParser.parse(body);

            LogRepository.addLog(
                true,
                "SMS Intercepted: " + sender,
                "TRX: " + (parsed.trxId != null ? parsed.trxId : "Detecting...") + " | Rs. " + (parsed.amount != null ? parsed.amount : "?") + "\n" + body,
                body
            );

            WebhookSender.send(
                context.getApplicationContext(),
                "android.telephony.sms",
                sender,
                body,
                parsed,
                (success, message) -> {
                    Log.d(TAG, "SMS Forwarded: " + success + " - " + message);
                }
            );
        } catch (Exception e) {
            Log.e(TAG, "Error handling SMS", e);
        }
    }
}
