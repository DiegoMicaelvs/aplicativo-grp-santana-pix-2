import { defineConfig } from "vitest/config";
import path from "path";

const URL_TESTE =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5433/kongpix_test";

export default defineConfig({
  resolve: {
    alias: {
      "@db": path.resolve(import.meta.dirname, "db"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@": path.resolve(import.meta.dirname, "client", "src"),
    },
  },
  test: {
    globalSetup: ["./tests/global-setup.ts"],
    env: {
      NODE_ENV: "test",
      // db/index.ts monta o pool a partir daqui no momento do import
      DATABASE_URL: URL_TESTE,
      DATABASE_SSL: "false",
      SESSION_SECRET: "segredo-de-teste",
      MASTER_PASSWORD: "master-de-teste",
    },
    // Os testes de integração compartilham o mesmo banco: rodar em paralelo
    // faria um TRUNCATE apagar os dados do outro no meio da execução.
    fileParallelism: false,
    // O código de produção loga bastante; sem isto a saída dos testes
    // fica ilegível e uma falha real se perde no meio.
    silent: true,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
