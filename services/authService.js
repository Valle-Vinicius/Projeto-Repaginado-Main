// services/authService.js
// regra de negocio de autenticacao: validacao, hash, token, e agora tambem o google

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const usuarioRepository = require('../repositories/usuarioRepository');

const JWT_SECRET = process.env.JWT_SECRET || 'segredo-troca-isso-depois';
const JWT_EXPIRA_EM = '8h';
const SALT_ROUNDS = 10;

// -------------------------------------------
// VALIDAÇÕES
// -------------------------------------------
function validarEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

function validarDadosCadastro({ nome, email, senha }) {
    const erros = [];

    if (!nome || nome.trim().length < 3) {
        erros.push('Nome precisa ter pelo menos 3 caracteres');
    }
    if (!email || !validarEmail(email)) {
        erros.push('Email invalido');
    }
    if (!senha || senha.length < 8) {
        erros.push('Senha precisa ter no minimo 8 caracteres');
    }

    return erros;
}

// -------------------------------------------
// GERA O TOKEN (usado tanto no login normal quanto no google)
// -------------------------------------------
function gerarToken(usuario) {
    return jwt.sign(
        { id: usuario.id, email: usuario.email, perfil: usuario.perfil },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRA_EM }
    );
}

// -------------------------------------------
// CADASTRO NORMAL (email e senha)
// -------------------------------------------
async function cadastrar({ nome, email, senha, perfil }) {
    const erros = validarDadosCadastro({ nome, email, senha });
    if (erros.length > 0) {
        const erro = new Error(erros.join(', '));
        erro.tipo = 'validacao';
        throw erro;
    }

    const usuarioExistente = await usuarioRepository.buscarPorEmail(email.trim().toLowerCase());
    if (usuarioExistente) {
        const erro = new Error('Ja existe um usuario cadastrado com esse email');
        erro.tipo = 'conflito';
        throw erro;
    }

    const senhaHash = await bcrypt.hash(senha, SALT_ROUNDS);

    const novoId = await usuarioRepository.criar({
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        senhaHash,
        perfil
    });

    return { id: novoId, nome, email, perfil: perfil || 'operador' };
}

// -------------------------------------------
// LOGIN NORMAL (email e senha)
// -------------------------------------------
async function login({ email, senha }) {
    if (!email || !senha) {
        const erro = new Error('Email e senha sao obrigatorios');
        erro.tipo = 'validacao';
        throw erro;
    }

    const usuario = await usuarioRepository.buscarPorEmail(email.trim().toLowerCase());

    if (!usuario) {
        const erro = new Error('Email ou senha invalidos');
        erro.tipo = 'autenticacao';
        throw erro;
    }

    // se o usuario so tem conta pelo google, ele nao tem senha cadastrada
    if (!usuario.senha_hash) {
        const erro = new Error('Essa conta usa login com Google. Entra pelo botao do Google.');
        erro.tipo = 'autenticacao';
        throw erro;
    }

    if (!usuario.ativo) {
        const erro = new Error('Usuario desativado, fala com o administrador');
        erro.tipo = 'autenticacao';
        throw erro;
    }

    const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaCorreta) {
        const erro = new Error('Email ou senha invalidos');
        erro.tipo = 'autenticacao';
        throw erro;
    }

    return {
        token: gerarToken(usuario),
        usuario: {
            id: usuario.id,
            nome: usuario.nome,
            email: usuario.email,
            perfil: usuario.perfil
        }
    };
}

// -------------------------------------------
// LOGIN / CADASTRO VIA GOOGLE
// chamado depois que a gente ja trocou o "code" pelas infos do usuario
// (isso acontece no controller, aqui so recebe os dados prontos)
// -------------------------------------------
async function loginComGoogle({ googleId, email, nome }) {
    if (!email || !googleId) {
        const erro = new Error('Nao foi possivel obter os dados da conta Google');
        erro.tipo = 'autenticacao';
        throw erro;
    }

    const emailNormalizado = email.trim().toLowerCase();

    // 1. ja logou com google antes? acha direto pelo google_id
    let usuario = await usuarioRepository.buscarPorGoogleId(googleId);

    // 2. primeira vez com google, mas ja tem conta com esse email
    //    (cadastrada com senha antes)? vincula o google na conta existente
    if (!usuario) {
        usuario = await usuarioRepository.buscarPorEmail(emailNormalizado);

        if (usuario) {
            await usuarioRepository.vincularGoogleId(usuario.id, googleId);
        }
    }

    // 3. nao existe de jeito nenhum? cria uma conta nova
    if (!usuario) {
        const novoId = await usuarioRepository.criarComGoogle({
            nome,
            email: emailNormalizado,
            googleId
        });

        usuario = {
            id: novoId,
            nome,
            email: emailNormalizado,
            perfil: 'operador',
            ativo: true
        };
    }

    if (!usuario.ativo) {
        const erro = new Error('Usuario desativado, fala com o administrador');
        erro.tipo = 'autenticacao';
        throw erro;
    }

    return {
        token: gerarToken(usuario),
        usuario: {
            id: usuario.id,
            nome: usuario.nome,
            email: usuario.email,
            perfil: usuario.perfil
        }
    };
}

function verificarToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        const erro = new Error('Token invalido ou expirado');
        erro.tipo = 'autenticacao';
        throw erro;
    }
}

module.exports = {
    cadastrar,
    login,
    loginComGoogle,
    verificarToken
};