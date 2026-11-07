// Builds the web files, syncs them into the Android project, builds a debug APK,
// and copies it to ../Pilot-Acronyms.apk. Set the app version in android/app/build.gradle.
import { execSync } from "node:child_process";
import { copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = {
  ...process.env,
  JAVA_HOME: process.env.JAVA_HOME || "C:/Program Files/Microsoft/jdk-21.0.8.9-hotspot",
  ANDROID_HOME: process.env.ANDROID_HOME || join(process.env.LOCALAPPDATA, "Android/Sdk"),
};
const run = (command, cwd = root) => execSync(command, { cwd, env, stdio: "inherit" });

run("node scripts/build-www.mjs");
run("npx cap sync android");
run(".\\gradlew.bat clean assembleDebug --console=plain", join(root, "android"));

const output = join(root, "..", "Pilot-Acronyms.apk");
copyFileSync(join(root, "android/app/build/outputs/apk/debug/app-debug.apk"), output);
console.log(`APK written to ${output}`);
