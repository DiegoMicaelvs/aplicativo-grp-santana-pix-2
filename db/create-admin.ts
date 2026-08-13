import "dotenv/config";
import { db } from "./index";
import { users } from "@shared/schema";
import { hashPassword } from "../server/auth";
import { eq } from "drizzle-orm";

/**
 * Cria (ou redefine a senha d)o usuário administrador.
 *
 *   ADMIN_PASSWORD='...' npm run db:create-admin
 *
 * A senha vem SEMPRE do ambiente. A versão anterior trazia a senha real
 * embutida no código e ainda a imprimia no console — e este arquivo está num
 * repositório público, então a credencial de admin de produção ficou legível
 * para qualquer pessoa, e continua no histórico do git. Sem valor padrão aqui:
 * é melhor o script recusar rodar do que criar um admin com senha conhecida.
 *
 * O e-mail também é configurável (ADMIN_EMAIL), com o valor histórico como
 * padrão para não quebrar quem já usa.
 */
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? "admin@gruposantana.com").trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

async function createOrUpdateAdmin() {
  if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12) {
    console.error(
      "ADMIN_PASSWORD é obrigatório e precisa de pelo menos 12 caracteres.\n" +
        "Exemplo:  ADMIN_PASSWORD='<senha forte>' npm run db:create-admin",
    );
    process.exit(1);
  }

  try {
    console.log("Verificando usuário administrador...");

    const hashedPassword = await hashPassword(ADMIN_PASSWORD);

    const existingAdmin = await db.query.users.findFirst({
      where: eq(users.username, ADMIN_EMAIL),
    });

    if (existingAdmin) {
      const [updatedAdmin] = await db
        .update(users)
        .set({
          password: hashedPassword,
          role: "admin",
          isActive: true,
        })
        .where(eq(users.id, existingAdmin.id))
        .returning();

      console.log("Senha do administrador atualizada com sucesso!");
      console.log("Email:", ADMIN_EMAIL);
      // A senha NÃO é impressa: quem executou o comando já a conhece, e o log
      // do terminal costuma sobreviver em histórico e em captura de tela.
      console.log("ID:", updatedAdmin.id);
    } else {
      const result = await db
        .insert(users)
        .values({
          username: ADMIN_EMAIL,
          email: ADMIN_EMAIL,
          password: hashedPassword,
          fullName: "Administrador do Sistema",
          cpf: "12345678901", // CPF único
          phone: "11999999999",
          address: "Grupo Santana",
          shirtSize: "M",
          pixKey: ADMIN_EMAIL,
          role: "admin",
          isActive: true,
          balance: "0",
          totalEarnings: "0",
        })
        .returning();
      const newAdmin = Array.isArray(result) ? result[0] : result;

      console.log("Administrador criado com sucesso!");
      console.log("Email:", ADMIN_EMAIL);
      console.log("ID:", newAdmin.id);
    }
  } catch (error) {
    console.error("Erro ao criar/atualizar administrador:", error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

createOrUpdateAdmin();
