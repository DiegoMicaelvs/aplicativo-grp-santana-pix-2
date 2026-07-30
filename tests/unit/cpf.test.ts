import { describe, it, expect } from "vitest";
import {
  cpfEhValido,
  normalizarCpf,
  normalizarTelefone,
  normalizarPlaca,
} from "../../shared/cpf";
import { insertUserSchema } from "../../shared/schema";

/**
 * CPF é a chave que amarra o indicador ao PIX do saque. Antes o cadastro
 * aceitava qualquer sequência de 11 dígitos e gravava do jeito que veio —
 * "123.456.789-09" e "12345678909" viravam DUAS contas para a mesma pessoa.
 */

describe("cpfEhValido", () => {
  it("aceita CPFs válidos", () => {
    // gerados a partir do algoritmo dos dígitos verificadores
    expect(cpfEhValido("52998224725")).toBe(true);
    expect(cpfEhValido("11144477735")).toBe(true);
  });

  it("aceita CPF formatado", () => {
    expect(cpfEhValido("529.982.247-25")).toBe(true);
  });

  it("rejeita dígito verificador errado", () => {
    expect(cpfEhValido("52998224726")).toBe(false);
    expect(cpfEhValido("12345678901")).toBe(false);
  });

  it("rejeita sequências repetidas", () => {
    // Passam no cálculo dos verificadores, mas não são CPFs reais.
    for (const d of "0123456789") {
      expect(cpfEhValido(d.repeat(11))).toBe(false);
    }
  });

  it("rejeita tamanho errado", () => {
    expect(cpfEhValido("529982247")).toBe(false);
    expect(cpfEhValido("529982247250")).toBe(false);
    expect(cpfEhValido("")).toBe(false);
  });
});

describe("normalização", () => {
  it("CPF fica só com dígitos", () => {
    expect(normalizarCpf("529.982.247-25")).toBe("52998224725");
    expect(normalizarCpf(" 529 982 247 25 ")).toBe("52998224725");
  });

  it("telefone perde o DDI 55", () => {
    // A chave PIX chega com DDI; o cadastro guarda sem.
    expect(normalizarTelefone("+5511988887777")).toBe("11988887777");
    expect(normalizarTelefone("(11) 98888-7777")).toBe("11988887777");
    expect(normalizarTelefone("11988887777")).toBe("11988887777");
  });

  it("placa fica em caixa alta sem separadores", () => {
    expect(normalizarPlaca("abc-1d23")).toBe("ABC1D23");
    expect(normalizarPlaca("ABC 1D23")).toBe("ABC1D23");
    expect(normalizarPlaca("ABC1D23")).toBe("ABC1D23");
  });
});

describe("insertUserSchema aplica a normalização", () => {
  const base = {
    username: "a@b.com",
    email: "a@b.com",
    password: "senha123",
    fullName: "Fulano de Tal",
    pixKey: "a@b.com",
  };

  it("grava o CPF só com dígitos, venha como vier", () => {
    const r = insertUserSchema.parse({
      ...base,
      cpf: "529.982.247-25",
      phone: "(11) 98888-7777",
    });
    expect(r.cpf).toBe("52998224725");
    expect(r.phone).toBe("11988887777");
  });

  it("recusa CPF com dígito verificador errado", () => {
    const r = insertUserSchema.safeParse({ ...base, cpf: "12345678901", phone: "11988887777" });
    expect(r.success).toBe(false);
  });

  it("recusa CPF de dígitos repetidos", () => {
    const r = insertUserSchema.safeParse({ ...base, cpf: "00000000000", phone: "11988887777" });
    expect(r.success).toBe(false);
  });

  it("as duas grafias do MESMO CPF produzem o mesmo valor gravado", () => {
    // É isto que faz a UNIQUE do banco realmente impedir conta duplicada.
    const comPontos = insertUserSchema.parse({ ...base, cpf: "529.982.247-25", phone: "11988887777" });
    const semPontos = insertUserSchema.parse({ ...base, cpf: "52998224725", phone: "11988887777" });
    expect(comPontos.cpf).toBe(semPontos.cpf);
  });
});
