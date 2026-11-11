const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const config = require('./env');
const { normalizarAliases, prepararSql } = require('./sql');

const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.name,
  ssl: config.database.ssl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

/** Wrapper que mantém o formato de linhas esperado pelas transações. */
function criarConexaoWrapper(client) {
  return {
    async execute(sql, valores = []) {
      const resultado = await client.query(prepararSql(sql), valores);
      return [normalizarAliases(sql, resultado.rows)];
    },
    async query(sql, valores = []) {
      return client.query(prepararSql(sql), valores);
    },
    async release() {
      await client.release();
    },
  };
}

/** Executa uma query parametrizada e retorna as linhas do PostgreSQL. */
async function executarQuery(sql, valores = []) {
  const resultado = await pool.query(prepararSql(sql), valores);
  return normalizarAliases(sql, resultado.rows);
}

async function inicializarBanco() {
  const schema = fs.readFileSync(path.join(__dirname, '..', 'database.postgres.sql'), 'utf8');
  await pool.query(schema);
}

/**
 * Executa uma transação com múltiplas queries.
 * Passa ao callback uma conexão com método execute que retorna [linhas].
 */
async function executarTransacao(callback) {
  const client = await pool.connect();
  const conexao = criarConexaoWrapper(client);

  try {
    await conexao.query('BEGIN');
    const resultado = await callback(conexao);
    await conexao.query('COMMIT');
    return resultado;
  } catch (erro) {
    try {
      await conexao.query('ROLLBACK');
    } catch (rollbackErro) {
      // ignora erro de rollback
    }
    throw erro;
  } finally {
    await conexao.release();
  }
}

module.exports = {
  pool,
  executarQuery,
  executarTransacao,
  inicializarBanco,
};
