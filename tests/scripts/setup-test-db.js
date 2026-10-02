"use strict";
/**
 * PREPARA O BANCO DE TESTES (babycare_test).
 *
 * O QUE FAZ:
 *   1. DROP DATABASE IF EXISTS babycare_test;    (reset total)
 *   2. Executa o database.sql OFICIAL (raiz) modificado apenas nos pontos
 *      "CREATE DATABASE ... babycare" e "USE babycare", apontando para
 *      babycare_test. NENHUM arquivo de produção é alterado.
 *   3. Cria os usuários de teste com hash bcrypt (mesma técnica do
 *      backend/database/criarUsuario.js).
 *
 * Datas de validade dos dados DEMO são relativas a CURDATE(), então a cada
 * reset o cenário fica sempre "fresco".
 */
const path = require("path");
const fs = require("fs");
const { config, lerEnvBackend } = require("../helpers/env");

const mysql = require(path.join(
  config.BACKEND,
  "node_modules",
  "mysql2",
  "promise",
));
const bcrypt = require(path.join(
  config.BACKEND,
  "node_modules",
  "bcryptjs",
));

const SQL_OFICIAL = path.join(config.PROJETO, "database.sql");

function transformarParaBancoDeTeste(sql) {
  let texto = sql;
  texto = texto.replace(
    /CREATE DATABASE IF NOT EXISTS babycare/gi,
    `CREATE DATABASE IF NOT EXISTS ${config.DB_NAME}`,
  );
  texto = texto.replace(
    /USE\s+babycare\s*;/gi,
    `USE ${config.DB_NAME};`,
  );
  if (texto.includes(`USE ${config.DB_NAME}`) === false) {
    throw new Error("Transformação do SQL não encontrou os pontos de troca de banco.");
  }
  return texto;
}

async function executarScript(conexao, sql) {
  await conexao.query({ sql, multipleStatements: true });
}

async function semearUsuarios(conexao) {
  const SALT_ROUNDS = 10;
  const usuarios = [
    { nome: "Operador de Teste", email: config.USUARIO_OPERADOR.email, senha: config.USUARIO_OPERADOR.senha, perfil: "OPERADOR_ESTOQUE", ativo: 1 },
    { nome: "Gerente de Teste", email: config.USUARIO_GERENTE.email, senha: config.USUARIO_GERENTE.senha, perfil: "GERENTE", ativo: 1 },
    { nome: "Administrador de Teste", email: config.USUARIO_ADMIN.email, senha: config.USUARIO_ADMIN.senha, perfil: "ADMINISTRADOR", ativo: 1 },
    { nome: "Usuário Inativo de Teste", email: config.USUARIO_INATIVO.email, senha: config.USUARIO_INATIVO.senha, perfil: "OPERADOR_ESTOQUE", ativo: 0 },
    { nome: "Usuário de Bloqueio de Teste", email: config.USUARIO_BLOQUEIO.email, senha: config.USUARIO_BLOQUEIO.senha, perfil: "OPERADOR_ESTOQUE", ativo: 1 },
  ];

  for (const usuario of usuarios) {
    const senhaHash = await bcrypt.hash(usuario.senha, SALT_ROUNDS);
    const [perfil] = await conexao.execute(
      "SELECT id FROM perfis WHERE nome = ?",
      [usuario.perfil],
    );
    if (!perfil.length) throw new Error(`Perfil não encontrado: ${usuario.perfil}`);
    const [dep] = await conexao.execute(
      "SELECT id FROM departamentos WHERE nome = 'Estoque' LIMIT 1",
    );
    await conexao.execute(
      `INSERT INTO usuarios
         (nome, email, senha_hash, perfil_id, departamento_id, ativo)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        usuario.nome,
        usuario.email,
        senhaHash,
        perfil[0].id,
        dep.length ? dep[0].id : null,
        usuario.ativo,
      ],
    );
  }
}

async function main() {
  const env = lerEnvBackend();
  const conexao = await mysql.createConnection({
    host: env.DB_HOST || config.DB_HOST,
    port: Number(env.DB_PORT || config.DB_PORT),
    user: env.DB_USER || config.DB_USER,
    password: env.DB_PASSWORD || config.DB_PASSWORD,
    multipleStatements: true,
  });

  console.log(`[setup] Removendo banco ${config.DB_NAME} (se existir)...`);
  await conexao.query(`DROP DATABASE IF EXISTS ${config.DB_NAME}`);
  await conexao.query(
    `CREATE DATABASE ${config.DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );

  console.log(`[setup] Executando ${path.basename(SQL_OFICIAL)} em ${config.DB_NAME}...`);
  const sqlOficial = fs.readFileSync(SQL_OFICIAL, "utf8");
  const sqlTeste = transformarParaBancoDeTeste(sqlOficial);
  await conexao.query(`USE ${config.DB_NAME}`);
  await executarScript(conexao, sqlTeste);

  console.log("[setup] Criando usuários de teste...");
  await conexao.query(`USE ${config.DB_NAME}`);
  await semearUsuarios(conexao);

  const [contagem] = await conexao.query(
    "SELECT (SELECT COUNT(*) FROM usuarios) AS usuarios, (SELECT COUNT(*) FROM produtos) AS produtos, (SELECT COUNT(*) FROM lotes) AS lotes",
  );
  console.log("[setup] Banco de testes pronto:", contagem[0]);

  await conexao.end();
  console.log("[setup] OK");
}

main().catch((erro) => {
  console.error("[setup] FALHOU:", erro.message);
  process.exitCode = 1;
});