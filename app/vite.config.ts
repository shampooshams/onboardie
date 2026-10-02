import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

// Nitro turns the app into a deployable server. It auto-detects Netlify, Vercel and
// Cloudflare during their builds; set NITRO_PRESET (e.g. "node-server") to target
// anything else, such as a Docker container or a plain VM.
export default defineConfig({
  server: { port: 8080 },
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    tanstackStart({
      // Use src/server.ts (our SSR error wrapper) as the server entry.
      server: { entry: "server" },
    }),
    nitro({
      // Only used on Vercel: run next to the Supabase project in Ireland (eu-west-1), and give
      // slow AI calls (e.g. structuring a long document) up to two minutes.
      vercel: { functions: { regions: ["dub1"], maxDuration: 120 } },
    }),
    viteReact(),
  ],
});
