"use strict";
/**
 * TESTES DE AUTENTICAÇÃO
 * Cobre o comportamento REAL de POST /api/auth/login e o uso do JWT.
 */

const path = require("path");
const { config } = require("../helpers/env");
const { iniciarServidor, encerrarServidor, requisitar, login } = require("../helpers/server");
const { auditoriasPorAcao, usuarioPorEmail } = require("../helpers/fixtures");
const { executar } = require("../helpers/db");

// jsonwebtoken instalado em backend/node_modules
const jwt = require(path.join(config.BACKEND, "node_modules", "jsonwebtoken"));

beforeAll(async () => {
  await iniciarServidor();
});

afterAll(async () => {
  await encerrarServidor();
});

describe("Autenticação - login válido", () => {
  test("operador consegue fazer login e recebe token + usuário", async () => {
    const resultado = await login(config.USUARIO_OPERADOR.email, config.USUARIO_OPERADOR.senha);
    expect(resultado.status).toBe(200);
    expect(resultado.corpo.sucesso).toBe(true);
    expect(resultado.token).toBeTruthy();
    expect(resultado.usuario.email).toBe(config.USUARIO_OPERADOR.email);
    expect(resultado.usuario.perfil).toBe("OPERADOR_ESTOQUE");
  });

  test("gerente consegue fazer login", async () => {
    const resultado = await login(config.USUARIO_GERENTE.email, config.USUARIO_GERENTE.senha);
    expect(resultado.status).toBe(200);
    expect(resultado.usuario.perfil).toBe("GERENTE");
  });

  test("administrador consegue fazer login", async () => {
    const resultado = await login(config.USUARIO_ADMIN.email, config.USUARIO_ADMIN.senha);
    expect(resultado.status).toBe(200);
    expect(resultado.usuario.perfil).toBe("ADMINISTRADOR");
  });
});

describe("Autenticação - credenciais inválidas", () => {
  test("senha incorreta retorna 401 CREDENCIAIS_INVALIDAS", async () => {
    const resultado = await login(config.USUARIO_OPERADOR.email, "senha-errada");
    expect(resultado.status).toBe(401);
    expect(resultado.corpo.codigo).toBe("CREDENCIAIS_INVALIDAS");
  });

  test("e-mail inexistente retorna 401 (mesma resposta que senha incorreta)", async () => {
    const resultado = await login("nao.existe@teste.com", "qualquercoisa");
    expect(resultado.status).toBe(401);
    expect(resultado.corpo.codigo).toBe("CREDENCIAIS_INVALIDAS");
  });

  test("usuário inativo não consegue entrar mesmo com senha correta", async () => {
    const resultado = await login(config.USUARIO_INATIVO.email, config.USUARIO_INATIVO.senha);
    expect(resultado.status).toBe(401);
    expect(resultado.corpo.codigo).toBe("CREDENCIAIS_INVALIDAS");
  });
});

describe("Autenticação - validação de payload", () => {
  test("e-mail mal formado retorna 400 EMAIL_FORMATO_INVALIDO", async () => {
    const resultado = await requisitar("/api/auth/login", {
      metodo: "POST",
      corpo: { email: "sem-arroba", senha: "123456" },
    });
    expect(resultado.status).toBe(400);
    expect(resultado.corpo.codigo).toBe("EMAIL_FORMATO_INVALIDO");
  });

  test("e-mail ausente retorna 400 EMAIL_OBRIGATORIO", async () => {
    const resultado = await requisitar("/api/auth/login", {
      metodo: "POST",
      corpo: { senha: "123456" },
    });
    expect(resultado.status).toBe(400);
    expect(resultado.corpo.codigo).toBe("EMAIL_OBRIGATORIO");
  });

  test("senha ausente retorna 400 SENHA_OBRIGATORIA", async () => {
    const resultado = await requisitar("/api/auth/login", {
      metodo: "POST",
      corpo: { email: config.USUARIO_OPERADOR.email },
    });
    expect(resultado.status).toBe(400);
    expect(resultado.corpo.codigo).toBe("SENHA_OBRIGATORIA");
  });

  test("campo extra no payload retorna 400 CAMPOS_INVALIDOS", async () => {
    const resultado = await requisitar("/api/auth/login", {
      metodo: "POST",
      corpo: {
        email: config.USUARIO_OPERADOR.email,
        senha: config.USUARIO_OPERADOR.senha,
        lembrar: true,
      },
    });
    expect(resultado.status).toBe(400);
    expect(resultado.corpo.codigo).toBe("CAMPOS_INVALIDOS");
  });

  test("payload primitivo (string JSON) é rejeitado pelo parser estrito como JSON_INVALIDO", async () => {
    // O servidor usa express.json({ strict: true }), que só aceita objetos/
    // arrays. Um corpo primitivo gera entity.parse.failed -> JSON_INVALIDO
    // ANTES de chegar ao authService. O PAYLOAD_INVALIDO do service é
    // defensivo e não é alcançável por HTTP (ver KNOWN-ISSUES.md).
    const resultado = await requisitar("/api/auth/login", {
      metodo: "POST",
      corpo: "texto-simples",
    });
    expect(resultado.status).toBe(400);
    expect(resultado.corpo.codigo).toBe("JSON_INVALIDO");
  });

  test("JSON inválido no corpo retorna 400 JSON_INVALIDO", async () => {
    const resultado = await requisitar("/api/auth/login", {
      metodo: "POST",
      corpo: '{"email": "x"} sem chave',
    });
    expect(resultado.status).toBe(400);
    expect(resultado.corpo.codigo).toBe("JSON_INVALIDO");
  });
});
describe("Autenticação - JWT", () => {
  test("token válido acessa GET /api/perfil", async () => {
    const { token } = await login(config.USUARIO_OPERADOR.email, config.USUARIO_OPERADOR.senha);
    const resultado = await requisitar("/api/perfil", { token });
    expect(resultado.status).toBe(200);
    expect(resultado.corpo.sucesso).toBe(true);
    expect(resultado.corpo.usuario.email).toBe(config.USUARIO_OPERADOR.email);
  });

  test("acesso sem token retorna 401 TOKEN_AUSENTE", async () => {
    const resultado = await requisitar("/api/perfil");
    expect(resultado.status).toBe(401);
    expect(resultado.corpo.codigo).toBe("TOKEN_AUSENTE");
  });

  test("token aleatório/inválido retorna 401 TOKEN_INVALIDO", async () => {
    const resultado = await requisitar("/api/perfil", { token: "token.falso.assinado" });
    expect(resultado.status).toBe(401);
    expect(resultado.corpo.codigo).toBe("TOKEN_INVALIDO");
  });

  test("JWT assinado com outra chave retorna 401 TOKEN_INVALIDO", async () => {
    const token = jwt.sign({ id: 1, perfil: "ADMINISTRADOR" }, "chave-diferente");
    const resultado = await requisitar("/api/perfil", { token });
    expect(resultado.status).toBe(401);
    expect(resultado.corpo.codigo).toBe("TOKEN_INVALIDO");
  });

  test("JWT expirado retorna 401 TOKEN_INVALIDO", async () => {
    const token = jwt.sign(
      { id: 99999, perfil: "OPERADOR_ESTOQUE" },
      config.JWT_SECRET,
      { expiresIn: -10 },
    );
    const resultado = await requisitar("/api/perfil", { token });
    expect(resultado.status).toBe(401);
    expect(resultado.corpo.codigo).toBe("TOKEN_INVALIDO");
  });

  test("Authorization sem prefixo Bearer retorna 401 TOKEN_AUSENTE", async () => {
    const { token } = await login(config.USUARIO_OPERADOR.email, config.USUARIO_OPERADOR.senha);
    const resultado = await requisitar("/api/perfil", {
      headers: { Authorization: token },
    });
    expect(resultado.status).toBe(401);
    expect(resultado.corpo.codigo).toBe("TOKEN_AUSENTE");
  });
});

describe("Autenticação - bloqueio de conta", () => {
  test("5 falhas consecutivas bloqueiam a conta por 15 minutos", async () => {
    // Garante que o usuário de bloqueio comece sem trava.
    await executar(
      `UPDATE usuarios SET tentativas_login = 0, bloqueado_ate = NULL WHERE email = ?`,
      [config.USUARIO_BLOQUEIO.email],
    );

    for (let i = 1; i <= 5; i += 1) {
      const resultado = await login(config.USUARIO_BLOQUEIO.email, "senha-errada");
      expect(resultado.status).toBe(401);
    }

    const usuario = await usuarioPorEmail(config.USUARIO_BLOQUEIO.email);
    expect(Number(usuario.tentativas_login)).toBeGreaterThanOrEqual(5);
    expect(usuario.bloqueado_ate).not.toBeNull();
  });

  test("usuario bloqueado não consegue entrar mesmo com a senha correta", async () => {
    const resultado = await login(config.USUARIO_BLOQUEIO.email, config.USUARIO_BLOQUEIO.senha);
    expect(resultado.status).toBe(401);
    expect(resultado.corpo.codigo).toBe("CREDENCIAIS_INVALIDAS");
  });

  test("tentativa durante bloqueio não incrementa além do limite", async () => {
    const antes = await usuarioPorEmail(config.USUARIO_BLOQUEIO.email);
    const resultado = await login(config.USUARIO_BLOQUEIO.email, "senha-errada");
    expect(resultado.status).toBe(401);
    const depois = await usuarioPorEmail(config.USUARIO_BLOQUEIO.email);
    // O UPDATE de falha só roda quando a conta não está bloqueada.
    expect(Number(depois.tentativas_login)).toBe(Number(antes.tentativas_login));
  });
});

describe("Autenticação - auditoria", () => {
  test("login bem-sucedido gera LOGIN_REALIZADO com SUCESSO", async () => {
    const antes = await auditoriasPorAcao("LOGIN_REALIZADO", 1);
    const totalAntes = antes.length;
    await login(config.USUARIO_OPERADOR.email, config.USUARIO_OPERADOR.senha);
    const depois = await auditoriasPorAcao("LOGIN_REALIZADO", 5);
    expect(depois.length).toBeGreaterThan(totalAntes);
    expect(depois[0].resultado).toBe("SUCESSO");
  });

  test("login com senha inválida gera LOGIN_FALHOU com FALHA", async () => {
    const antes = await auditoriasPorAcao("LOGIN_FALHOU", 1);
    const totalAntes = antes.length;
    await login(config.USUARIO_OPERADOR.email, "senha-errada");
    const depois = await auditoriasPorAcao("LOGIN_FALHOU", 5);
    expect(depois.length).toBeGreaterThan(totalAntes);
    expect(depois[0].resultado).toBe("FALHA");
  });
});