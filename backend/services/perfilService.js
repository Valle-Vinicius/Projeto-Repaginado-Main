const bcrypt = require("bcryptjs");
const usuarioRepository = require("../repositories/usuarioRepository");
const auditoriaRepository = require("../repositories/auditoriaRepository");

function erro(mensagem, codigo = "DADOS_INVALIDOS", statusCode = 400) {
  const e = new Error(mensagem);
  e.codigo = codigo;
  e.statusCode = statusCode;
  return e;
}
function emailValido(valor) {
  const email = String(valor || "")
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw erro("Informe um e-mail válido.");
  return email;
}
function senhaValida(valor) {
  const senha = String(valor || "");
  if (senha.length < 6 || senha.length > 72)
    throw erro("A senha deve ter entre 6 e 72 caracteres.");
  return senha;
}

async function obter(id) {
  const usuario = await usuarioRepository.buscarPorId(Number(id));
  if (!usuario)
    throw erro("Usuário não encontrado.", "USUARIO_NAO_ENCONTRADO", 404);
  return usuario;
}

async function atualizar(id, dados) {
  const usuarioId = Number(id);
  if (!Number.isInteger(usuarioId) || usuarioId <= 0)
    throw erro("Usuário inválido.");
  const atual = await obter(usuarioId);
  const campos = {};
  if (dados.nome !== undefined) {
    const nome = String(dados.nome).trim();
    if (nome.length < 3 || nome.length > 120)
      throw erro("O nome deve ter entre 3 e 120 caracteres.");
    campos.nome = nome;
  }
  if (dados.email !== undefined) {
    campos.email = emailValido(dados.email);
    const duplicado = await usuarioRepository.buscarPorEmail(
      campos.email,
      usuarioId,
    );
    if (duplicado)
      throw erro(
        "Já existe um usuário com este e-mail.",
        "EMAIL_DUPLICADO",
        409,
      );
  }
  if (dados.novaSenha !== undefined && dados.novaSenha !== "") {
    if (!dados.senhaAtual)
      throw erro("Informe sua senha atual para definir uma nova senha.");
    const senhaOk = await bcrypt.compare(
      String(dados.senhaAtual),
      atual.senhaHash || "",
    );
    if (!senhaOk)
      throw erro("A senha atual está incorreta.", "SENHA_ATUAL_INVALIDA", 400);
    if (dados.novaSenha !== dados.confirmarSenha)
      throw erro("A confirmação da nova senha não confere.");
    campos.senhaHash = await bcrypt.hash(senhaValida(dados.novaSenha), 10);
  }
  if (!Object.keys(campos).length) return atual;
  const atualizado = await usuarioRepository.atualizar(usuarioId, campos);
  await auditoriaRepository.registrar({
    usuarioId,
    acao: "PERFIL_ATUALIZADO",
    entidade: "USUARIO",
    entidadeId: usuarioId,
    detalhes: { campos: Object.keys(campos) },
  });
  return atualizado;
}
module.exports = { obter, atualizar };
