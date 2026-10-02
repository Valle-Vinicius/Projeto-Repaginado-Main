"use strict";
/**
 * TESTES DE AUTORIZAÇÃO
 * Verifica diretamente na API quem PODE e quem NÃO PODE acessar cada
 * endpoint protegido, de acordo com as rotas reais do backend.
 */

const { config } = require("../helpers/env");
const { iniciarServidor, encerrarServidor, requisitar, login } = require("../helpers/server");

beforeAll(async () => {
  await iniciarServidor();
});

afterAll(async () => {
  await encerrarServidor();
});

async function tokenDe(usuario) {
  const resultado = await login(usuario.email, usuario.senha);
  return resultado.token;
}

describe("Autorização - endpoints acessíveis aos 3 perfis", () => {
  const endpoints = [
    ["GET", "/api/dashboard", null],
    ["GET", "/api/produtos", null],
    ["GET", "/api/produtos/categorias", null],
    ["GET", "/api/estoque", null],
    ["GET", "/api/recebimentos", null],
    ["GET", "/api/expedicoes", null],
    ["GET", "/api/auditorias", null],
    ["GET", "/api/relatorios", null],
    ["GET", "/api/perfil", null],
  ];

  it.each(endpoints)("operador: %s %s", async (metodo, caminho) => {
    const token = await tokenDe(config.USUARIO_OPERADOR);
    const resultado = await requisitar(caminho, { metodo, token });
    expect([200, 201]).toContain(resultado.status);
    expect(resultado.corpo.sucesso).toBe(true);
  });

  it.each(endpoints)("gerente: %s %s", async (metodo, caminho) => {
    const token = await tokenDe(config.USUARIO_GERENTE);
    const resultado = await requisitar(caminho, { metodo, token });
    expect([200, 201]).toContain(resultado.status);
    expect(resultado.corpo.sucesso).toBe(true);
  });

  it.each(endpoints)("administrador: %s %s", async (metodo, caminho) => {
    const token = await tokenDe(config.USUARIO_ADMIN);
    const resultado = await requisitar(caminho, { metodo, token });
    expect([200, 201]).toContain(resultado.status);
    expect(resultado.corpo.sucesso).toBe(true);
  });
});

describe("Autorização - gestão de usuários (gerente e administrador)", () => {
  const endpointsGestao = [
    ["GET", "/api/usuarios"],
    ["GET", "/api/usuarios/opcoes"],
  ];

  it.each(endpointsGestao)("gerente: %s %s -> 200", async (metodo, caminho) => {
    const token = await tokenDe(config.USUARIO_GERENTE);
    const resultado = await requisitar(caminho, { metodo, token });
    expect(resultado.status).toBe(200);
  });

  it.each(endpointsGestao)("administrador: %s %s -> 200", async (metodo, caminho) => {
    const token = await tokenDe(config.USUARIO_ADMIN);
    const resultado = await requisitar(caminho, { metodo, token });
    expect(resultado.status).toBe(200);
  });

  it("operador NÃO pode listar usuários -> 403", async () => {
    const token = await tokenDe(config.USUARIO_OPERADOR);
    const resultado = await requisitar("/api/usuarios", { token });
    expect(resultado.status).toBe(403);
    expect(resultado.corpo.codigo).toBe("PERMISSAO_NEGADA");
  });

  it("operador NÃO pode criar usuário -> 403", async () => {
    const token = await tokenDe(config.USUARIO_OPERADOR);
    const resultado = await requisitar("/api/usuarios", {
      metodo: "POST",
      token,
      corpo: { nome: "X", email: "x@x.com", senha: "123456", perfil: "OPERADOR_ESTOQUE" },
    });
    expect(resultado.status).toBe(403);
  });

  it("gerente NÃO pode INATIVAR usuário (somente administrador) -> 403", async () => {
    const token = await tokenDe(config.USUARIO_GERENTE);
    const resultado = await requisitar("/api/usuarios/999999", {
      metodo: "DELETE",
      token,
    });
    expect(resultado.status).toBe(403);
  });

  it("usuário com perfil inexistente no token é tratado como 403", async () => {
    const path = require("path");
    const jwt = require(path.join(config.BACKEND, "node_modules", "jsonwebtoken"));
    const token = jwt.sign(
      { id: 999999, perfil: "PERFIL_INEXISTENTE" },
      config.JWT_SECRET,
    );
    const resultado = await requisitar("/api/dashboard", { token });
    expect(resultado.status).toBe(403);
    expect(resultado.corpo.codigo).toBe("PERMISSAO_NEGADA");
  });
});

describe("Autorização - sem token e token inválido", () => {
  it("GET /api/produtos sem token -> 401", async () => {
    const resultado = await requisitar("/api/produtos");
    expect(resultado.status).toBe(401);
  });

  it("POST /api/produtos sem token -> 401", async () => {
    const resultado = await requisitar("/api/produtos", {
      metodo: "POST",
      corpo: {},
    });
    expect(resultado.status).toBe(401);
  });

  it("GET /api/estoque sem token -> 401", async () => {
    const resultado = await requisitar("/api/estoque");
    expect(resultado.status).toBe(401);
  });

  it("GET /api/auditorias com token inválido -> 401", async () => {
    const resultado = await requisitar("/api/auditorias", { token: "aaa.bbb.ccc" });
    expect(resultado.status).toBe(401);
  });
});