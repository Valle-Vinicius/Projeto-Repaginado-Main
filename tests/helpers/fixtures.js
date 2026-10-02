"use strict";
/**
 * Fixtures e operações reutilizáveis pelos arquivos de teste.
 *
 * Todos os dados criados usam prefixos por módulo (ex.: "AUT-", "PROD-",
 * "REC-") para que os arquivos de teste não interfiram uns nos outros e
 * possam ser executados em qualquer ordem.
 */
const { consultar, executar } = require("./db");
const { requisitar } = require("./server");

let contador = 0;
/** Gera um sufixo único para SKUs/lotes/nomes. */
function sufixo() {
  contador += 1;
  const agora = Date.now();
  return `${agora.toString(36)}${contador.toString(36)}`.toUpperCase();
}

/** Remove registros de teste de um módulo (executado antes de cada arquivo). */
async function limparPrefixo(tabela, coluna, prefixo) {
  await executar(`DELETE FROM ${tabela} WHERE ${coluna} LIKE ?`, [`${prefixo}%`]);
}

/** Cria um produto via POST /api/produtos. */
async function criarProdutoViaApi(token, sobrescritas = {}) {
  const corpo = {
    nome: "Produto de Teste",
    codigo: `TEST-${sufixo()}`,
    descricao: "Criado pela bateria de testes",
    categoriaId: 1,
    estoqueMinimo: 0,
    unidade: "UN",
    possuiValidade: false,
    ...sobrescritas,
  };
  const resultado = await requisitar("/api/produtos", {
    metodo: "POST",
    token,
    corpo,
  });
  return { ...resultado, payloadEnviado: corpo };
}

/** Busca o saldo de um produto (soma dos lotes ativos) no banco de teste. */
async function saldoDoProduto(produtoId) {
  const linhas = await consultar(
    `SELECT COALESCE(SUM(quantidade_atual), 0) AS saldo
       FROM lotes WHERE produto_id = ? AND ativo = TRUE`,
    [produtoId],
  );
  return Number(linhas[0].saldo);
}

/** Lista lotes de um produto (ordem de inserção). */
async function lotesDoProduto(produtoId) {
  return consultar(
    `SELECT * FROM lotes WHERE produto_id = ? ORDER BY id ASC`,
    [produtoId],
  );
}

/** Lista movimentações de um produto (mais recentes primeiro). */
async function movimentacoesDoProduto(produtoId) {
  return consultar(
    `SELECT * FROM movimentacoes WHERE produto_id = ? ORDER BY id DESC`,
    [produtoId],
  );
}

/** Busca registros de auditoria por ação. */
async function auditoriasPorAcao(acao, limite = 50) {
  return consultar(
    `SELECT a.*, u.email, p.nome AS perfil_nome
       FROM auditorias a
       LEFT JOIN usuarios u ON u.id = a.usuario_id
       LEFT JOIN perfis p ON p.id = u.perfil_id
      WHERE a.acao = ?
      ORDER BY a.id DESC
      LIMIT ?`,
    [acao, limite],
  );
}

/** Busca usuário de teste por e-mail. */
async function usuarioPorEmail(email) {
  const linhas = await consultar(
    `SELECT u.*, p.nome AS perfil_nome
       FROM usuarios u
       INNER JOIN perfis p ON p.id = u.perfil_id
      WHERE u.email = ?`,
    [email],
  );
  return linhas[0] || null;
}

module.exports = {
  sufixo,
  limparPrefixo,
  criarProdutoViaApi,
  saldoDoProduto,
  lotesDoProduto,
  movimentacoesDoProduto,
  auditoriasPorAcao,
  usuarioPorEmail,
};