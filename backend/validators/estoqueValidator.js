const CAMPOS_PERMITIDOS = new Set([
  'tipo',
  'produtoId',
  'quantidade',
  'loteId',
  'numeroLote',
  'dataValidade',
  'localizacaoId',
  'fornecedor',
  'documento',
  'destinatario',
  'destino',
  'motivo',
  'observacao'
]);

const TIPOS_MOVIMENTACAO = new Set(['ENTRADA', 'SAIDA']);

function erroValidacao(mensagem) {
  const erro = new Error(mensagem);
  erro.statusCode = 400;
  return erro;
}

function textoOpcional(valor, limite, campo) {
  if (valor === undefined || valor === null || valor === '') return null;
  if (typeof valor !== 'string') throw erroValidacao(`${campo} deve ser texto.`);

  const texto = valor.trim();
  if (texto.length > limite) {
    throw erroValidacao(`${campo} ultrapassa o limite de ${limite} caracteres.`);
  }
  return texto || null;
}

function idOpcional(valor, campo) {
  if (valor === undefined || valor === null || valor === '') return null;
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero <= 0) {
    throw erroValidacao(`${campo} inválido.`);
  }
  return numero;
}

function quantidadeObrigatoria(valor) {
  const quantidade = Number(valor);
  if (!Number.isFinite(quantidade) || quantidade <= 0 || quantidade > 999999999.999) {
    throw erroValidacao('A quantidade deve ser maior que zero e estar dentro do limite permitido.');
  }

  const casasDecimais = String(valor).replace(',', '.').split('.')[1]?.length || 0;
  if (casasDecimais > 3) {
    throw erroValidacao('A quantidade pode ter no máximo três casas decimais.');
  }

  return Number(quantidade.toFixed(3));
}

function dataValidadeOpcional(valor) {
  if (valor === undefined || valor === null || valor === '') return null;
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    throw erroValidacao('A data de validade deve estar no formato AAAA-MM-DD.');
  }

  const [ano, mes, dia] = valor.split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  if (
    data.getUTCFullYear() !== ano
    || data.getUTCMonth() !== mes - 1
    || data.getUTCDate() !== dia
  ) {
    throw erroValidacao('A data de validade informada não é válida.');
  }

  return valor;
}

function validarMovimentacao(payload = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw erroValidacao('O corpo da movimentação deve ser um objeto.');
  }

  const camposRecebidos = Object.keys(payload);
  const campoDesconhecido = camposRecebidos.find((campo) => !CAMPOS_PERMITIDOS.has(campo));
  if (campoDesconhecido) {
    throw erroValidacao(`Campo não permitido: ${campoDesconhecido}.`);
  }

  const tipo = typeof payload.tipo === 'string' ? payload.tipo.trim().toUpperCase() : '';
  if (!TIPOS_MOVIMENTACAO.has(tipo)) {
    throw erroValidacao('Tipo de movimentação inválido.');
  }

  const produtoId = idOpcional(payload.produtoId, 'Produto');
  if (!produtoId) throw erroValidacao('Produto é obrigatório.');

  const motivo = textoOpcional(payload.motivo, 80, 'Motivo');
  if (!motivo) throw erroValidacao('Motivo é obrigatório.');

  const numeroLote = textoOpcional(payload.numeroLote, 80, 'Número do lote');
  const fornecedor = textoOpcional(payload.fornecedor, 150, 'Fornecedor');
  const documento = textoOpcional(payload.documento, 80, 'Documento');
  const destinatario = textoOpcional(payload.destinatario, 150, 'Destinatário');
  const destino = textoOpcional(payload.destino, 150, 'Destino');
  if (tipo === 'ENTRADA' && (destinatario || destino)) {
    throw erroValidacao('Destinatário e destino só podem ser informados em expedições.');
  }
  if (tipo === 'SAIDA' && (fornecedor || documento)) {
    throw erroValidacao('Fornecedor e documento só podem ser informados em recebimentos.');
  }
  if (tipo === 'SAIDA' && !destinatario) throw erroValidacao('Destinatário é obrigatório para uma expedição.');
  if (tipo === 'SAIDA' && !destino) throw erroValidacao('Destino é obrigatório para uma expedição.');
  if (tipo === 'ENTRADA' && !numeroLote && !payload.loteId) {
    throw erroValidacao('Número do lote é obrigatório para registrar uma entrada.');
  }

  return {
    tipo,
    produtoId,
    quantidade: quantidadeObrigatoria(payload.quantidade),
    loteId: idOpcional(payload.loteId, 'Lote'),
    numeroLote,
    dataValidade: dataValidadeOpcional(payload.dataValidade),
    localizacaoId: idOpcional(payload.localizacaoId, 'Localização'),
    fornecedor,
    documento,
    destinatario,
    destino,
    motivo,
    observacao: textoOpcional(payload.observacao, 255, 'Observação')
  };
}

module.exports = {
  validarMovimentacao
};
