const { OAuth2Client } = require('google-auth-library');
const authService = require('../services/authService');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL ||
    'http://localhost:3000/api/auth/google/callback';

const oauth2Client = new OAuth2Client(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_CALLBACK_URL
 );

function responderErro(res, erro) {
    if (erro.tipo === 'validacao') {
        return res.status(400).json({ mensagem: erro.message });
    }

    if (erro.tipo === 'conflito') {
        return res.status(409).json({ mensagem: erro.message });
    }

    if (erro.tipo === 'autenticacao') {
        return res.status(401).json({ mensagem: erro.message });
    }

    console.error(erro);
    return res.status(500).json({
        mensagem: 'Erro interno do servidor'
    });
}

async function cadastrar(req, res) {
    try {
        const resultado = await authService.cadastrar(req.body);
        return res.status(201).json(resultado);
    } catch (erro) {
        return responderErro(res, erro);
    }
}

async function login(req, res) {
    try {
        const resultado = await authService.login(req.body);
        return res.status(200).json(resultado);
    } catch (erro) {
        return responderErro(res, erro);
    }
}

function redirecionarGoogle(req, res) {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        return res.status(500).send(
            'Configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no arquivo .env'
        );
    }

    const urlGoogle = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
            'openid',
            'email',
            'profile'
        ],
        prompt: 'select_account'
    });

    return res.redirect(urlGoogle);
}

async function callbackGoogle(req, res) {
    try {
        const { code, error } = req.query;

        if (error) {
            return res.status(400).send(
                `O Google recusou o login: ${error}`
            );
        }

        if (!code) {
            return res.status(400).send(
                'O Google não enviou o código de autorização.'
            );
        }

        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        if (!tokens.id_token) {
            return res.status(401).send(
                'O Google não retornou um token de identificação.'
            );
        }

        const ticket = await oauth2Client.verifyIdToken({
            idToken: tokens.id_token,
            audience: GOOGLE_CLIENT_ID
        });

        const dadosGoogle = ticket.getPayload();

        if (!dadosGoogle || !dadosGoogle.sub || !dadosGoogle.email) {
            return res.status(401).send(
                'Não foi possível obter os dados da conta Google.'
            );
        }

        const resultado = await authService.loginComGoogle({
            googleId: dadosGoogle.sub,
            email: dadosGoogle.email,
            nome: dadosGoogle.name || dadosGoogle.email.split('@')[0]
        });

        const frontendUrl = process.env.FRONTEND_URL ||
            'http://localhost:3000';
        const dashboardUrl = `${frontendUrl}/pages/dashboard.html`;

        // O token é enviado para o frontend pelo mesmo servidor.
        // Em produção, prefira cookie HttpOnly e Secure.
        const token = JSON.stringify(resultado.token );
        const usuario = JSON.stringify(resultado.usuario);
        const destino = JSON.stringify(dashboardUrl);

        return res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Login realizado</title>
</head>
<body>
    <p>Login realizado. Redirecionando...</p>
    <script>
        localStorage.setItem('token', ${token});
        localStorage.setItem('usuario', ${usuario});
        window.location.replace(${destino});
    </script>
</body>
</html>`);
    } catch (erro) {
        console.error('Erro no callback do Google:', erro);
        return res.status(500).send(
            'Não foi possível concluir o login com o Google.'
        );
    }
}

module.exports = {
    cadastrar,
    login,
    redirecionarGoogle,
    callbackGoogle
};