import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackRouter } from "@tanstack/router-plugin/vite";

import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  // https + LAN host: crypto.subtle (pairing keys) and the camera only exist in
  // secure contexts, and phones on the wifi are not "localhost".
  server: { host: true },
  plugins: [
    basicSsl(),
    devtools(),
    tailwindcss(),
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    viteReact(),
  ],
});

export default config;
