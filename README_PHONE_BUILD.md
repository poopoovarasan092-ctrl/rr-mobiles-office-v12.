# Build the APK using only your Android phone

This project includes a GitHub Actions workflow at `.github/workflows/android-apk.yml`.

1. Create a new GitHub repository, for example `rr-mobiles-offline-v10`.
2. Upload the contents of this ZIP to the repository root (not the ZIP file itself). Make sure hidden `.github` folder and workflow are included. GitHub mobile web may hide dot-folders; if so, use GitHub's desktop-site view in Chrome.
3. Open the repository's **Actions** tab.
4. Select **Build RR Mobiles Offline APK** and tap **Run workflow** (or push to `main`, which triggers it automatically).
5. Wait for the workflow to finish successfully.
6. Open the completed workflow run, scroll to **Artifacts**, and download `RR-Mobiles-Offline-V10-debug-apk`.
7. Extract the artifact ZIP on your phone and install `app-debug.apk`. Android may ask permission to install unknown apps for the browser or file manager you used.

This workflow produces a debug APK for testing, not a Play Store release. Do not use it for real shop transactions until offline billing, stock, credit, app restart persistence, and data-loss scenarios have been tested. Keep the original V10 website unchanged.


## RR Mobiles Office V12 install notes

V12 uses Android application ID `in.rrmobiles.office.v12`, intentionally different from V11. This allows V12 to be installed alongside V11 without uninstalling it or overwriting V11's app-private data. V12 uses a fresh IndexedDB database named `rr-mobiles-offline-v12`; it starts empty.

### Build APK with GitHub Actions
1. Upload the complete contents of this project to a new GitHub repository (or a separate `v12` branch). Do not overwrite the live V11 repository until V12 is tested.
2. Open **Actions** and run **Build RR Mobiles Office V12 APK**.
3. Open the successful workflow run, scroll to **Artifacts**, and download `RR-Mobiles-Office-V12-debug-apk`.
4. Extract the ZIP artifact on your phone and tap `app-debug.apk` to install. Allow Android to install apps from the browser/files app if prompted.
5. V12 should install as a separate app beside V11. Keep V11 installed until V12 is fully tested.

Debug APKs are not suitable for seamless updates if each build receives a different debug key. A persistent release keystore and GitHub Actions secrets are required for consistent signed releases. Do not share keystore files or passwords.
