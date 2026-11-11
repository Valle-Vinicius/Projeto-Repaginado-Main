# Dockerfile multi-stage: build do frontend com Vite + backend Node/Express
FROM node:20-alpine AS builder

WORKDIR /app

# Instala dependências de todo o projeto
COPY package.json package-lock.json ./
RUN npm install

# Copia só o frontend para build
COPY vite.config.js ./
COPY frontend ./frontend
RUN npm run build

# Copia o backend
COPY backend ./backend
RUN cd backend && npm install

FROM node:20-alpine AS runner

WORKDIR /app

# Instala apenas dependências de produção do backend
COPY package.json package-lock.json ./
RUN npm install --omit=dev

COPY --from=builder /app/backend ./backend
COPY --from=builder /app/frontend/dist ./frontend/dist

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "backend/server.js"]
