import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_ROOT = path.resolve(__dirname, 'frontend');
const FRONTEND_SRC = path.resolve(FRONTEND_ROOT, 'src');

// Mapeamento de rotas MPA para arquivos HTML no desenvolvimento
const PAGINAS_MPA = {
  login: 'src/pages/login/index.html',
  dashboard: 'src/pages/dashboard/index.html',
  produtos: 'src/pages/produtos/index.html',
  estoque: 'src/pages/estoque/index.html',
  recebimentos: 'src/pages/recebimentos/index.html',
  expedicoes: 'src/pages/expedicoes/index.html',
  auditoria: 'src/pages/auditoria/index.html',
  relatorios: 'src/pages/relatorios/index.html',
  validade: 'src/pages/validade/index.html',
  usuarios: 'src/pages/usuarios/index.html',
  configuracoes: 'src/pages/configuracoes/index.html',
  'formulario-produto': 'src/pages/formulario-produto/index.html',
  'redefinir-senha': 'src/pages/redefinir-senha/index.html',
  erro404: 'src/pages/erro404/index.html',
};
const ENTRADAS_MPA = Object.fromEntries(
  Object.entries(PAGINAS_MPA).map(([nome, arquivo]) => [
    nome,
    path.resolve(FRONTEND_ROOT, arquivo),
  ])
);

// Middleware para servir páginas MPA e assets estáticos em desenvolvimento
function mpaMiddleware() {
  return {
    name: 'babycare-mpa',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '/';
        // Ignorar requisições de API e internos do Vite
        if (url.startsWith('/api/') || url.startsWith('/@fs/') || url.startsWith('/@id/')) {
          return next();
        }

        // Servir assets estáticos: /css/*, /assets/*
        const caminhoUrl = url.split('?')[0].split('#')[0];
        if (caminhoUrl.startsWith('/css/') || caminhoUrl.startsWith('/assets/')) {
          const caminhoArquivo = path.resolve(FRONTEND_SRC, caminhoUrl.slice(1));
          if (fs.existsSync(caminhoArquivo)) {
            const ext = path.extname(caminhoArquivo).toLowerCase();
            const mimeTypes = {
              '.css': 'text/css',
              '.js': 'application/javascript',
              '.png': 'image/png',
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.svg': 'image/svg+xml',
              '.ico': 'image/x-icon',
              '.woff': 'font/woff',
              '.woff2': 'font/woff2',
              '.ttf': 'font/ttf',
            };
            res.statusCode = 200;
            res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
            res.setHeader('charset', 'UTF-8');
            res.end(fs.readFileSync(caminhoArquivo));
            return;
          }
          res.statusCode = 404;
          res.end('Arquivo não encontrado');
          return;
        }

        // Extrair o nome da rota (ex: /login -> login)
        const caminho = caminhoUrl;
        const partes = caminho.split('/').filter(Boolean);
        const rota = (partes[0] || 'login').replace(/\.(?:js|html)$/, '');

        // Se a rota corresponde a uma página MPA conhecida
        if (PAGINAS_MPA[rota]) {
          const arquivoModulo = path.resolve(FRONTEND_SRC, 'pages', rota, `${rota}.js`);
          if (caminho === `/${rota}.js` && fs.existsSync(arquivoModulo)) {
            req.url = `/src/pages/${rota}/${rota}.js${url.slice(caminho.length)}`;
            return next();
          }

          const arquivoHtml = path.resolve(FRONTEND_ROOT, PAGINAS_MPA[rota]);
          if (
            fs.existsSync(arquivoHtml) &&
            (caminho === `/${rota}` ||
              caminho === `/${rota}/` ||
              caminho === `/${rota}.html`)
          ) {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/html; charset=UTF-8');
            res.end(fs.readFileSync(arquivoHtml));
            return;
          }
        }

        // Para a raiz, redirecionar para login
        if (caminho === '' || caminho === '/') {
          res.statusCode = 302;
          res.setHeader('Location', '/login');
          res.end();
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  root: FRONTEND_ROOT,
  base: '/',

  build: {
    outDir: path.resolve(FRONTEND_ROOT, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: ENTRADAS_MPA,
    },
  },

  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        ws: false,
        configure: (proxy) => {
          proxy.on('error', (err, req, res) => {
            console.log('[Vite Proxy] Erro:', err.message);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            proxyReq.setHeader('credentials', 'include');
          });
        },
      },
    },
  },

  plugins: [mpaMiddleware()],

  resolve: {
    alias: {
      '@core': path.resolve(FRONTEND_SRC, 'js/core'),
      '@css': path.resolve(FRONTEND_SRC, 'css'),
      '@assets': path.resolve(FRONTEND_SRC, 'assets'),
    },
  },
});
