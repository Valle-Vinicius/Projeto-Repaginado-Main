// repositories/usuarioRepository.js
// esse arquivo so fala com o banco, validacao fica no service

const db = require('../config/database');

async function buscarPorEmail(email) {
    const [linhas] = await db.query(
        'SELECT * FROM usuarios WHERE email = ?',
        [email]
    );
    return linhas[0] || null;
}

async function buscarPorId(id) {
    const [linhas] = await db.query(
        'SELECT id, nome, email, perfil, ativo, criado_em FROM usuarios WHERE id = ?',
        [id]
    );
    return linhas[0] || null;
}

// busca pelo id que o google manda (serve pra reconhecer quem ja logou antes)
async function buscarPorGoogleId(googleId) {
    const [linhas] = await db.query(
        'SELECT * FROM usuarios WHERE google_id = ?',
        [googleId]
    );
    return linhas[0] || null;
}

// cadastro normal, com email e senha
async function criar({ nome, email, senhaHash, perfil }) {
    const [resultado] = await db.query(
        `INSERT INTO usuarios (nome, email, senha_hash, perfil) 
         VALUES (?, ?, ?, ?)`,
        [nome, email, senhaHash, perfil || 'operador']
    );
    return resultado.insertId;
}

// cadastro vindo do google, sem senha (fica null)
async function criarComGoogle({ nome, email, googleId }) {
    const [resultado] = await db.query(
        `INSERT INTO usuarios (nome, email, senha_hash, google_id, perfil) 
         VALUES (?, ?, NULL, ?, 'operador')`,
        [nome, email, googleId]
    );
    return resultado.insertId;
}

// quando um usuario que ja existia (cadastrado com email/senha) loga
// pela primeira vez com o google, a gente so vincula o google_id
// na conta que ja existe, em vez de criar uma conta duplicada
async function vincularGoogleId(usuarioId, googleId) {
    await db.query(
        'UPDATE usuarios SET google_id = ? WHERE id = ?',
        [googleId, usuarioId]
    );
}

module.exports = {
    buscarPorEmail,
    buscarPorId,
    buscarPorGoogleId,
    criar,
    criarComGoogle,
    vincularGoogleId
};

