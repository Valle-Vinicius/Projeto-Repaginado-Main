const bcrypt = require('bcryptjs');
const repository = require('../repositories/usuarioRepository');
const auditoria = require('../repositories/auditoriaRepository');

const PERFIS_GESTAO = ['GERENTE', 'ADMINISTRADOR'];
const PERFIS_VALIDOS = ['OPERADOR_ESTOQUE', 'GERENTE', 'ADMINISTRADOR'];

function erro(mensagem, codigo = 'DADOS_INVALIDOS', statusCode = 400) {
  const e = new Error(mensagem); e.codigo = codigo; e.statusCode = statusCode; return e;
}
function idValido(valor, campo) {
  const id = Number(valor); if (!Number.isInteger(id) || id <= 0) throw erro(`${campo} inválido.`); return id;
}
function nomeValido(valor) {
  const nome = String(valor || '').trim();
  if (nome.length < 3 || nome.length > 120) throw erro('O nome deve ter entre 3 e 120 caracteres.');
  return nome;
}
function emailValido(valor) {
  const email = String(valor || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) throw erro('Informe um e-mail válido.');
  return email;
}
function perfilValido(valor) {
  const perfil = String(valor || '').trim().toUpperCase();
  if (!PERFIS_VALIDOS.includes(perfil)) throw erro('Perfil de acesso inválido.');
  return perfil;
}
function senhaValida(valor, obrigatoria = true) {
  const senha = String(valor || '');
  if (!obrigatoria && !senha) return null;
  if (senha.length < 6 || senha.length > 72) throw erro('A senha deve ter entre 6 e 72 caracteres.');
  return senha;
}
function usuarioPodeGerenciar(solicitante, alvoPerfil, acao) {
  if (!PERFIS_GESTAO.includes(solicitante?.perfil)) throw erro('Somente gerente ou administrador pode gerenciar usuários.', 'PERMISSAO_NEGADA', 403);
  if (solicitante.perfil === 'GERENTE' && alvoPerfil !== 'OPERADOR_ESTOQUE') throw erro('Gerentes podem gerenciar somente operadores de estoque.', 'PERMISSAO_NEGADA', 403);
  if (acao === 'CRIAR' && solicitante.perfil !== 'ADMINISTRADOR' && alvoPerfil !== 'OPERADOR_ESTOQUE') throw erro('Somente administradores podem criar este perfil.', 'PERMISSAO_NEGADA', 403);
}

async function obterLista(filtros) {
  const itens = await repository.listar(filtros);
  return itens.map((item) => ({ ...item, id: Number(item.id), perfilId: Number(item.perfilId), departamentoId: item.departamentoId === null ? null : Number(item.departamentoId), ativo: Boolean(item.ativo) }));
}
async function obterOpcoes() { return repository.buscarOpcoes(); }

async function criar(dados, solicitante) {
  const nome = nomeValido(dados.nome);
  const email = emailValido(dados.email);
  const senha = senhaValida(dados.senha, true);
  const perfil = perfilValido(dados.perfil);
  usuarioPodeGerenciar(solicitante, perfil, 'CRIAR');
  const duplicado = await repository.buscarPorEmail(email);
  if (duplicado) throw erro('Já existe um usuário com este e-mail.', 'EMAIL_DUPLICADO', 409);
  const opcoes = await repository.buscarOpcoes();
  const perfilDb = opcoes.perfis.find((item) => item.nome === perfil);
  if (!perfilDb) throw erro('Perfil não encontrado no banco de dados.');
  const departamentoId = dados.departamentoId ? idValido(dados.departamentoId, 'Departamento') : null;
  const criado = await repository.criar({ nome, email, senhaHash: await bcrypt.hash(senha, 10), perfilId: perfilDb.id, departamentoId });
  await auditoria.registrar({ usuarioId: solicitante.id, acao: 'USUARIO_CRIADO', entidade: 'USUARIO', entidadeId: criado.id, detalhes: { email, perfil } });
  return criado;
}

async function atualizar(id, dados, solicitante) {
  const usuarioId = idValido(id, 'Usuário');
  const atual = await repository.buscarPorId(usuarioId);
  if (!atual) throw erro('Usuário não encontrado.', 'USUARIO_NAO_ENCONTRADO', 404);
  const perfilDestino = dados.perfil === undefined ? atual.perfil : perfilValido(dados.perfil);
  usuarioPodeGerenciar(solicitante, perfilDestino, 'EDITAR');
  if (usuarioId === Number(solicitante.id) && dados.ativo === false) throw erro('Você não pode inativar o próprio usuário.');
  const campos = {};
  if (dados.nome !== undefined) campos.nome = nomeValido(dados.nome);
  if (dados.email !== undefined) { campos.email = emailValido(dados.email); if (await repository.buscarPorEmail(campos.email, usuarioId)) throw erro('Já existe um usuário com este e-mail.', 'EMAIL_DUPLICADO', 409); }
  if (dados.perfil !== undefined) { const opcoes = await repository.buscarOpcoes(); campos.perfilId = opcoes.perfis.find((item) => item.nome === perfilDestino)?.id; if (!campos.perfilId) throw erro('Perfil não encontrado no banco de dados.'); }
  if (dados.departamentoId !== undefined) campos.departamentoId = dados.departamentoId ? idValido(dados.departamentoId, 'Departamento') : null;
  if (dados.senha !== undefined) campos.senhaHash = await bcrypt.hash(senhaValida(dados.senha, true), 10);
  if (dados.ativo !== undefined) campos.ativo = Boolean(dados.ativo);
  const atualizado = await repository.atualizar(usuarioId, campos);
  await auditoria.registrar({ usuarioId: solicitante.id, acao: 'USUARIO_ATUALIZADO', entidade: 'USUARIO', entidadeId: usuarioId, detalhes: { campos: Object.keys(campos) } });
  return atualizado;
}

async function inativar(id, solicitante) { return atualizar(id, { ativo: false }, solicitante); }

module.exports = { PERFIS_GESTAO, obterLista, obterOpcoes, criar, atualizar, inativar };
