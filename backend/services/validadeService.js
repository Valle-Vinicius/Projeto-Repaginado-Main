const validadeRepository = require('../repositories/validadeRepository');

const STATUS_VALIDOS = new Set([
  "TODOS",
  "VENCIDOS",
  "CRITICO",
  "ATENCAO",
  "NORMAL",
]);

function erroValidacao(mensagem) {
  const erro = new Error(mensagem);
  erro.statusCode = 400;
  erro.codigo = "FILTRO_INVALIDO";
  return erro;
}

async function listar({ status = "TODOS", busca = "" } = {}) {
  const statusNormalizado = String(status).trim().toUpperCase() || "TODOS";
  const buscaNormalizada = String(busca).trim().slice(0, 100);

  if (!STATUS_VALIDOS.has(statusNormalizado)) {
    throw erroValidacao("Status de validade inválido.");
  }

  const [itens, resumo] = await Promise.all([
    validadeRepository.listarValidades({
      status: statusNormalizado,
      busca: buscaNormalizada,
      limite: 200,
    }),
    validadeRepository.obterResumo(),
  ]);

  return {
    itens,
    resumo,
    filtros: { status: statusNormalizado, busca: buscaNormalizada },
  };
}

module.exports = { listar, STATUS_VALIDOS: [...STATUS_VALIDOS] };
