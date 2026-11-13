const crypto = require('crypto');
const estoqueService = require('./estoqueService');
const produtoService = require('./produtoService');
const repository = require('../repositories/integracaoErpRepository');

function erroIntegracao(mensagem, statusCode, codigo) {
  const erro = new Error(mensagem);
  erro.statusCode = statusCode;
  erro.codigo = codigo;
  return erro;
}

function serializarCanonico(valor) {
  if (Array.isArray(valor)) {
    return `[${valor.map(serializarCanonico).join(',')}]`;
  }
  if (valor && typeof valor === 'object') {
    return `{${Object.keys(valor)
      .sort()
      .map(
        (chave) =>
          `${JSON.stringify(chave)}:${serializarCanonico(valor[chave])}`,
      )
      .join(',')}}`;
  }
  return JSON.stringify(valor);
}

function validarEventoExterno(valor) {
  const eventoId = String(valor || '').trim();
  if (
    !eventoId ||
    eventoId.length > 120 ||
    /[\u0000-\u001f\u007f]/u.test(eventoId)
  ) {
    throw erroIntegracao(
      'Informe um Idempotency-Key válido com até 120 caracteres.',
      400,
      'IDEMPOTENCY_KEY_INVALIDA',
    );
  }
  return eventoId;
}

async function listarProdutos({ pagina = 1, limite = 100 } = {}) {
  return produtoService.listarProdutos({ pagina, limite });
}

async function processarMovimentacao(eventoExterno, payload) {
  const eventoId = validarEventoExterno(eventoExterno);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw erroIntegracao(
      'O corpo deve ser um objeto de movimentação.',
      400,
      'PAYLOAD_INVALIDO',
    );
  }

  const payloadHash = crypto
    .createHash('sha256')
    .update(serializarCanonico(payload))
    .digest('hex');
  const reserva = await repository.reservarEvento(eventoId, payloadHash);

  if (!reserva.novo) {
    const evento = reserva.evento;
    if (evento.payloadHash !== payloadHash) {
      throw erroIntegracao(
        'O Idempotency-Key já foi usado com outro conteúdo.',
        409,
        'IDEMPOTENCY_KEY_REUTILIZADA',
      );
    }

    if (evento.status === 'CONCLUIDO') {
      return { resposta: evento.resposta, repetida: true };
    }
    if (evento.status === 'FALHA') {
      throw erroIntegracao(
        evento.erroMensagem || 'O evento ERP anterior falhou.',
        Number(evento.erroStatus) || 409,
        evento.erroCodigo || 'EVENTO_ERP_FALHOU',
      );
    }

    throw erroIntegracao(
      'Este evento ERP já está sendo processado.',
      409,
      'EVENTO_ERP_PROCESSANDO',
    );
  }

  try {
    const usuarioIntegracao = { id: null, perfil: 'INTEGRACAO_ERP' };
    const tipo = String(payload.tipo || '')
      .trim()
      .toUpperCase();
    const dados =
      tipo === 'AJUSTE'
        ? await estoqueService.ajustarEstoque(payload, usuarioIntegracao)
        : await estoqueService.registrarMovimentacao(
            { ...payload, tipo },
            usuarioIntegracao,
          );
    const resposta = { sucesso: true, dados };
    await repository.concluirEvento(eventoId, resposta);
    return { resposta, repetida: false };
  } catch (erro) {
    const status = Number.isInteger(erro.statusCode) ? erro.statusCode : 500;
    const codigo = erro.codigo || 'ERRO_INTEGRACAO_ERP';
    const mensagem =
      status < 500
        ? erro.message
        : 'Não foi possível registrar a movimentação ERP.';
    await repository.falharEvento(eventoId, status, codigo, mensagem);
    throw erro;
  }
}

module.exports = { listarProdutos, processarMovimentacao };
