const repository = require('../repositories/relatorioRepository');

const PERIODOS = new Set(['hoje', '7d', '30d', 'mes']);
const TIPOS = new Set(['', 'ENTRADA', 'SAIDA']);

function erroValidacao(mensagem) {
  const erro = new Error(mensagem);
  erro.statusCode = 400;
  erro.codigo = 'FILTRO_INVALIDO';
  return erro;
}

function intervalo(periodo) {
  const valor = String(periodo || '30d').toLowerCase();
  if (!PERIODOS.has(valor)) throw erroValidacao('Período de relatório inválido.');
  
  const agora = new Date();
  const inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  
  if (valor === '7d') inicio.setDate(inicio.getDate() - 6);
  if (valor === '30d') inicio.setDate(inicio.getDate() - 29);
  if (valor === 'mes') inicio.setDate(1);
  
  const fim = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1);
  return { inicio, fim };
}

function inteiroOpcional(valor, nome) {
  if (valor === '' || valor === undefined || valor === null) return '';
  const numero = Number(valor);

  if (!Number.isInteger(numero) || numero <= 0) {
    throw erroValidacao(`${nome} inválido.`);
  }
  return numero;
}

function numero(item, campo) { 
  return Number(item?.[campo] || 0); 
}

async function obterRelatorio({ periodo = '30d', tipo = '', categoriaId = '', produtoId = '' } = {}) {
  const periodoNormalizado = intervalo(periodo);
  const tipoNormalizado = String(tipo || '').toUpperCase();
  
  if (!TIPOS.has(tipoNormalizado)) throw erroValidacao('Tipo de movimentação inválido.');
  
  const filtro = {
    ...periodoNormalizado,
    tipo: tipoNormalizado,
    categoriaId: inteiroOpcional(categoriaId, 'Categoria'),
    produtoId: inteiroOpcional(produtoId, 'Produto')
  };

  const [filtros, resumo, serie, porCategoria, porProduto, historico] = await Promise.all([
    repository.buscarFiltros(filtro), // DICA: Pode passar o filtro caso queira filtrar os seletores de produtos por categoria
    repository.buscarResumo(filtro),
    repository.buscarSerie(filtro),
    repository.buscarPorCategoria(filtro),
    repository.buscarPorProduto(filtro),
    repository.buscarHistorico(filtro)
  ]);

  return {
    resumo: {
      movimentacoes: numero(resumo, 'movimentacoes'),
      entradas: numero(resumo, 'entradas'),
      saidas: numero(resumo, 'saidas'),
      produtosMovimentados: numero(resumo, 'produtosMovimentados')
    },
    serie: (serie || []).map((x) => ({ 
      data: x.data, 
      entradas: numero(x, 'entradas'), 
      saidas: numero(x, 'saidas') 
    })),
    porCategoria: (porCategoria || []).map((x) => ({ 
      id: Number(x.id), 
      nome: x.nome, 
      quantidade: numero(x, 'quantidade') 
    })),
    porProduto: (porProduto || []).map((x) => ({ 
      produtoId: Number(x.produtoId), 
      produto: x.produto, 
      codigo: x.codigo, 
      quantidade: numero(x, 'quantidade') 
    })),
    historico: (historico || []).map((x) => ({ 
      ...x, 
      id: Number(x.id), 
      quantidade: numero(x, 'quantidade') 
    })),
    categorias: filtros?.categorias || [],
    produtos: filtros?.produtos || []
  };
}

module.exports = { obterRelatorio };