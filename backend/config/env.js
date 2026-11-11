const path = require('path');
const dotenv = require('dotenv');

dotenv.config({
  path: path.resolve(__dirname, '..', '.env'),
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

function obterConfiguracaoBanco() {
  if (process.env.DATABASE_URL) {
    let url;
    try {
      url = new URL(process.env.DATABASE_URL);
    } catch (erro) {
      throw new Error('A variável DATABASE_URL não contém uma URL válida.');
    }

    if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
      throw new Error('A variável DATABASE_URL deve apontar para PostgreSQL.');
    }

    return {
      host: url.hostname,
      port: Number(url.port || 5432),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      name: decodeURIComponent(url.pathname.replace(/^\//, '')),
    };
  }

  return {
    host: exigirTexto('DB_HOST'),
    port: Number(process.env.DB_PORT || 5432),
    user: exigirTexto('DB_USER'),
    password: process.env.DB_PASSWORD ?? '',
    name: exigirTexto('DB_NAME'),
  };
}

const database = obterConfiguracaoBanco();

const config = Object.freeze({
  port: obterPorta(),
  database: Object.freeze(database),
  jwt: Object.freeze({
    secret: exigirTexto('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN || '2h',
  }),
});

if (
  !Number.isInteger(config.database.port) ||
  config.database.port < 1 ||
  config.database.port > 65535
) {
  throw new Error('A variável DB_PORT deve ser um número entre 1 e 65535.');
}

module.exports = config;
