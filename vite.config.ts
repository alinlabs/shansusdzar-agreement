import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
      // Serve and emit unmodified pdf.worker.min.mjs at /pdf.worker.min.mjs so
      // PDF.js never hits /node_modules/...?import with /@vite/client injected.
      {
        name: 'pdfjs-worker-static',
        configureServer(server) {
          server.middlewares.use('/pdf.worker.min.mjs', (_req, res, next) => {
            const workerPath = path.resolve(
              __dirname,
              'node_modules/pdfjs-dist/build/pdf.worker.min.mjs'
            );
            if (!fs.existsSync(workerPath)) {
              next();
              return;
            }
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            fs.createReadStream(workerPath).pipe(res);
          });
        },
        closeBundle(error?: Error): void {
          if (error) return;
          const distDir = path.resolve(__dirname, 'dist');
          const workerSrc = path.resolve(
            __dirname,
            'node_modules/pdfjs-dist/build/pdf.worker.min.mjs'
          );
          const workerDest = path.resolve(distDir, 'pdf.worker.min.mjs');
          if (fs.existsSync(distDir) && fs.existsSync(workerSrc)) {
            fs.copyFileSync(workerSrc, workerDest);
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
