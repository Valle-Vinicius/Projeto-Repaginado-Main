const CAMPOS_PERMITIDOS = new Set([
  'nome',
  'codigo',
  'descricao',
  'categoriaId',
  'estoqueMinimo',
  'unidade',
  'possuiValidade'
]);

const UNIDADES_PERMITIDAS = new Set(['UN', 'CX', 'PCT', 'KG', 'G', 'L', 'ML']);
const LIMITE_ESTOQUE = 1000000000;

function erroValidacao(mensagem, campos = {}) {
  const erro = new Error(mensagem);
  erro.statusCode = 400;
  erro.code = 'VALIDATION_ERROR';
  erro.fields = campos;
  return erro;
}

function exigirObjeto(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw erroValidacao('O corpo da requisição deve ser um objeto.');
  }
}

function validarCamposDesconhecidos(payload) {
  const desconhecidos = Object.keys(payload).filter((campo) => !CAMPOS_PERMITIDOS.has(campo));
  if (desconhecidos.length > 0) {
    throw erroValidacao('Existem campos não permitidos na requisição.', {
      campos: `Remova: ${desconhecidos.join(', ')}.`
    });
  }
}

function validarTextoObrigatorio(valor, campo, nomeExibicao, minimo, maximo) {
  if (typeof valor !== 'string') {
    throw erroValidacao('Existem campos com tipo inválido.', {
      [campo]: `${nomeExibicao} deve ser um texto.`
    });
  }

  const texto = valor.trim();
  if (texto.length < minimo || texto.length > maximo) {
    throw erroValidacao('Existem campos inválidos.', {
      [campo]: `${nomeExibicao} deve ter entre ${minimo} e ${maximo} caracteres.`
    });
  }

  return texto;
}

function validarCodigo(valor) {
  const codigo = validarTextoObrigatorio(valor, 'codigo', 'O SKU', 3, 50).toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]*$/u.test(codigo)) {
    throw erroValidacao('Existem campos inválidos.', {
      codigo: 'O SKU deve conter apenas letras, números, hífen ou sublinhado.'
    });
  }
  return codigo;
}

function validarInteiroNaoNegativo(valor, campo, nomeExibicao) {
  if (typeof valor === 'boolean' || (typeof valor !== 'number' && typeof valor !== 'string')) {
    throw erroValidacao('Existem campos com tipo inválido.', {
      [campo]: `${nomeExibicao} deve ser um número inteiro.`
    });
  }

  const texto = String(valor).trim();
  if (!/^\d+$/u.test(texto)) {
    throw erroValidacao('Existem campos inválidos.', {
      [campo]: `${nomeExibicao} deve ser um número inteiro maior ou igual a zero.`
    });
  }

  const numero = Number(texto);
  if (!Number.isSafeInteger(numero) || numero > LIMITE_ESTOQUE) {
    throw erroValidacao('Existem campos inválidos.', {
      [campo]: `${nomeExibicao} ultrapassa o limite permitido.`
    });
  }

  return numero;
}

function validarCategoriaId(valor) {
  if (typeof valor === 'boolean' || (typeof valor !== 'number' && typeof valor !== 'string')) {
    throw erroValidacao('Existem campos com tipo inválido.', {
      categoriaId: 'A categoria deve ser um identificador numérico.'
    });
  }

  const texto = String(valor).trim();
  const numero = Number(texto);
  if (!/^\d+$/u.test(texto) || numero < 1 || !Number.isSafeInteger(numero)) {
    throw erroValidacao('Existem campos inválidos.', {
      categoriaId: 'Selecione uma categoria válida.'
    });
  }

  return numero;
}

function validarUnidade(valor) {
  if (typeof valor !== 'string') {
    throw erroValidacao('Existem campos com tipo inválido.', {
      unidade: 'A unidade deve ser um texto.'
    });
  }

  const unidade = valor.trim().toUpperCase();
  if (!UNIDADES_PERMITIDAS.has(unidade)) {
    throw erroValidacao('Existem campos inválidos.', {
      unidade: `Unidade inválida. Use: ${[...UNIDADES_PERMITIDAS].join(', ')}.`
    });
  }

  return unidade;
}

function validarBooleano(valor, campo, nomeExibicao) {
  if (typeof valor !== 'boolean') {
    throw erroValidacao('Existem campos com tipo inválido.', {
      [campo]: `${nomeExibicao} deve ser verdadeiro ou falso.`
    });
  }
  return valor;
}

function validarProdutoPayload(payload) {
  exigirObjeto(payload);
  validarCamposDesconhecidos(payload);

  const resultado = {
    nome: validarTextoObrigatorio(payload.nome, 'nome', 'O nome do produto', 3, 150),
    codigo: validarCodigo(payload.codigo),
    categoriaId: validarCategoriaId(payload.categoriaId),
    estoqueMinimo: validarInteiroNaoNegativo(payload.estoqueMinimo, 'estoqueMinimo', 'O estoque mínimo'),
    unidade: validarUnidade(payload.unidade),
    possuiValidade: validarBooleano(payload.possuiValidade, 'possuiValidade', 'Possui validade')
  };

  if (payload.descricao == null || payload.descricao === '') {
    resultado.descricao = null;
  } else {
    resultado.descricao = validarTextoObrigatorio(payload.descricao, 'descricao', 'A descrição', 1, 2000);
  }

  return resultado;
}

module.exports = {
  CAMPOS_PERMITIDOS,
  UNIDADES_PERMITIDAS,
  validarProdutoPayload,
  erroValidacao
};
