const service = require('../services/integracaoErpService');

function responderErro(res, erro) {
  const status = Number.isInteger(erro.statusCode) ? erro.statusCode : 500;
  if (status >= 500) {
    console.error('[ERP]', { mensagem: erro.message, codigo: erro.codigo });
  }
  return res.status(status).json({
    sucesso: false,
    codigo: erro.codigo || 'ERRO_INTEGRACAO_ERP',
    mensagem:
      status < 500 ? erro.message : 'Não foi possível concluir a operação ERP.',
  });
}

function inteiroQuery(valor, padrao, campo, maximo = Number.MAX_SAFE_INTEGER) {
  if (valor === undefined) {
    return padrao;
  }
  const texto = String(valor);
  const numero = Number(texto);
  if (
    !/^\d+$/u.test(texto) ||
    !Number.isSafeInteger(numero) ||
    numero < 1 ||
    numero > maximo
  ) {
    const erro = new Error(
      `O parâmetro ${campo} deve ser um inteiro entre 1 e ${maximo}.`,
    );
    erro.statusCode = 400;
    erro.codigo = 'PARAMETRO_PAGINACAO_INVALIDO';
    throw erro;
  }
  return numero;
}

async function listarProdutos(req, res) {
  try {
    const pagina = inteiroQuery(req.query.pagina, 1, 'pagina');
    const limite = inteiroQuery(req.query.limite, 100, 'limite', 100);
    const resultado = await service.listarProdutos({ pagina, limite });
    return res.json({ sucesso: true, ...resultado });
  } catch (erro) {
    return responderErro(res, erro);
  }
}

async function registrarMovimentacao(req, res) {
  try {
    const eventoId = req.get('Idempotency-Key');
    const resultado = await service.processarMovimentacao(eventoId, req.body);
    if (resultado.repetida) {
      res.setHeader('Idempotency-Replayed', 'true');
    }
    return res.status(resultado.repetida ? 200 : 201).json(resultado.resposta);
  } catch (erro) {
    return responderErro(res, erro);
  }
}

module.exports = { listarProdutos, registrarMovimentacao };
