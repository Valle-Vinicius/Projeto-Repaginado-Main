"use strict";

/**
 * Validação de SAÍDA (expedição).
 *
 * Regras de negócio da movimentação de SAIDA, movidas para cá para manter
 * a arquitetura das pastas coerente (validator -> service -> repository).
 */

const LIMITE_TEXTO = {
  destinatario: 150,
  destino: 150,
  documento: 80,
  motivo: 80,
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

function textoObrigatorio(valor, campo, limite) {
  const texto = String(valor ?? "").trim();
  if (!texto) throw erroValidacao(`Informe ${campo}.`);
  if (texto.length > limite) {
    throw erroValidacao(`${campo} ultrapassa o limite de ${limite} caracteres.`);
  }
  return texto;
}

function textoOpcional(valor, limite) {
  const texto = String(valor ?? "").trim();
  if (!texto) return null;
  if (texto.length > limite) {
    throw erroValidacao(`O texto ultrapassa o limite de ${limite} caracteres.`);
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

function quantidadePositiva(valor) {
  const quantidade = Number(valor);
  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    throw erroValidacao("Informe a quantidade com um valor maior que zero.");
  }
  return Number(quantidade.toFixed(3));
}

/**
 * Valida o payload de uma expedição (saída) e devolve os dados
 * saneados prontos para o repository.
 */
function validarSaida(payload = {}) {
  exigirObjeto(payload);

  if (String(payload.tipo || "").trim().toUpperCase() !== "SAIDA") {
    throw erroValidacao("Tipo de movimentação inválido para expedição.");
  }

  return {
    produtoId: idObrigatorio(payload.produtoId, "o produto"),
    quantidade: quantidadePositiva(payload.quantidade),
    destinatario: textoObrigatorio(payload.destinatario, "o destinatário", LIMITE_TEXTO.destinatario),
    destino: textoObrigatorio(payload.destino, "o destino", LIMITE_TEXTO.destino),
    documento: textoOpcional(payload.documento, LIMITE_TEXTO.documento),
    motivo: textoOpcional(payload.motivo, LIMITE_TEXTO.motivo),
    observacao: textoOpcional(payload.observacao, LIMITE_TEXTO.observacao)
  };
}

module.exports = {
  validarSaida,
  erroValidacao
};
