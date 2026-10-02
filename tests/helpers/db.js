"use strict";
/**
 * Conexão DIRETA com o banco de testes (babycare_test).
 * Usada apenas para verificar o estado do banco antes/depois das operações.
 *
 * Não utiliza o pool da aplicação de produção.
 */
const path = require("path");
const { config } = require("./env");

// mysql2 instalado dentro de backend/node_modules
const mysql = require(path.join(
  config.BACKEND,
  "node_modules",
  "mysql2",
  "promise",
));

const pool = mysql.createPool({
  host: config.DB_HOST,
  port: Number(config.DB_PORT),
  user: config.DB_USER,
  password: config.DB_PASSWORD,
  database: config.DB_NAME,
  connectionLimit: 5,
  waitForConnections: true,
  decimalNumbers: true,
  charset: "utf8mb4",
  multipleStatements: true,
});

async function consultar(sql, valores = []) {
  const [linhas] = await pool.execute(sql, valores);
  return linhas;
}

async function executar(sql, valores = []) {
  const [resultado] = await pool.execute(sql, valores);
  return resultado;
}

async function fechar() {
  await pool.end();
}

module.exports = { pool, consultar, executar, fechar, config };