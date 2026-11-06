const { Pool } = require('pg');
const config = require('./env');

const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.name,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

/**
 * Converte placeholders "?" do MySQL para "$1", "$2", ... do PostgreSQL.
 * Preserva "?" dentro de strings (aspas simples) para não quebrar textos.
 */
function converterPlaceholders(sql) {
  let resultado = '';
  let indice = 1;
  let dentroDeAspas = false;
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const prox = sql[i + 1];

    if (char === "'" && prox !== "'") {
      dentroDeAspas = !dentroDeAspas;
      resultado += char;
      continue;
    }

    if (char === "'" && prox === "'") {
      resultado += char + prox;
      i++;
      continue;
    }

    if (char === '?' && !dentroDeAspas) {
      resultado += `$${indice}`;
      indice++;
    } else {
      resultado += char;
    }
  }
  return resultado;
}

/**
 * Verifica se o SQL é um INSERT que ainda não tem RETURNING.
 */
function ehInsertSemReturning(sql) {
  const sqlTrim = sql.trim();
  const ehInsert = /^\s*INSERT\s/i.test(sqlTrim);
  const jaTemReturning = /RETURNING\s/i.test(sqlTrim);
  return ehInsert && !jaTemReturning;
}

/**
 * Wrapper de conexão PostgreSQL compatível com a interface do mysql2.
 * O método execute(sql, valores) converte "?" para "$N" e retorna [resultado],
 * onde resultado pode ter insertId (para INSERTs) assim como o mysql2.
 */
function criarConexaoWrapper(client) {
  return {
    async execute(sql, valores = []) {
      let sqlPg = converterPlaceholders(sql);
      const precisaInsertId = ehInsertSemReturning(sqlPg);
      if (precisaInsertId) {
        sqlPg = sqlPg.replace(/;\s*$/, '') + ' RETURNING id';
      }
      const resultado = await client.query(sqlPg, valores);
      const linhas = resultado.rows;

      if (precisaInsertId && linhas.length > 0 && linhas[0].id !== undefined) {
        // Simular resultado compatível com mysql2 (com insertId)
        const resultadoCompat = {
          rows: linhas,
          insertId: linhas[0].id,
          affectedRows: linhas.length,
        };
        return [resultadoCompat];
      }
      return [linhas];
    },
    async query(sql, valores = []) {
      const sqlPg = converterPlaceholders(sql);
      return await client.query(sqlPg, valores);
    },
    async release() {
      await client.release();
    },
  };
}

/** Executa uma query SQL com parâmetros. Converte "?" para "$N" (PostgreSQL). */
async function executarQuery(sql, valores = []) {
  const sqlPg = converterPlaceholders(sql);
  const resultado = await pool.query(sqlPg, valores);
  return resultado.rows;
}

/**
 * Executa uma transação com múltiplas queries.
 * Passa ao callback uma conexão com método execute compatível com mysql2.
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
};
