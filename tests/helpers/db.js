"use strict";
/**
 * Conexão DIRETA com o banco de testes (babycare_test).
 * Usada apenas para verificar o estado do banco antes/depois das operações.
 *
 * Não utiliza o pool da aplicação de produção.
 */
const path = require("path");
const { config } = require("./env");

const { Pool } = require(path.join(config.BACKEND, "node_modules", "pg"));
const { normalizarAliases, prepararSql } = require(path.join(config.BACKEND, "config", "sql"));

const pool = new Pool({
  host: config.DB_HOST,
  port: Number(config.DB_PORT),
  user: config.DB_USER,
  password: config.DB_PASSWORD,
  database: config.DB_NAME,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

async function consultar(sql, valores = []) {
  const resultado = await pool.query(prepararSql(sql), valores);
  return normalizarAliases(sql, resultado.rows);
}

async function executar(sql, valores = []) {
  return pool.query(prepararSql(sql), valores);
}

async function fechar() {
  await pool.end();
}

module.exports = { pool, consultar, executar, fechar, config };