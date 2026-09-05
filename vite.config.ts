import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Enregistrement automatique du SW via autoUpdate :
      // dès qu'une nouvelle version est détectée, le nouveau SW prend le relais
      // au prochain refresh. Pas de prompt "Update available" à cliquer.
      registerType: 'autoUpdate',

      // Injection auto du snippet d'enregistrement du SW (avant le </body>)
      injectRegister: 'auto',

      // Manifest PWA généré à partir de cette config
      manifest: {
        name: 'Suivi-dette — Camion pizza',
        short_name: 'Suivi-dette',
        description:
          'Suivi du paiement du camion pizza (Freddy → Francky) — mensualités de 500 €',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'fr',
        categories: ['business', 'productivity', 'utilities'],
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },

      // Configuration Workbox (le service worker généré sous le capot)
      workbox: {
        // Aucun fallback HTML offline : si la page demandée n'est pas dans le cache
        // et qu'on est offline, le navigateur affichera sa propre page d'erreur
        // (pas un faux "app fonctionne" qui ne pourrait pas joindre Convex).
        navigateFallback: undefined,

        // CRITIQUE : ne JAMAIS servir de fallback HTML pour ces routes.
        // Sans ça, le SW pourrait servir index.html depuis le cache pour des
        // URLs Convex ou /api, ce qui masquerait les erreurs réseau réelles.
        navigateFallbackDenylist: [
          /^\/api\//,
          /^https:\/\/.*\.convex\.cloud/,
          /^https:\/\/.*\.convex\.site/,
        ],

        // runtimeCaching : règles explicites par pattern d'URL.
        // Les requêtes Convex et /api sont en NetworkOnly (jamais servies du cache).
        runtimeCaching: [
          {
            // Convex Cloud (queries / mutations / actions via WebSocket + HTTP)
            urlPattern: /^https:\/\/.*\.convex\.cloud/,
            handler: 'NetworkOnly',
          },
          {
            // Convex Site (HTTP actions : webhook MacroDroid, /api/ia, etc.)
            urlPattern: /^https:\/\/.*\.convex\.site/,
            handler: 'NetworkOnly',
          },
          {
            // Proxy dev local /api/* → inscription.ableiges.com
            urlPattern: /^\/api\//,
            handler: 'NetworkOnly',
          },
          {
            // Images : cache-first avec expiration 30 jours
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'pwa-images',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
          {
            // Fonts : cache-first, 1 an
            urlPattern: /\.(?:woff2?|ttf|eot)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'pwa-fonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],

        // Nettoyer les anciens caches lors d'un nouveau déploiement
        cleanupOutdatedCaches: true,

        // Pré-cacher les assets générés par Vite (JS / CSS / manifest / icons)
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webp,woff,woff2}'],
      },

      // Désactiver le SW en dev (sinon il interfère avec le HMR Vite)
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      // Force Vite to resolve the Convex generated files
      'convex/_generated': path.resolve(__dirname, 'convex/_generated'),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://inscription.ableiges.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      },
      // Endpoint webhook simulé - Fixed target URL to prevent routing conflicts
      '/api/webhook/sms-update': {
        target: 'http://localhost:8000', // Changed from localhost:5173 to prevent conflicts
        changeOrigin: false,
        selfHandleResponse: true,
        configure: (proxy, _options) => {
          // Intercepter les requêtes webhook et les traiter localement
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Simuler le traitement du webhook
            console.log('🔗 Webhook SMS intercepté:', req.method, req.url);
            
            // Empêcher la requête de continuer vers le proxy
            proxyReq.destroy();
            
            // Traiter la requête webhook localement
            let body = '';
            req.on('data', chunk => {
              body += chunk.toString();
            });
            
            req.on('end', async () => {
              try {
                const { WebhookEndpoint } = await import('./src/services/webhookService');
                
                const webhookRequest = {
                  method: req.method || 'POST',
                  url: req.url || '',
                  headers: req.headers as Record<string, string>,
                  body: body ? JSON.parse(body) : {}
                };
                
                const result = await WebhookEndpoint.handleRequest(webhookRequest);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
              } catch (error) {
                console.error('Erreur webhook:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                  success: false, 
                  message: 'Erreur interne du webhook' 
                }));
              }
            });
          });
        },
      }
    }
  }
});