"use strict";
/**
 * Configuração de ambiente para a bateria de testes.
 * NÃO altera nenhum arquivo de produção.
 *
 * Usa somente PostgreSQL e mantém os testes isolados no banco babycare_test.
 */

const path = require("path");
const fs = require("fs");

const PROJETO = path.resolve(__dirname, "..", "..");

/** Lê o backend/.env e devolve um objeto simples (remove BOM). */
function lerEnvBackend() {
  const caminhoLocal = path.join(PROJETO, "backend", ".env");
  const caminhoExemplo = path.join(PROJETO, "backend", ".env.example");
  const caminho = fs.existsSync(caminhoLocal)
    ? caminhoLocal
    : fs.existsSync(caminhoExemplo)
      ? caminhoExemplo
      : null;
  if (!caminho) return {};

  const conteudo = fs.readFileSync(caminho, "utf8").replace(/^\uFEFF/, "");
  const dados = {};
  for (const linha of conteudo.split(/\r?\n/)) {
    const texto = linha.trim();
    if (!texto || texto.startsWith("#") || !texto.includes("=")) continue;
    const indice = texto.indexOf("=");
    const chave = texto.slice(0, indice).trim();
    const valor = texto.slice(indice + 1).trim();
    dados[chave] = valor;
  }
  return dados;
}

const envBackend = lerEnvBackend();

const config = Object.freeze({
  PROJETO,
  BACKEND: path.join(PROJETO, "backend"),
  DB_NAME: "babycare_test",
  DB_HOST: process.env.TEST_DB_HOST || envBackend.DB_HOST || "localhost",
  DB_PORT: process.env.TEST_DB_PORT || envBackend.DB_PORT || "5432",
  DB_USER: process.env.TEST_DB_USER || envBackend.DB_USER || "babycare",
  DB_PASSWORD: process.env.TEST_DB_PASSWORD || envBackend.DB_PASSWORD || "",
  JWT_SECRET: "CHAVE_DE_TESTE_BABYCARE_2026_NAO_USAR_EM_PRODUCAO",
  // Porta do servidor HTTP usado pelos testes (diferente da porta de
  // desenvolvimento 3000).
  PORT: 3900,
  /** Usuários de teste criados no banco babycare_test. */
  USUARIO_OPERADOR: { email: "operador@teste.com", senha: "SenhaTeste123!" },
  USUARIO_GERENTE: { email: "gerente@teste.com", senha: "SenhaTeste123!" },
  USUARIO_ADMIN: { email: "admin@teste.com", senha: "SenhaTeste123!" },
  USUARIO_INATIVO: { email: "inativo@teste.com", senha: "SenhaTeste123!" },
  USUARIO_BLOQUEIO: { email: "bloqueio@teste.com", senha: "SenhaTeste123!" },
  PERFIS: {
    OPERADOR_ESTOQUE: "OPERADOR_ESTOQUE",
    GERENTE: "GERENTE",
    ADMINISTRADOR: "ADMINISTRADOR",
  },
});

if (!["localhost", "127.0.0.1", "::1"].includes(config.DB_HOST)) {
  throw new Error("Os testes só podem se conectar a um banco PostgreSQL local.");
}

module.exports = { config, lerEnvBackend };