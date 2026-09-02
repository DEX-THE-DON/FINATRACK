package com.finatrack.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.provider.Telephony;
import android.telephony.SmsMessage;
import android.util.Log;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class MpesaSmsReceiver extends BroadcastReceiver {
    private static final String TAG = "FinatrackMpesa";
    // Default server url - can be configured in app
    private static final String WEBHOOK_URL = "http://10.0.2.2:8000/api/mpesa/webhook";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) {
            return;
        }

        SmsMessage[] messages = Telephony.Sms.Intents.getMessagesFromIntent(intent);
        if (messages == null || messages.length == 0) {
            return;
        }

        StringBuilder fullBody = new StringBuilder();
        String sender = messages[0].getDisplayOriginatingAddress();

        for (SmsMessage msg : messages) {
            if (msg.getMessageBody() != null) {
                fullBody.append(msg.getMessageBody());
            }
        }

        String smsText = fullBody.toString();
        Log.d(TAG, "SMS Received from: " + sender);

        // Check if message is an M-Pesa transaction
        String upper = smsText.toUpperCase();
        if (upper.contains("CONFIRMED") && upper.contains("KSH")) {
            Log.d(TAG, "M-Pesa transaction detected! Forwarding to Finatrack webhook...");
            forwardToWebhook(smsText, sender);
        }
    }

    private void forwardToWebhook(final String smsText, final String sender) {
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    URL url = new URL(WEBHOOK_URL);
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("Content-Type", "application/json; utf-8");
                    conn.setRequestProperty("Accept", "application/json");
                    conn.setDoOutput(true);
                    conn.setConnectTimeout(5000);
                    conn.setReadTimeout(5000);

                    // JSON payload escape
                    String escapedSms = smsText.replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "");
                    String jsonInputString = "{\"sms\": \"" + escapedSms + "\", \"sender\": \"" + sender + "\"}";

                    try (OutputStream os = conn.getOutputStream()) {
                        byte[] input = jsonInputString.getBytes(StandardCharsets.UTF_8);
                        os.write(input, 0, input.length);
                    }

                    int code = conn.getResponseCode();
                    Log.d(TAG, "Webhook responded with HTTP code: " + code);
                    conn.disconnect();
                } catch (Exception e) {
                    Log.e(TAG, "Failed to send SMS to webhook: " + e.getMessage());
                }
            }
        }).start();
    }
}
