const UI_API_URL = window.location.origin;

function esconderCarregamento() {
  const loader = document.querySelector('#pageLoader');
  if (!loader) return;

  window.requestAnimationFrame(() => {
    loader.classList.add('is-hidden');
    document.body.classList.add('page-ready');
  });
}

function mostrarCarregamento(texto = 'Carregando...') {
  const loader = document.querySelector('#pageLoader');
  if (!loader) return;

  const label = loader.querySelector('.page-loader-label');
  if (label) label.textContent = texto;
  loader.classList.remove('is-hidden');
}

function transicionarPara(url, duracao = 560) {
  document.body.classList.add('page-leaving');
  window.setTimeout(() => {
    window.location.href = url;
  }, duracao);
}

function mostrarToast(texto, tipo = '') {
  let toast = document.querySelector('#uiToast');

  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'uiToast';
    toast.className = 'ui-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);
  }

  toast.textContent = texto;
  toast.className = `ui-toast ${tipo}`.trim();
  window.clearTimeout(mostrarToast.timer);
  window.requestAnimationFrame(() => toast.classList.add('show'));

  mostrarToast.timer = window.setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

function aplicarMascara(valor, mascara) {
  const numeros = String(valor || '').replace(/\D/g, '');
  let indice = 0;

  return mascara.replace(/#/g, () => numeros[indice++] || '');
}

function formatarCPF(valor) {
  return aplicarMascara(valor, '###.###.###-##');
}

function formatarCNPJ(valor) {
  return aplicarMascara(valor, '##.###.###/####-##');
}

function formatarTelefone(valor) {
  const numeros = String(valor || '').replace(/\D/g, '').slice(0, 11);
  if (numeros.length <= 10) return aplicarMascara(numeros, '(##) ####-####');
  return aplicarMascara(numeros, '(##) #####-####');
}

function formatarCEP(valor) {
  return aplicarMascara(valor, '#####-###');
}

function formatarMoeda(valor) {
  const numeros = String(valor || '').replace(/\D/g, '');
  const centavos = Number(numeros || 0) / 100;

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(centavos);
}

function formatarNumero(valor, casas = 0) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas
  }).format(Number(valor || 0));
}

function formatarData(valor) {
  if (!valor) return '';
  const data = String(valor).includes('T') ? new Date(valor) : new Date(`${valor}T00:00:00`);
  if (Number.isNaN(data.getTime())) return '';
  return data.toLocaleDateString('pt-BR');
}

function formatarDataHora(valor) {
  if (!valor) return '';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '';
  return data.toLocaleString('pt-BR');
}

function limitarDataMinima(input) {
  if (!input || input.type !== 'date') return;
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');
  input.min = `${ano}-${mes}-${dia}`;
}

function validarEmailFrontend(valor) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(valor || '').trim());
}

function configurarFormatacaoCampos(root = document) {
  root.querySelectorAll('[data-mask="cpf"]').forEach((input) => {
    input.addEventListener('input', () => {
      input.value = formatarCPF(input.value);
    });
  });

  root.querySelectorAll('[data-mask="cnpj"]').forEach((input) => {
    input.addEventListener('input', () => {
      input.value = formatarCNPJ(input.value);
    });
  });

  root.querySelectorAll('[data-mask="telefone"]').forEach((input) => {
    input.addEventListener('input', () => {
      input.value = formatarTelefone(input.value);
    });
  });

  root.querySelectorAll('[data-mask="cep"]').forEach((input) => {
    input.addEventListener('input', () => {
      input.value = formatarCEP(input.value);
    });
  });

  root.querySelectorAll('[data-format="moeda"]').forEach((input) => {
    input.addEventListener('input', () => {
      input.value = formatarMoeda(input.value);
    });
  });

  root.querySelectorAll('[data-format="numero"]').forEach((input) => {
    input.addEventListener('blur', () => {
      if (input.value !== '') input.value = formatarNumero(input.value);
    });
  });

  root.querySelectorAll('input[type="date"][data-date-min="today"]').forEach(limitarDataMinima);
}

window.BabycareUI = {
  API_URL: UI_API_URL,
  esconderCarregamento,
  mostrarCarregamento,
  transicionarPara,
  mostrarToast,
  aplicarMascara,
  formatarCPF,
  formatarCNPJ,
  formatarTelefone,
  formatarCEP,
  formatarMoeda,
  formatarNumero,
  formatarData,
  formatarDataHora,
  validarEmailFrontend,
  configurarFormatacaoCampos
};

window.addEventListener('load', () => {
  esconderCarregamento();
  configurarFormatacaoCampos();
});
