/**
 * Serviço de arquivos estáticos do client (deploy tradicional).
 *
 * Separado de server/vite.ts porque aquele módulo importa o pacote `vite`
 * (devDependency, ausente no runtime serverless). Aqui só entram express, fs e
 * path — dependências que existem em produção.
 *
 * Na Vercel esta função não é chamada: o client é servido pelo CDN a partir de
 * `outputDirectory` (ver vercel.json).
 */
import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
