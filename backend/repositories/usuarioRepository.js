const { executarQuery, executarTransacao } = require('../config/database');

async function listar({ busca = '', perfilId = '', ativo = '' } = {}) {
  const filtros = [];
  const valores = [];
  if (busca) { filtros.push('(u.nome LIKE ? OR u.email LIKE ?)'); valores.push(`%${busca}%`, `%${busca}%`); }
  if (perfilId) { filtros.push('u.perfil_id = ?'); valores.push(Number(perfilId)); }
  if (ativo !== '') { filtros.push('u.ativo = ?'); valores.push(ativo === true || ativo === 'true' ? 1 : 0); }
  return executarQuery(`
    SELECT u.id, u.nome, u.email, u.ativo, u.criado_em AS criadoEm,
      u.atualizado_em AS atualizadoEm, u.ultimo_login_em AS ultimoLoginEm,
      p.id AS perfilId, p.nome AS perfil,
      d.id AS departamentoId, d.nome AS departamento
    FROM usuarios u
    INNER JOIN perfis p ON p.id = u.perfil_id
    LEFT JOIN departamentos d ON d.id = u.departamento_id
    ${filtros.length ? `WHERE ${filtros.join(' AND ')}` : ''}
    ORDER BY u.nome ASC
  `, valores);
}

async function buscarPorId(id) {
  const rows = await executarQuery(`
    SELECT u.id, u.nome, u.email, u.ativo, u.criado_em AS criadoEm,
      u.atualizado_em AS atualizadoEm, u.ultimo_login_em AS ultimoLoginEm,
      p.id AS perfilId, p.nome AS perfil,
      d.id AS departamentoId, d.nome AS departamento
    FROM usuarios u
    INNER JOIN perfis p ON p.id = u.perfil_id
    LEFT JOIN departamentos d ON d.id = u.departamento_id
    WHERE u.id = ?
  `, [id]);
  return rows[0] || null;
}

async function buscarPorEmail(email, excluirId = null) {
  const rows = await executarQuery('SELECT id FROM usuarios WHERE LOWER(email) = LOWER(?) AND (? IS NULL OR id <> ?)', [email, excluirId, excluirId]);
  return rows[0] || null;
}

async function buscarOpcoes() {
  const [perfis, departamentos] = await Promise.all([
    executarQuery('SELECT id, nome FROM perfis WHERE ativo = TRUE ORDER BY id ASC'),
    executarQuery('SELECT id, nome FROM departamentos WHERE ativo = TRUE ORDER BY nome ASC')
  ]);
  return { perfis, departamentos };
}

async function criar({ nome, email, senhaHash, perfilId, departamentoId }) {
  const resultado = await executarQuery(`
    INSERT INTO usuarios (nome, email, senha_hash, perfil_id, departamento_id, ativo)
    VALUES (?, ?, ?, ?, ?, TRUE)
  `, [nome, email, senhaHash, perfilId, departamentoId || null]);
  return buscarPorId(resultado.insertId);
}

async function atualizar(id, campos) {
  const permitidos = {
    nome: 'nome', email: 'email', perfilId: 'perfil_id', departamentoId: 'departamento_id',
    senhaHash: 'senha_hash', ativo: 'ativo'
  };
  const partes = [];
  const valores = [];
  for (const [chave, coluna] of Object.entries(permitidos)) {
    if (Object.prototype.hasOwnProperty.call(campos, chave)) {
      partes.push(`${coluna} = ?`);
      valores.push(campos[chave] === '' ? null : campos[chave]);
    }
  }
  if (!partes.length) return buscarPorId(id);
  valores.push(id);
  await executarQuery(`UPDATE usuarios SET ${partes.join(', ')} WHERE id = ?`, valores);
  return buscarPorId(id);
}

module.exports = { listar, buscarPorId, buscarPorEmail, buscarOpcoes, criar, atualizar };
