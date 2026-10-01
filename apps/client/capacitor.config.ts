import type { CapacitorConfig } from "@capacitor/cli";

// Android (and later iOS) app wrapper; see docs/android-apk-handoff.md.
// appId can never change once the app is uploaded to Play Console.
const config: CapacitorConfig = {
  appId: "com.jjy.supermaze",
  appName: "Super Maze",
  webDir: "dist",
  android: {
    // Black behind the page while the WebView starts, instead of white.
    backgroundColor: "#000000",
  },
};

export default config;
