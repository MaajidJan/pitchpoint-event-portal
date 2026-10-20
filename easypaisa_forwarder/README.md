# 📲 Android Payment Forwarder (Easypaisa / Raast / Bank Sync)

An ultra-lightweight, background Android service that automatically listens for incoming transaction notifications (Easypaisa, Raast, JazzCash, Commercial Bank SMS) and securely pushes verified payment records to your Cloudflare Worker backend in real-time.

---

## 🎯 What This App Solves
* **No Manual Slip Checking**: Eliminates manual screenshot verification delays at registration and ticketing desks.
* **Instant Auto-Claim**: When an attendee transfers registration fees, their phone notification triggers this forwarder, matching the transaction ID (TRX ID) on the server within **1.2 seconds**.
* **Zero Disruption Offline Queue**: If the phone loses internet connectivity, transactions are cached locally in SQLite and synchronized automatically once back online.

---

## 🚀 Option 1: Quick Install (NO Android Studio Needed)

If you don't know Android Studio or just want to run the app immediately:

1. **Copy the APK to your phone**:
   * Locate `EasypaisaForwarder.apk` in the root or `public/` directory of this repo.
   * Send it to your Android device via WhatsApp, Google Drive, or USB cable.
2. **Install**:
   * Tap the file on your phone. If prompted, allow **"Install from unknown sources"**.
3. **Grant Required Permissions**:
   * **Notification Access**: Open Android Settings → *Special App Access* → *Notification Access* → Enable **Payment Forwarder**.
   * **Battery Optimization Exemption**: When prompted in the app, disable battery optimization so Android doesn't kill the service in sleep mode.
4. **Configure Your Endpoint**:
   * Open the app.
   * **Webhook URL**: `https://your-worker-subdomain.workers.dev/api/webhook/payment`
   * **Webhook Secret**: The secret matching `WEBHOOK_SECRET` in your `wrangler.jsonc`.
   * Tap **`[Save Settings & Start Service]`**.
   * A green telemetry indicator will confirm: `SERVICE RUNNING: ONLINE`.

---

## 🛠️ Option 2: Build From Source (Android Studio)

For developers wanting to customize parsing regex or branding:

### Prerequisites
* **Android Studio** (Koala / Ladybug or newer)
* **JDK 17** or **JDK 21**
* Android Device or Emulator running **Android 8.0 (API 26) to Android 15 (API 35)**

### Steps
1. Launch Android Studio and click **Open**.
2. Select the `easypaisa_forwarder` directory.
3. Wait for Gradle to finish syncing dependencies (Retrofit, OkHttp, Gson).
4. Connect your Android phone with **USB Debugging** enabled.
5. Click the green **Run (▶)** button or build a release APK via **Build → Build APK(s)**.

---

## 🔒 Security & Privacy Architecture
* **HMAC Authentication**: Every outgoing HTTP POST request is signed with `X-Webhook-Secret` matching your serverless backend.
* **Regex Isolation**: Only transactional text containing amounts (`Rs.`, `PKR`, `Sent you`, `Received from`, `TRX ID`) is parsed; personal WhatsApp/SMS conversations are completely ignored.
* **Zero Third-Party Relays**: Direct point-to-point communication from the phone straight to your Cloudflare Worker. No Firebase, AWS, or intermediate servers.
