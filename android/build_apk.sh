#!/bin/sh
# Builds ANCHOR-Mobile.apk from ../app with the Android SDK command-line tools (aapt, javac, dx, zipalign, apksigner).
set -e
cd "$(dirname "$0")"
SDK=${ANDROID_SDK:-/usr/lib/android-sdk}; BT=$SDK/build-tools/${BUILD_TOOLS:-debian}; JAR=$SDK/platforms/android-23/android.jar
rm -rf out && mkdir -p out/assets out/classes out/gen
cp -r ../app out/assets/app && rm -f out/assets/app/sw.js
$BT/aapt package -f -m -J out/gen -M AndroidManifest.xml -S res -I $JAR
javac -nowarn -source 8 -target 8 -bootclasspath $JAR -classpath $JAR -d out/classes out/gen/de/kastour/anchor/R.java src/de/kastour/anchor/*.java 2>out/javac.log || { cat out/javac.log; exit 1; }
$BT/dx --dex --output=out/classes.dex out/classes
$BT/aapt package -f -M AndroidManifest.xml -S res -A out/assets -I $JAR -F out/unsigned.apk -0 woff2 -0 png
(cd out && $BT/aapt add unsigned.apk classes.dex >/dev/null)
$BT/zipalign -f 4 out/unsigned.apk out/aligned.apk
KS=${KEYSTORE:-anchor-release.keystore}
[ -f "$KS" ] || keytool -genkeypair -keystore "$KS" -alias anchor -keyalg RSA -keysize 3072 -validity 10000 -storepass "${KS_PASS:-anchor-mobile}" -keypass "${KS_PASS:-anchor-mobile}" -dname "CN=A. Mamdouh Kastour, O=ANCHOR Studio" >/dev/null 2>&1
$BT/apksigner sign --ks "$KS" --ks-pass pass:${KS_PASS:-anchor-mobile} --ks-key-alias anchor --out ANCHOR-Mobile.apk out/aligned.apk
$BT/apksigner verify --print-certs ANCHOR-Mobile.apk | head -3
ls -la ANCHOR-Mobile.apk
