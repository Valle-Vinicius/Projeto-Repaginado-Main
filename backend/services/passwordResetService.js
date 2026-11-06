const crypto = require('crypto');
const { executarQuery } = require('../config/database');
const bcrypt = require('bcryptjs');
const usuarioRepository = require('../repositories/usuarioRepository');

async function solicitarReset(email) {
  const usuarios = await executarQuery(
    'SELECT id, nome, email FROM usuarios WHERE email = ? AND ativo = TRUE',
    [email]
  );

  // Sempre retorna sucesso para não revelar se o email existe
  if (!usuarios.length) {
    return { sucesso: true, mensagem: 'Se o e-mail estiver cadastrado, você receberá instruções.' };
  }

  const usuario = usuarios[0];
  const token = crypto.randomBytes(32).toString('hex');
  const expiraEm = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

  // Invalida tokens anteriores
  await executarQuery(
    'UPDATE password_reset_tokens SET usado = TRUE WHERE usuario_id = ? AND usado = FALSE',
    [usuario.id]
  );

  await executarQuery(
    'INSERT INTO password_reset_tokens (usuario_id, token, expira_em) VALUES (?, ?, ?)',
    [usuario.id, token, expiraEm]
  );

  // Em produção, enviar por email. Em dev, loga apenas que foi gerado (sem expor o token).
  console.log(`[PasswordReset] Token de recuperação gerado para ${usuario.email} (expira em 1h)`);

  return { sucesso: true, mensagem: 'Se o e-mail estiver cadastrado, você receberá instruções.' };
}

async function redefinirSenha(token, novaSenha) {
  if (!token || typeof token !== 'string' || token.length < 32) {
    const erro = new Error('Token inválido.');
    erro.statusCode = 400;
    erro.codigo = 'TOKEN_INVALIDO';
    throw erro;
  }

  if (
    !novaSenha ||
    typeof novaSenha !== 'string' ||
    novaSenha.length < 6 ||
    novaSenha.length > 72
  ) {
    const erro = new Error('A senha deve ter entre 6 e 72 caracteres.');
    erro.statusCode = 400;
    erro.codigo = 'SENHA_INVALIDA';
    throw erro;
  }

  const tokens = await executarQuery(
    'SELECT * FROM password_reset_tokens WHERE token = ? AND usado = FALSE AND expira_em > CURRENT_TIMESTAMP',
    [token]
  );

  if (!tokens.length) {
    const erro = new Error('Token inválido ou expirado.');
    erro.statusCode = 400;
    erro.codigo = 'TOKEN_INVALIDO_OU_EXPIRADO';
    throw erro;
  }

  const resetToken = tokens[0];
  const senhaHash = await bcrypt.hash(novaSenha, 10);

  await executarQuery('UPDATE usuarios SET senha_hash = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?', [
    senhaHash,
    resetToken.usuario_id,
  ]);

  await executarQuery('UPDATE password_reset_tokens SET usado = TRUE WHERE id = ?', [
    resetToken.id,
  ]);

  return { sucesso: true, mensagem: 'Senha redefinida com sucesso.' };
}

module.exports = { solicitarReset, redefinirSenha };
