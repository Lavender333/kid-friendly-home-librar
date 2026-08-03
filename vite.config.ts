import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: '/kid-friendly-home-librar/',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        VitePWA({
          registerType: 'prompt',
          includeAssets: ['icons/mariahs-library.svg', 'icons/apple-touch-icon.png'],
          manifest: {
            name: "Mariah's Library",
            short_name: "Mariah's Library",
            description: 'A simple family library for adding, lending, and returning books.',
            theme_color: '#F4C2C2',
            background_color: '#B7E0F2',
            display: 'standalone',
            orientation: 'any',
            start_url: '/kid-friendly-home-librar/#/',
            scope: '/kid-friendly-home-librar/',
            icons: [
              {
                src: 'icons/icon-192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any',
              },
              {
                src: 'icons/icon-512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any maskable',
              },
            ],
          },
          workbox: {
            globPatterns: ['**/*.{html,js,css,svg,png,webmanifest}'],
            navigateFallback: 'index.html',
            cleanupOutdatedCaches: true,
          },
        }),
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': import.meta.dirname,
        }
      }
    };
});
