import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  // relative asset paths so the built dist/ folder also works when opened
  // directly via file:// (no server), not just when hosted at a domain root
  base: "./",
  plugins: [
    react(),
    // Vite normally emits the entry as <script type="module">, which browsers
    // refuse to load over file:// (opaque origin, blocked like cross-origin).
    // Inlining everything into one classic <script> in index.html sidesteps
    // that entirely, since this app is meant to be opened directly as a file
    // with no server.
    viteSingleFile(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "日程转 ICS 小工具",
        short_name: "日程转ICS",
        description: "把通知文字粘贴进来，生成可导入 Outlook 的 .ics 日程文件",
        theme_color: "#2b5fa8",
        background_color: "#2b5fa8",
        display: "standalone",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
    }),
  ],
});
