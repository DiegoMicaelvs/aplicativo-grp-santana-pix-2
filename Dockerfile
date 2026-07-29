# syntax=docker/dockerfile:1

############################
# Base
############################
FROM node:20-alpine AS base
WORKDIR /app
# libc6-compat: necessário para binários nativos (esbuild/rollup) no Alpine
RUN apk add --no-cache libc6-compat
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

############################
# Dependências (todas, inclusive dev)
############################
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

############################
# Desenvolvimento (hot reload via bind mount)
############################
FROM base AS dev
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 5000
# dev:poll usa polling: bind mounts do Docker Desktop não emitem eventos de FS
CMD ["npm", "run", "dev:poll"]

############################
# Build de produção
############################
FROM base AS build
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# vite build -> dist/public ; esbuild -> dist/index.js
RUN npm run build

############################
# Runtime de produção
############################
FROM base AS prod
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
EXPOSE 5000
USER node
CMD ["node", "dist/index.js"]
