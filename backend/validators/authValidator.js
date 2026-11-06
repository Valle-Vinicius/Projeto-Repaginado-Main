'use strict';

/**
 * Validações de autenticação (login e cadastro).
 *
 * A validação foi movida para cá (e fora do service) para manter a
 * arquitetura das pastas coerente: os validators são os únicos responsáveis
 * por validar payloads; os services orquestram o fluxo de negócio.
 */

const EMAIL_MAXIMO = 255;
const SENHA_MAXIMA_BYTES = 72;
const SENHA_MINIMA_CADASTRO = 8;

function criarErro(codigo, mensagem, statusCode = 400, campo = null) {
  const erro = new Error(mensagem);
  erro.codigo = codigo;
  erro.statusCode = statusCode;
  erro.campo = campo;
  return erro;
}

function validarObjeto(payload) {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw criarErro('PAYLOAD_INVALIDO', 'O corpo da requisição deve ser um objeto JSON.');
  }

  return payload;
}

function rejeitarCamposDesconhecidos(payload, camposPermitidos) {
  const camposDesconhecidos = Object.keys(payload).filter(
    (campo) => !camposPermitidos.includes(campo)
  );

  if (camposDesconhecidos.length > 0) {
    throw criarErro(
      'CAMPOS_INVALIDOS',
      'A requisição contém campos não permitidos.',
      400,
      camposDesconhecidos[0]
    );
  }
}

function normalizarEmail(valor) {
  if (valor === undefined || valor === null) {
    throw criarErro('EMAIL_OBRIGATORIO', 'O e-mail é obrigatório.', 400, 'email');
  }

  if (typeof valor !== 'string') {
    throw criarErro('EMAIL_TIPO_INVALIDO', 'O e-mail deve ser informado como texto.', 400, 'email');
  }

  const email = valor.normalize('NFKC').trim().toLowerCase();

  if (!email) {
    throw criarErro('EMAIL_OBRIGATORIO', 'O e-mail é obrigatório.', 400, 'email');
  }

  if (email.length > EMAIL_MAXIMO) {
    throw criarErro('EMAIL_MUITO_LONGO', 'O e-mail ultrapassa o limite permitido.', 400, 'email');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(email)) {
    throw criarErro('EMAIL_FORMATO_INVALIDO', 'Informe um e-mail válido.', 400, 'email');
  }

  return email;
}

function validarSenha(valor, { regraDeCadastro = false } = {}) {
  if (valor === undefined || valor === null) {
    throw criarErro('SENHA_OBRIGATORIA', 'A senha é obrigatória.', 400, 'senha');
  }

  if (typeof valor !== 'string') {
    throw criarErro('SENHA_TIPO_INVALIDO', 'A senha deve ser informada como texto.', 400, 'senha');
  }

  if (valor.length === 0 || valor.trim().length === 0) {
    throw criarErro('SENHA_OBRIGATORIA', 'A senha é obrigatória.', 400, 'senha');
  }

  // O bcrypt considera somente os primeiros 72 bytes. O limite evita truncamento silencioso.
  if (Buffer.byteLength(valor, 'utf8') > SENHA_MAXIMA_BYTES) {
    throw criarErro('SENHA_MUITO_LONGA', 'A senha ultrapassa o limite permitido.', 400, 'senha');
  }

  if (regraDeCadastro && Array.from(valor).length < SENHA_MINIMA_CADASTRO) {
    throw criarErro(
      'SENHA_MUITO_CURTA',
      `A senha deve ter pelo menos ${SENHA_MINIMA_CADASTRO} caracteres.`,
      400,
      'senha'
    );
  }

  // A senha não é aparada nem normalizada; espaços podem fazer parte da senha existente.
  return valor;
}

function validarLoginPayload(payload) {
  const dados = validarObjeto(payload);
  rejeitarCamposDesconhecidos(dados, ['email', 'senha']);

  return {
    email: normalizarEmail(dados.email),
    senha: validarSenha(dados.senha),
  };
}

module.exports = {
  criarErro,
  normalizarEmail,
  validarSenha,
  validarLoginPayload,
};
