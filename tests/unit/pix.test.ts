import { describe, it, expect } from "vitest";
import { checkPixKeyOwnership } from "../../server/pixValidation";

/**
 * Titularidade da chave PIX no saque.
 *
 * Regra de negócio: o indicador só saca para chave que corresponda aos
 * próprios dados — CPF, celular ou e-mail do cadastro. Chave aleatória não é
 * aceita. Chave que não corresponde não é recusada: o saque fica retido para
 * intermediação do financeiro.
 */

const titular = {
  cpf: "98765432100",
  phone: "11988888888",
  email: "joao@example.com",
  username: "joao@example.com",
};

describe("chave que confere com o cadastro", () => {
  it("CPF exato", () => {
    const r = checkPixKeyOwnership("98765432100", titular);
    expect(r.matchesOwner).toBe(true);
    expect(r.kind).toBe("cpf");
  });

  it("CPF formatado com pontos e hífen", () => {
    expect(checkPixKeyOwnership("987.654.321-00", titular).matchesOwner).toBe(true);
  });

  it("e-mail do cadastro", () => {
    const r = checkPixKeyOwnership("joao@example.com", titular);
    expect(r.matchesOwner).toBe(true);
    expect(r.kind).toBe("email");
  });

  it("e-mail com maiúsculas e espaços", () => {
    expect(checkPixKeyOwnership("  JOAO@Example.COM ", titular).matchesOwner).toBe(true);
  });

  it("celular como está no cadastro", () => {
    const r = checkPixKeyOwnership("11988888888", titular);
    expect(r.matchesOwner).toBe(true);
    expect(r.kind).toBe("telefone");
  });

  it("celular com DDI +55 — formato que o PIX realmente usa", () => {
    // O cadastro guarda 11988888888; a chave PIX vem +5511988888888.
    // Sem normalizar o DDI, TODO saque por celular cairia em retido.
    expect(checkPixKeyOwnership("+5511988888888", titular).matchesOwner).toBe(true);
  });

  it("celular formatado com parênteses e hífen", () => {
    expect(checkPixKeyOwnership("(11) 98888-8888", titular).matchesOwner).toBe(true);
  });
});

describe("chave que NÃO confere — vai para retenção", () => {
  it("CPF de terceiro", () => {
    expect(checkPixKeyOwnership("00000000191", titular).matchesOwner).toBe(false);
  });

  it("e-mail de terceiro", () => {
    const r = checkPixKeyOwnership("laranja@fraude.com", titular);
    expect(r.matchesOwner).toBe(false);
    expect(r.kind).toBe("email");
  });

  it("celular de terceiro", () => {
    expect(checkPixKeyOwnership("11977776666", titular).matchesOwner).toBe(false);
  });

  it("chave aleatória (UUID) nunca é aceita", () => {
    const r = checkPixKeyOwnership("a1b2c3d4-e5f6-7890-abcd-ef1234567890", titular);
    expect(r.matchesOwner).toBe(false);
    expect(r.kind).toBe("aleatoria");
    expect(r.reason).toMatch(/aleat/i);
  });

  it("chave vazia", () => {
    expect(checkPixKeyOwnership("", titular).matchesOwner).toBe(false);
    expect(checkPixKeyOwnership("   ", titular).matchesOwner).toBe(false);
  });
});

describe("titular com dados incompletos", () => {
  it("sem telefone cadastrado, chave de telefone não confere", () => {
    const semTelefone = { ...titular, phone: null };
    expect(checkPixKeyOwnership("11988888888", semTelefone).matchesOwner).toBe(false);
  });

  it("sem e-mail cadastrado, cai no username", () => {
    const semEmail = { ...titular, email: null };
    expect(checkPixKeyOwnership("joao@example.com", semEmail).matchesOwner).toBe(true);
  });

  it("sempre devolve um motivo legível", () => {
    const r = checkPixKeyOwnership("laranja@fraude.com", titular);
    expect(r.reason).toBeTruthy();
    expect(r.reason.length).toBeGreaterThan(10);
  });
});
