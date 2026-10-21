const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userRepository = require('../repositories/userRepository');
const auditoriaRepository = require('../repositories/auditoriaRepository');
const { criarErro, validarLoginPayload, validarCadastroPayload } = require('../validators/authValidator');

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '2h';
const MAX_TENTATIVAS = 5;
const MINUTOS_BLOQUEIO = 15;

// Hash fixo usado somente para manter o custo de comparação quando o e-mail não existe.
const HASH_SENHA_DUMMY = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

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
