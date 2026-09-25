const auditoriaRepository = require('../repositories/auditoriaRepository');

const PERIODOS = new Set(['hoje', '7d', '30d', 'mes', 'todos']);
const RESULTADOS = new Set(['', 'SUCESSO', 'FALHA']);

function erroValidacao(mensagem) {
  const erro = new Error(mensagem);
  erro.statusCode = 400;
  return erro;
}

function periodoFiltro(periodo) {
  const normalizado = String(periodo || '30d').toLowerCase();
  if (!PERIODOS.has(normalizado)) throw erroValidacao('Período de auditoria inválido.');
  if (normalizado === 'todos') return { inicio: null, fim: null };

  const agora = new Date();
  const inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  if (normalizado === '7d') inicio.setDate(inicio.getDate() - 6);
  if (normalizado === '30d') inicio.setDate(inicio.getDate() - 29);
  if (normalizado === 'mes') inicio.setDate(1);
  const fim = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1);
  return { inicio, fim };
}

function normalizarEvento(item) {
  let detalhes = item.detalhes;
  if (typeof detalhes === 'string') {
    try { detalhes = JSON.parse(detalhes); } catch (erro) { detalhes = {}; }
  }
  return {
    id: Number(item.id),
    criadoEm: item.criadoEm,
    acao: item.acao,
    entidade: item.entidade,
    entidadeId: item.entidadeId === null ? null : Number(item.entidadeId),
    resultado: item.resultado,
    detalhes: detalhes || {},
    usuarioId: item.usuarioId === null ? null : Number(item.usuarioId),
    usuario: item.usuario,
    perfil: item.perfil
  };
}

async function obterAuditoria({ periodo = '30d', resultado = '', acao = '', busca = '' } = {}) {
  const filtroPeriodo = periodoFiltro(periodo);
  const resultadoNormalizado = String(resultado || '').toUpperCase();
  if (!RESULTADOS.has(resultadoNormalizado)) throw erroValidacao('Resultado de auditoria inválido.');
  const termo = String(busca || '').trim().slice(0, 100);
  const acaoNormalizada = String(acao || '').trim().slice(0, 80);
  const [eventos, acoes, resumo] = await Promise.all([
    auditoriaRepository.buscarAuditorias({ periodoInicio: filtroPeriodo.inicio, periodoFim: filtroPeriodo.fim, resultado: resultadoNormalizado, acao: acaoNormalizada, busca: termo, limite: 200 }),
    auditoriaRepository.listarAcoes(),
    auditoriaRepository.contarResumo({ periodoInicio: filtroPeriodo.inicio, periodoFim: filtroPeriodo.fim })
  ]);
  return {
    resumo: {
      total: Number(resumo.total || 0),
      sucessos: Number(resumo.sucessos || 0),
      falhas: Number(resumo.falhas || 0),
      usuarios: Number(resumo.usuarios || 0)
    },
    acoes: acoes.map(item => item.acao),
    eventos: eventos.map(normalizarEvento)
  };
}

module.exports = { obterAuditoria };
