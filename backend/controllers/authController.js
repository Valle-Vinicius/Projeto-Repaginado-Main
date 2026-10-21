const authService = require('../services/authService');

function registrarErroInterno(contexto, erro) {
  console.error(`[Auth][${contexto}]`, {
    mensagem: erro.message,
    codigo: erro.code || erro.codigo,
    campo: erro.campo
  });
}

function responderErro(res, erro, contexto) {
  registrarErroInterno(contexto, erro);

  if (erro.codigo === 'CREDENCIAIS_INVALIDAS') {
    return res.status(401).json({
      sucesso: false,
      codigo: erro.codigo,
      mensagem: 'E-mail ou senha inválidos.'
    });
  }

  if (erro.codigo === 'EMAIL_EM_USO' || erro.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      sucesso: false,
      codigo: 'EMAIL_EM_USO',
      mensagem: 'Este e-mail já está registrado.',
      campo: 'email'
    });
  }

  if (erro.statusCode === 400) {
    const resposta = {
      sucesso: false,
      codigo: erro.codigo || 'REQUISICAO_INVALIDA',
      mensagem: erro.message || 'Confira os dados enviados.'
    };

    if (erro.campo) resposta.campo = erro.campo;
    return res.status(400).json(resposta);
  }

  if (erro.codigo === 'CONFIGURACAO_JWT_AUSENTE') {
    return res.status(503).json({
      sucesso: false,
      codigo: erro.codigo,
      mensagem: 'O serviço de autenticação está temporariamente indisponível.'
    });
  }

  return res.status(500).json({
    sucesso: false,
    codigo: 'ERRO_INTERNO',
    mensagem: 'Não foi possível concluir a operação agora.'
  });
}

async function cadastrar(req, res) {
  try {
    const usuario = await authService.cadastrar(req.body);

    return res.status(201).json({
      sucesso: true,
      mensagem: 'Usuário registrado com sucesso.',
      usuario
    });
  } catch (erro) {
    return responderErro(res, erro, 'Cadastro');
  }
}

async function login(req, res) {
  try {
    const resultado = await authService.login(req.body, {
      ip: req.ip,
      navegador: req.get('user-agent') || null
    });

    // SEGURANÇA: Define token em cookie httpOnly (não acessável via JS)
    const expiracao = new Date();
    expiracao.setHours(expiracao.getHours() + 2); // 2 horas

    res.cookie('babycareToken', resultado.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      expires: expiracao,
      path: '/'
    });

    return res.json({
      sucesso: true,
      mensagem: 'Login realizado com sucesso.',
      token: resultado.token,
      usuario: resultado.usuario
    });
  } catch (erro) {
    return responderErro(res, erro, 'Login');
  }
}

async function logout(req, res) {
  res.clearCookie('babycareToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/'
  });

  return res.json({
    sucesso: true,
    mensagem: 'Sessão encerrada com sucesso.'
  });
}

module.exports = {
  cadastrar,
  login,
  logout
};