const path = require('path');
const dotenv = require('dotenv');

dotenv.config({
  path: path.resolve(__dirname, '..', '.env')
});

function exigirTexto(nome) {
  const valor = process.env[nome];

  if (valor === undefined || valor === null || valor.trim() === '') {
    throw new Error(`Variável obrigatória ausente no .env: ${nome}`);
  }

  return valor.trim();
}

function obterPorta() {
  const porta = Number(process.env.PORT || 3000);

  if (!Number.isInteger(porta) || porta < 1 || porta > 65535) {
    throw new Error('A variável PORT deve ser um número entre 1 e 65535.');
  }

  return porta;
}

const config = Object.freeze({
  port: obterPorta(),
  database: Object.freeze({
    host: exigirTexto('DB_HOST'),
    port: Number(process.env.DB_PORT || 3306),
    user: exigirTexto('DB_USER'),
    password: process.env.DB_PASSWORD ?? '',
    name: exigirTexto('DB_NAME')
  }),
  jwt: Object.freeze({
    secret: exigirTexto('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN || '2h'
  })
});

if (!Number.isInteger(config.database.port) || config.database.port < 1 || config.database.port > 65535) {
  throw new Error('A variável DB_PORT deve ser um número entre 1 e 65535.');
}

module.exports = config;
