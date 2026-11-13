import '../../js/core/vlibras.js';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const params = new URLSearchParams(window.location.search);
const token = params.get('token');
const tokenInput = document.getElementById('token');
const formMessage = document.getElementById('formMessage');
const resetForm = document.getElementById('resetForm');
const resetButton = document.getElementById('resetButton');

if (!token) {
  formMessage.textContent = 'Token não informado.';
  formMessage.className = 'form-message error';
  resetForm.hidden = true;
} else {
  tokenInput.value = token;
}

resetForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const novaSenha = document.getElementById('novaSenha').value;
  const confirmar = document.getElementById('confirmarSenha').value;
  const msg = document.getElementById('formMessage');
  const btnText = resetButton.querySelector('.button-text');

  if (novaSenha !== confirmar) {
    msg.textContent = 'As senhas não conferem.';
    msg.className = 'form-message error';
    return;
  }

  resetButton.disabled = true;
  btnText.textContent = 'Processando...';

  try {
    const res = await fetch(`${API_URL}/auth/redefinir-senha`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, novaSenha }),
      credentials: 'include',
    });
    const data = await res.json();
    if (res.ok) {
      msg.textContent = data.mensagem || 'Senha redefinida com sucesso!';
      msg.className = 'form-message success';
      setTimeout(() => {
        window.location.href = './login.html';
      }, 2000);
    } else {
      msg.textContent = data.mensagem || 'Erro ao redefinir senha.';
      msg.className = 'form-message error';
      resetButton.disabled = false;
      btnText.textContent = 'REDEFINIR SENHA';
    }
  } catch (err) {
    msg.textContent = 'Erro de conexão.';
    msg.className = 'form-message error';
    resetButton.disabled = false;
    btnText.textContent = 'REDEFINIR SENHA';
  }
});
