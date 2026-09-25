const { executarQuery } = require('../config/database');

async function buscarPorEmail(email) {
  const usuarios = await executarQuery(
    `SELECT
       u.id,
       u.nome,
       u.email,
       u.senha_hash,
       u.ativo,
       u.tentativas_login,
       u.bloqueado_ate,
       p.nome AS perfil,
       p.ativo AS perfilAtivo,
       d.nome AS departamento
     FROM usuarios u
     INNER JOIN perfis p ON p.id = u.perfil_id
     LEFT JOIN departamentos d ON d.id = u.departamento_id
     WHERE u.email = ?`,
    [email]
  );

  return usuarios[0] || null;
}

async function buscarPorId(id) {
  const usuarios = await executarQuery(
    `SELECT
       u.id,
       u.nome,
       u.email,
       u.ativo,
       p.nome AS perfil,
       d.nome AS departamento
     FROM usuarios u
     INNER JOIN perfis p ON p.id = u.perfil_id
     LEFT JOIN departamentos d ON d.id = u.departamento_id
     WHERE u.id = ?`,
    [id]
  );

  return usuarios[0] || null;
}

async function buscarPerfilPorId(perfilId) {
  const perfis = await executarQuery(
    'SELECT id, nome, ativo FROM perfis WHERE id = ?',
    [perfilId]
  );

  return perfis[0] || null;
}

async function inserir({ nome, email, senhaHash, perfilId, departamentoId }) {
  const resultado = await executarQuery(
    `INSERT INTO usuarios
      (nome, email, senha_hash, perfil_id, departamento_id)
     VALUES (?, ?, ?, ?, ?)`,
    [nome, email, senhaHash, perfilId, departamentoId || null]
  );

  return buscarPorId(resultado.insertId);
}

async function registrarFalhaLogin(id, limiteTentativas, minutosBloqueio) {
  await executarQuery(
    `UPDATE usuarios
        SET bloqueado_ate = CASE
              WHEN tentativas_login + 1 >= ?
                THEN COALESCE(bloqueado_ate, DATE_ADD(NOW(), INTERVAL ? MINUTE))
              ELSE bloqueado_ate
            END,
            tentativas_login = LEAST(tentativas_login + 1, ?)
      WHERE id = ?
        AND ativo = TRUE
        AND (bloqueado_ate IS NULL OR bloqueado_ate <= NOW())`,
    [limiteTentativas, minutosBloqueio, limiteTentativas, id]
  );
}

async function limparFalhasLogin(id) {
  await executarQuery(
    `UPDATE usuarios
        SET tentativas_login = 0,
            bloqueado_ate = NULL,
            ultimo_login_em = NOW()
      WHERE id = ?`,
    [id]
  );
}

module.exports = {
  buscarPorEmail,
  buscarPorId,
  buscarPerfilPorId,
  inserir,
  registrarFalhaLogin,
  limparFalhasLogin
};
