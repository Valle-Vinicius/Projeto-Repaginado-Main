"use strict";
/**
 * Gerencia o processo do SERVIDOR REAL (backend/server.js) para os testes.
 *
 * O servidor é iniciado como processo filho com as variáveis de ambiente
 * apontando para o banco babycare_test e uma porta de teste.
 *
 * Nenhum arquivo de produção é modificado: apenas sobrescrevemos
 * process.env do processo filho (dotenv não sobrescreve variáveis já
 * definidas no ambiente).
 */
const path = require("path");
const { spawn } = require("child_process");
const { config, lerEnvBackend } = require("./env");

const BASE_URL = `http://127.0.0.1:${config.PORT}`;

function montarAmbienteFilho(extra = {}) {
  const env = lerEnvBackend();
  return {
    ...process.env,
    PORT: String(config.PORT),
    DB_HOST: env.DB_HOST || config.DB_HOST,
    DB_PORT: env.DB_PORT || config.DB_PORT,
    DB_USER: env.DB_USER || config.DB_USER,
    DB_PASSWORD: env.DB_PASSWORD || config.DB_PASSWORD,
    DB_NAME: config.DB_NAME,
    JWT_SECRET: config.JWT_SECRET,
    JWT_EXPIRES_IN: env.JWT_EXPIRES_IN || "1h",
    ...extra,
  };
}

let processo = null;

async function aguardarSaude(tempoLimiteMs = 30000) {
  const inicio = Date.now();
  while (Date.now() - inicio < tempoLimiteMs) {
    try {
      const resposta = await fetch(`${BASE_URL}/api/health`);
      if (resposta.ok) {
        const corpo = await resposta.json();
        if (corpo.sucesso === true && corpo.status === "ok") return;
      }
    } catch (erro) {
      // servidor ainda não respondeu
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Servidor de teste não respondeu em ${tempoLimiteMs}ms.`);
}

/** Inicia o servidor real como processo filho. */
async function iniciarServidor() {
  if (processo && processo.exitCode === null) return BASE_URL;

  const serverPath = path.join(config.BACKEND, "server.js");
  processo = spawn(process.execPath, [serverPath], {
    cwd: config.BACKEND,
    env: montarAmbienteFilho(),
    stdio: ["ignore", "pipe", "pipe"],
  });

  let saida = "";
  processo.stdout.on("data", (d) => (saida += String(d)));
  processo.stderr.on("data", (d) => (saida += String(d)));

  await aguardarSaude();

  processo.on("exit", (codigo) => {
    if (codigo !== 0 && codigo !== null) {
      console.error("[server] saiu com código", codigo, saida);
    }
  });

  return BASE_URL;
}

/** Encerra o processo do servidor de teste. */
async function encerrarServidor() {
  if (processo && processo.exitCode === null) {
    processo.kill();
    await new Promise((resolve) => {
      processo.once("exit", resolve);
      setTimeout(resolve, 4000);
    });
  }
  processo = null;
}

/** Requisição HTTP genérica com JSON. */
async function requisitar(caminho, { metodo = "GET", token = null, corpo = null, headers = {} } = {}) {
  const cabecalhos = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...headers,
  };
  if (token) cabecalhos.Authorization = `Bearer ${token}`;

  const opcoes = { method: metodo, headers: cabecalhos };
  if (corpo !== null && corpo !== undefined) {
    opcoes.body = typeof corpo === "string" ? corpo : JSON.stringify(corpo);
  }

  const resposta = await fetch(`${BASE_URL}${caminho}`, opcoes);
  let dados = {};
  try {
    dados = await resposta.json();
  } catch (erro) {
    // corpo não-JSON
  }
  return { status: resposta.status, corpo: dados, resposta };
}

/** Faz login e devolve { token, usuario, status, corpo }. */
async function login(email, senha) {
  const resultado = await requisitar("/api/auth/login", {
    metodo: "POST",
    corpo: { email, senha },
  });
  return {
    token: resultado.corpo.token || null,
    usuario: resultado.corpo.usuario || null,
    status: resultado.status,
    corpo: resultado.corpo,
  };
}

module.exports = {
  BASE_URL,
  iniciarServidor,
  encerrarServidor,
  requisitar,
  login,
};