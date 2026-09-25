const mysql = require('mysql2/promise');
const config = require('./env');

const pool = mysql.createPool({
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.name,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true,
  charset: 'utf8mb4'
});

async function executarQuery(sql, valores = []) {
  const [resultado] = await pool.execute(sql, valores);
  return resultado;
}

async function executarTransacao(callback) {
  const conexao = await pool.getConnection();

  try {
    await conexao.beginTransaction();
    const resultado = await callback(conexao);
    await conexao.commit();
    return resultado;
  } catch (erro) {
    await conexao.rollback();
    throw erro;
  } finally {
    conexao.release();
  }
}

module.exports = {
  pool,
  executarQuery,
  executarTransacao
};
