import { prepararBancoDeTeste } from "./setup-db";

/**
 * Roda UMA vez antes de toda a suíte: recria o banco de teste com o schema
 * atual. Cada arquivo de teste limpa as tabelas no seu próprio beforeEach.
 */
export default async function setup() {
  await prepararBancoDeTeste();
}
