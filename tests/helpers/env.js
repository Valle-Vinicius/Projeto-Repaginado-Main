"use strict";
/**
 * Configuração de ambiente para a bateria de testes.
 * NÃO altera nenhum arquivo de produção.
 *
 * O arquivo backend/.env é usado apenas como fonte das credenciais do MySQL;
 * o NOME DO BANCO é substituído por "babycare_test" para isolar os testes
 * do banco de desenvolvimento (babycare).
 */

const path = require("path");
const fs = require("fs");

const PROJETO = path.resolve(__dirname, "..", "..");

/** Lê o backend/.env e devolve um objeto simples (remove BOM). */
function lerEnvBackend() {
  const caminho = path.join(PROJETO, "backend", ".env");
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
  DB_HOST: envBackend.DB_HOST || "localhost",
  DB_PORT: envBackend.DB_PORT || "3306",
  DB_USER: envBackend.DB_USER || "root",
  DB_PASSWORD: envBackend.DB_PASSWORD || "",
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

module.exports = { config, lerEnvBackend };