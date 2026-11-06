# Little Steps

## Android app

An offline Android app is available in [`android/`](android/README.md). Open that folder in Android Studio, sync Gradle, and run on Android 8.0 or newer. It bundles the web tracker directly; no development server is required. Background notifications are not implemented in this version.

Local developer prototype for the 48-hour pediatric recovery handoff. It uses a static, installable PWA and stores one session and its events in browser storage. The service worker caches the app after the first successful load. No account, analytics, or server-side patient data is used.

## Run

From this directory with Node.js installed, run `npm start` and open http://localhost:4173. Run `npm test` to verify the clinical rule boundaries. For mobile installation, serve `dist/` from an HTTPS origin and use the browser's install or Add to Home Screen action. Use synthetic data for evaluation.

## Handoff decisions

- The four-hour baseline is four times the clinician-entered hourly goal. The estimated replacement adds 10 mL/kg per watery stool and 2 mL/kg per vomiting episode. Formed stools are tracked separately. The estimate does not determine how much to give at once.
- A recorded retained intake interrupts consecutive vomiting. A negative urine answer means the caregiver explicitly confirmed no urine in the preceding six hours. Missing records and “unsure” are treated as unknown.
- Each scheduled two-hour checkpoint includes a prescribed zinc check when a dose was entered and none was recorded on the device's current calendar day. The app does not select or change a dose. Browser notifications are best effort while the page runs and the app checks for the latest due reminder on return. Closed-app offline delivery requires a native scheduling implementation.
- Referral remains visible in the session until the data is cleared. The 48-hour timer ending indicates completion of tracking.
- Storage belongs to the browser and origin. Clearing site data, using a different browser, or browser eviction can remove access to the record. Use one tab per session to avoid simultaneous writes.
- The escalation thresholds implement the developer handoff and require pediatric clinical review before caregiver use. The replacement coefficients appear in the [CDC oral rehydration guidance](https://www.cdc.gov/mmwr/preview/mmwrhtml/rr5216a1.htm). [NICE guidance](https://www.nice.org.uk/guidance/cg84/chapter/Recommendations) describes age-specific fever and dehydration signs.
