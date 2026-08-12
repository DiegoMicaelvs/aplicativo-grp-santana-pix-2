import { defineConfig } from "vitest/config";
import path from "path";

/**
 * Config só dos testes UNITÁRIOS. Não sobe banco: rateio, PIX e CPF são
 * funções puras. Serve para rodar rápido e sem depender do Docker.
 * Os testes de integração usam vitest.config.ts (com globalSetup do Postgres).
 */
export default defineConfig({
  resolve: {
    alias: {
      "@db": path.resolve(import.meta.dirname, "db"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@": path.resolve(import.meta.dirname, "client", "src"),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    env: {
      NODE_ENV: "test",
      SESSION_SECRET: "segredo-de-teste",
      MASTER_PASSWORD: "master-de-teste",
    },
  },
});
