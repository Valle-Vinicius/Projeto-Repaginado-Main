const authService = require('../services/authService');

function registrarErroInterno(contexto, erro) {
  console.error(`[Auth][${contexto}]`, {
    mensagem: erro.message,
    codigo: erro.code || erro.codigo,
    detalheMySQL: erro.sqlMessage,
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
      mensagem: 'Este e-mail já está cadastrado.',
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
      mensagem: 'Usuário cadastrado com sucesso.',
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

    return res.json({
      sucesso: true,
      mensagem: 'Login realizado com sucesso.',
      ...resultado
    });
  } catch (erro) {
    return responderErro(res, erro, 'Login');
  }
}

module.exports = {
  cadastrar,
  login
};
