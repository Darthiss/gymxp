import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Content-Security-Policy for the production build only (Vite's dev server injects
// inline scripts that a strict CSP would block). The app may only talk to the
// GitHub API (your data) and Open-Meteo (weather lookups), which limits what an
// injected script could exfiltrate.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://api.github.com https://api.open-meteo.com",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "manifest-src 'self'",
  "worker-src 'self'",
].join('; ');

function csp(): Plugin {
  return {
    name: 'gymxp-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      );
    },
  };
}

export default defineConfig({
  // Relative base so the build works at https://<user>.github.io/<repo>/
  base: './',
  plugins: [react(), csp()],
  build: { target: 'es2022' },
});
