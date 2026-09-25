const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userRepository = require('../repositories/userRepository');
const auditoriaRepository = require('../repositories/auditoriaRepository');

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '2h';
const MAX_TENTATIVAS = 5;
const MINUTOS_BLOQUEIO = 15;
const EMAIL_MAXIMO = 255;
const SENHA_MAXIMA_BYTES = 72;
const SENHA_MINIMA_CADASTRO = 8;

// Hash fixo usado somente para manter o custo de comparação quando o e-mail não existe.
const HASH_SENHA_DUMMY = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

function criarErro(codigo, mensagem, statusCode = 400, campo = null) {
  const erro = new Error(mensagem);
  erro.codigo = codigo;
  erro.statusCode = statusCode;
  erro.campo = campo;
  return erro;
}

function validarObjeto(payload) {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw criarErro('PAYLOAD_INVALIDO', 'O corpo da requisição deve ser um objeto JSON.');
  }

  return payload;
}

function rejeitarCamposDesconhecidos(payload, camposPermitidos) {
  const camposDesconhecidos = Object.keys(payload)
    .filter((campo) => !camposPermitidos.includes(campo));

  if (camposDesconhecidos.length > 0) {
    throw criarErro(
      'CAMPOS_INVALIDOS',
      'A requisição contém campos não permitidos.',
      400,
      camposDesconhecidos[0]
    );
  }
}

function normalizarEmail(valor) {
  if (valor === undefined || valor === null) {
    throw criarErro('EMAIL_OBRIGATORIO', 'O e-mail é obrigatório.', 400, 'email');
  }

  if (typeof valor !== 'string') {
    throw criarErro('EMAIL_TIPO_INVALIDO', 'O e-mail deve ser informado como texto.', 400, 'email');
  }

  const email = valor.normalize('NFKC').trim().toLowerCase();

  if (!email) {
    throw criarErro('EMAIL_OBRIGATORIO', 'O e-mail é obrigatório.', 400, 'email');
  }

  if (email.length > EMAIL_MAXIMO) {
    throw criarErro('EMAIL_MUITO_LONGO', 'O e-mail ultrapassa o limite permitido.', 400, 'email');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(email)) {
    throw criarErro('EMAIL_FORMATO_INVALIDO', 'Informe um e-mail válido.', 400, 'email');
  }

  return email;
}

function validarSenha(valor, { regraDeCadastro = false } = {}) {
  if (valor === undefined || valor === null) {
    throw criarErro('SENHA_OBRIGATORIA', 'A senha é obrigatória.', 400, 'senha');
  }

  if (typeof valor !== 'string') {
    throw criarErro('SENHA_TIPO_INVALIDO', 'A senha deve ser informada como texto.', 400, 'senha');
  }

  if (valor.length === 0 || valor.trim().length === 0) {
    throw criarErro('SENHA_OBRIGATORIA', 'A senha é obrigatória.', 400, 'senha');
  }

  // O bcrypt considera somente os primeiros 72 bytes. O limite evita truncamento silencioso.
  if (Buffer.byteLength(valor, 'utf8') > SENHA_MAXIMA_BYTES) {
    throw criarErro('SENHA_MUITO_LONGA', 'A senha ultrapassa o limite permitido.', 400, 'senha');
  }

  if (regraDeCadastro && Array.from(valor).length < SENHA_MINIMA_CADASTRO) {
    throw criarErro(
      'SENHA_MUITO_CURTA',
      `A senha deve ter pelo menos ${SENHA_MINIMA_CADASTRO} caracteres.`,
      400,
      'senha'
    );
  }

  // A senha não é aparada nem normalizada; espaços podem fazer parte da senha existente.
  return valor;
}

function normalizarNome(valor) {
  if (valor === undefined || valor === null) {
    throw criarErro('NOME_OBRIGATORIO', 'O nome é obrigatório.', 400, 'nome');
  }

  if (typeof valor !== 'string') {
    throw criarErro('NOME_TIPO_INVALIDO', 'O nome deve ser informado como texto.', 400, 'nome');
  }

  const nome = valor.normalize('NFKC').trim().replace(/\s+/gu, ' ');

  if (!nome) {
    throw criarErro('NOME_OBRIGATORIO', 'O nome é obrigatório.', 400, 'nome');
  }

  if (Array.from(nome).length < 3) {
    throw criarErro('NOME_MUITO_CURTO', 'O nome deve ter pelo menos 3 caracteres.', 400, 'nome');
  }

  if (nome.length > 120) {
    throw criarErro('NOME_MUITO_LONGO', 'O nome ultrapassa o limite permitido.', 400, 'nome');
  }

  return nome;
}

function validarLoginPayload(payload) {
  const dados = validarObjeto(payload);
  rejeitarCamposDesconhecidos(dados, ['email', 'senha']);

  return {
    email: normalizarEmail(dados.email),
    senha: validarSenha(dados.senha)
  };
}

function validarCadastroPayload(payload) {
  const dados = validarObjeto(payload);
  rejeitarCamposDesconhecidos(dados, ['nome', 'email', 'senha']);

  return {
    nome: normalizarNome(dados.nome),
    email: normalizarEmail(dados.email),
    senha: validarSenha(dados.senha, { regraDeCadastro: true })
  };
}

function usuarioPublico(usuario) {
  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    perfil: usuario.perfil,
    departamento: usuario.departamento || null,
    ativo: Boolean(usuario.ativo)
  };
}

async function registrarAuditoria(dados) {
  try {
    await auditoriaRepository.registrar(dados);
  } catch (erro) {
    // Falha de auditoria não deve registrar senha nem impedir uma resposta coerente ao usuário.
    console.error('[Auth][Auditoria]', {
      mensagem: erro.message,
      codigo: erro.code
    });
  }
}

function obterJwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw criarErro(
      'CONFIGURACAO_JWT_AUSENTE',
      'A autenticação não está configurada no servidor.',
      503
    );
  }

  return process.env.JWT_SECRET;
}

function erroDeCredenciais() {
  return criarErro('CREDENCIAIS_INVALIDAS', 'E-mail ou senha inválidos.', 401);
}

async function cadastrar(payload) {
  const dados = validarCadastroPayload(payload);
  const usuarioExistente = await userRepository.buscarPorEmail(dados.email);

  if (usuarioExistente) {
    throw criarErro('EMAIL_EM_USO', 'Este e-mail já está cadastrado.', 409, 'email');
  }

  const senhaHash = await bcrypt.hash(dados.senha, 12);
  const usuario = await userRepository.inserir({
    nome: dados.nome,
    email: dados.email,
    senhaHash,
    perfilId: 1,
    departamentoId: null
  });

  await registrarAuditoria({
    usuarioId: usuario.id,
    acao: 'USUARIO_CRIADO',
    entidade: 'USUARIO',
    entidadeId: usuario.id,
    detalhes: { origem: 'cadastro' }
  });

  return usuarioPublico(usuario);
}

async function login(payload, informacoes = {}) {
  const dados = validarLoginPayload(payload);
  const usuario = await userRepository.buscarPorEmail(dados.email);
  const senhaHash = usuario?.senha_hash || HASH_SENHA_DUMMY;
  const senhaCorreta = await bcrypt.compare(dados.senha, senhaHash);
  const bloqueadoAte = usuario?.bloqueado_ate ? new Date(usuario.bloqueado_ate) : null;
  const contaBloqueada = Boolean(bloqueadoAte && bloqueadoAte > new Date());

  const perfilAtivo = Boolean(usuario?.perfilAtivo);

  if (!usuario || !senhaCorreta || !usuario.ativo || !perfilAtivo || contaBloqueada) {
    if (usuario && usuario.ativo && perfilAtivo && !contaBloqueada && !senhaCorreta) {
      await userRepository.registrarFalhaLogin(
        usuario.id,
        MAX_TENTATIVAS,
        MINUTOS_BLOQUEIO
      );
    }

    await registrarAuditoria({
      usuarioId: usuario?.id || null,
      acao: 'LOGIN_FALHOU',
      resultado: 'FALHA',
      detalhes: {
        motivo: 'credenciais_invalidas'
      },
      ...informacoes
    });

    // Usuário inexistente, senha incorreta, conta inativa e conta bloqueada têm a mesma resposta.
    throw erroDeCredenciais();
  }

  const jwtSecret = obterJwtSecret();

  await userRepository.limparFalhasLogin(usuario.id);

  const token = jwt.sign(
    { id: usuario.id, perfil: usuario.perfil },
    jwtSecret,
    { expiresIn: JWT_EXPIRES_IN }
  );

  await registrarAuditoria({
    usuarioId: usuario.id,
    acao: 'LOGIN_REALIZADO',
    detalhes: informacoes
  });

  return {
    token,
    usuario: usuarioPublico(usuario)
  };
}

module.exports = {
  cadastrar,
  login,
  usuarioPublico
};
