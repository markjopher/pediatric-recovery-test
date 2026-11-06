# Little Steps for Android

Open this `android/` directory as a project in Android Studio, sync Gradle, and run the app on Android 8.0 (API 26) or later.

Build from this directory with `./gradlew :app:assembleDebug` (Windows: `gradlew.bat :app:assembleDebug`). The debug APK is at `app/build/outputs/apk/debug/app-debug.apk`.

The app bundles the root project's `dist/` directory directly as Android assets. Changes to those web files are included on the next Android build; there is no duplicate copy to update. No local server is needed. The WebView serves only an allowlist of bundled files on an HTTPS local origin and exposes no JavaScript bridge. No network permission is requested.

Session data stays in this app's WebView storage and survives restarts. Android backup is disabled. Uninstalling, clearing app data, or using Clear session data removes the record. Existing browser/PWA sessions do not transfer into the Android app.

Setup, fluid/stool/vomiting logs, safety checkpoints, emergency guidance, and the 48-hour timer use the existing web implementation and engine. Native confirmation handles session deletion. The host applies system window insets and resizes for the keyboard. Back dismisses an entry dialog, preserves the emergency dialog until its explicit acknowledgment, or exits the app.

Background notifications are not implemented. Checkpoint due notices are checked while open and when returning to the app. Use the discharge plan for reminder timing. The browser service worker is disabled inside Android because the files are already bundled offline.

This remains the existing developer prototype; use synthetic data for evaluation. Clinical rules are unchanged and still require pediatric clinical review before caregiver use.
