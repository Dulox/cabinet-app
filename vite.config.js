import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// For GitHub Pages at https://<user>.github.io/<repo>/ set base to "/<repo>/".
// The deploy workflow sets this automatically via the BASE_PATH env var.
// For Vercel / Netlify, leave it as "/".
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH || "/",
});
