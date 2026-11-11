"use strict";
/**
 * PREPARA O BANCO POSTGRESQL DE TESTES (babycare_test).
 *
 * O QUE FAZ:
 *   1. Recria somente o banco PostgreSQL babycare_test.
 *   2. Aplica o schema PostgreSQL, sem acessar ou alterar bancos MySQL.
 *   3. Cria os usuários de teste com hash bcrypt (mesma técnica do
 *      backend/database/criarUsuario.js).
 *
 */
const path = require("path");
const fs = require("fs");
const { config } = require("../helpers/env");
const { Pool } = require(path.join(config.BACKEND, "node_modules", "pg"));
const bcrypt = require(path.join(
  config.BACKEND,
  "node_modules",
  "bcryptjs",
));

const SQL_SCHEMA = path.join(config.BACKEND, "database.postgres.sql");

async function semearUsuarios(pool) {
  const SALT_ROUNDS = 10;
  const usuarios = [
    { nome: "Operador de Teste", email: config.USUARIO_OPERADOR.email, senha: config.USUARIO_OPERADOR.senha, perfil: "OPERADOR_ESTOQUE", ativo: true },
    { nome: "Gerente de Teste", email: config.USUARIO_GERENTE.email, senha: config.USUARIO_GERENTE.senha, perfil: "GERENTE", ativo: true },
    { nome: "Administrador de Teste", email: config.USUARIO_ADMIN.email, senha: config.USUARIO_ADMIN.senha, perfil: "ADMINISTRADOR", ativo: true },
    { nome: "Usuário Inativo de Teste", email: config.USUARIO_INATIVO.email, senha: config.USUARIO_INATIVO.senha, perfil: "OPERADOR_ESTOQUE", ativo: false },
    { nome: "Usuário de Bloqueio de Teste", email: config.USUARIO_BLOQUEIO.email, senha: config.USUARIO_BLOQUEIO.senha, perfil: "OPERADOR_ESTOQUE", ativo: true },
  ];

  for (const usuario of usuarios) {
    const senhaHash = await bcrypt.hash(usuario.senha, SALT_ROUNDS);
    const perfil = await pool.query(
      "SELECT id FROM perfis WHERE nome = $1",
      [usuario.perfil],
    );
    if (!perfil.rowCount) throw new Error(`Perfil não encontrado: ${usuario.perfil}`);
    const dep = await pool.query(
      "SELECT id FROM departamentos WHERE nome = 'Estoque' LIMIT 1",
    );
    await pool.query(
      `INSERT INTO usuarios
         (nome, email, senha_hash, perfil_id, departamento_id, ativo)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        usuario.nome,
        usuario.email,
        senhaHash,
        perfil.rows[0].id,
        dep.rowCount ? dep.rows[0].id : null,
        usuario.ativo,
      ],
    );
  }
}

async function main() {
  if (config.DB_NAME !== "babycare_test") {
    throw new Error("O setup só pode recriar o banco babycare_test.");
  }
  if (!["localhost", "127.0.0.1", "::1"].includes(config.DB_HOST)) {
    throw new Error("O setup de testes só pode recriar um banco PostgreSQL local.");
  }

  const opcoesConexao = {
    host: config.DB_HOST,
    port: Number(config.DB_PORT),
    user: config.DB_USER,
    password: config.DB_PASSWORD,
  };
  const admin = new Pool({ ...opcoesConexao, database: "postgres" });
  let pool;

  try {
    console.log(`[setup] Recriando banco PostgreSQL ${config.DB_NAME}...`);
    await admin.query(`DROP DATABASE IF EXISTS ${config.DB_NAME} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${config.DB_NAME}`);

    pool = new Pool({ ...opcoesConexao, database: config.DB_NAME });
    console.log(`[setup] Aplicando ${path.basename(SQL_SCHEMA)}...`);
    await pool.query(fs.readFileSync(SQL_SCHEMA, "utf8"));

    console.log("[setup] Criando usuários de teste...");
    await semearUsuarios(pool);

    const contagem = await pool.query(
      "SELECT (SELECT COUNT(*) FROM usuarios) AS usuarios, (SELECT COUNT(*) FROM produtos) AS produtos, (SELECT COUNT(*) FROM lotes) AS lotes",
    );
    console.log("[setup] Banco de testes pronto:", contagem.rows[0]);
    console.log("[setup] OK");
  } finally {
    await pool?.end();
    await admin.end();
  }
}

main().catch((erro) => {
  console.error("[setup] FALHOU:", erro.message);
  process.exitCode = 1;
});