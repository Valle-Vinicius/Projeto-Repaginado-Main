const dashboardService = require('../services/dashboardService');

const PARAMETROS_PERMITIDOS = new Set(['periodo']);

function criarErroValidacao(mensagem, codigo) {
  const erro = new Error(mensagem);
  erro.statusCode = 400;
  erro.codigo = codigo;
  return erro;
}

function obterPeriodo(query) {
  const chavesRecebidas = Object.keys(query || {});
  const parametroDesconhecido = chavesRecebidas.find((chave) => !PARAMETROS_PERMITIDOS.has(chave));

  if (parametroDesconhecido) {
    throw criarErroValidacao(
      `Parâmetro não permitido: ${parametroDesconhecido}.`,
      'PARAMETRO_NAO_PERMITIDO'
    );
  }

  if (query?.periodo === null) {
    return '30d';
  }
  if (typeof query.periodo !== 'string') {
    throw criarErroValidacao('O parâmetro periodo deve ser um texto.', 'PERIODO_TIPO_INVALIDO');
  }

  const periodo = query.periodo.trim();
  if (!periodo) {
    throw criarErroValidacao('O parâmetro periodo não pode ser vazio.', 'PERIODO_VAZIO');
  }

  return periodo;
}

function ehErroDeConexao(erro) {
  return [
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'ENETUNREACH',
  ].includes(erro.code || erro.codigo);
}

async function obterDashboard(req, res) {
  try {
    const periodo = obterPeriodo(req.query);
    const dados = await dashboardService.obterDashboard({ periodo });

    return res.status(200).json({
      sucesso: true,
      ...dados,
    });
  } catch (erro) {
    const statusCode = erro.statusCode || (ehErroDeConexao(erro) ? 503 : 500);
    const mensagem =
      statusCode === 400
        ? erro.message
        : statusCode === 503
          ? 'O banco de dados está temporariamente indisponível.'
          : 'Não foi possível carregar os dados da dashboard.';

    console.error('[Dashboard]', {
      mensagem: erro.message,
      codigo: erro.codigo,
      statusCode,
    });

    return res.status(statusCode).json({
      sucesso: false,
      codigo:
        statusCode === 400
          ? erro.codigo || 'PARAMETRO_INVALIDO'
          : statusCode === 503
            ? 'BANCO_INDISPONIVEL'
            : 'ERRO_DASHBOARD',
      mensagem,
    });
  }
}

module.exports = {
  obterDashboard,
};
