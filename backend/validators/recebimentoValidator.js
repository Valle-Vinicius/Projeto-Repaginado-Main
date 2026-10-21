"use strict";

/**
 * Validação de ENTRADA (recebimento).
 *
 * Regras de negócio da movimentação de ENTRADA, movidas para cá para manter
 * a arquitetura das pastas coerente (validator -> service -> repository).
 */

const LIMITE_TEXTO = {
  fornecedor: 150,
  documento: 80,
  numeroLote: 80,
  observacao: 255
};

function erroValidacao(mensagem, codigo = "DADOS_INVALIDOS") {
  const erro = new Error(mensagem);
  erro.statusCode = 400;
  erro.codigo = codigo;
  return erro;
}

function exigirObjeto(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw erroValidacao("O corpo da requisição deve ser um objeto.");
  }
}

function textoOpcional(valor, limite, campo) {
  const texto = String(valor ?? "").trim();
  if (!texto) return null;
  if (texto.length > limite) {
    throw erroValidacao(`${campo || "O texto"} ultrapassa o limite de ${limite} caracteres.`);
  }
  return texto;
}

function idObrigatorio(valor, campo) {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) {
    throw erroValidacao(`Informe ${campo} válido.`);
  }
  return id;
}

function idOpcional(valor, campo) {
  if (valor === undefined || valor === null || valor === "") return null;
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) {
    throw erroValidacao(`Informe ${campo} válido.`);
  }
  return id;
}

function quantidadePositiva(valor) {
  const quantidade = Number(valor);
  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    throw erroValidacao("Informe a quantidade com um valor maior que zero.");
  }
  return Number(quantidade.toFixed(3));
}

function dataValidadeOpcional(valor) {
  if (valor === undefined || valor === null || valor === "") return null;
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    throw erroValidacao("A data de validade deve estar no formato AAAA-MM-DD.");
  }

  const [ano, mes, dia] = valor.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  if (
    data.getUTCFullYear() !== ano
    || data.getUTCMonth() !== mes - 1
    || data.getUTCDate() !== dia
  ) {
    throw erroValidacao("A data de validade informada não é válida.");
  }

  return valor;
}

/**
 * Valida o payload de um recebimento (entrada) e devolve os dados
 * saneados prontos para o repository.
 */
function validarEntrada(payload = {}) {
  exigirObjeto(payload);

  if (String(payload.tipo || "").trim().toUpperCase() !== "ENTRADA") {
    throw erroValidacao("Tipo de movimentação inválido para recebimento.");
  }

  const numeroLote = textoOpcional(payload.numeroLote, LIMITE_TEXTO.numeroLote, "O número do lote");

  return {
    produtoId: idObrigatorio(payload.produtoId, "o produto"),
    quantidade: quantidadePositiva(payload.quantidade),
    fornecedor: textoOpcional(payload.fornecedor, LIMITE_TEXTO.fornecedor, "O fornecedor"),
    documento: textoOpcional(payload.documento, LIMITE_TEXTO.documento, "O documento"),
    numeroLote,
    dataValidade: dataValidadeOpcional(payload.dataValidade),
    localizacaoId: idOpcional(payload.localizacaoId, "a localização"),
    observacao: textoOpcional(payload.observacao, LIMITE_TEXTO.observacao, "A observação")
  };
}

module.exports = {
  validarEntrada,
  erroValidacao
};
