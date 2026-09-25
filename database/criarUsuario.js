const readline = require('readline');
const authService = require('../services/authService');
const { pool } = require('../config/database');

function perguntarSenha(mensagem) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    const leitor = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      leitor.question(`${mensagem}: `, (resposta) => {
        leitor.close();
        resolve(resposta);
      });
    });
  }

  return new Promise((resolve, reject) => {
    const entrada = process.stdin;
    const saida = process.stdout;
    let senha = '';

    saida.write(`${mensagem}: `);
    entrada.setRawMode(true);
    entrada.resume();
    entrada.setEncoding('utf8');

    function finalizar(erro = null) {
      entrada.setRawMode(false);
      entrada.pause();
      entrada.removeListener('data', receberTecla);
      saida.write('\n');

      if (erro) reject(erro);
      else resolve(senha);
    }

    function receberTecla(tecla) {
      if (tecla === '\u0003') {
        finalizar(new Error('Operação cancelada.'));
        return;
      }

      if (tecla === '\r' || tecla === '\n') {
        finalizar();
        return;
      }

      if (tecla === '\u007f' || tecla === '\b') {
        if (senha.length > 0) {
          senha = senha.slice(0, -1);
          saida.write('\b \b');
        }
        return;
      }

      if (tecla >= ' ' && tecla !== '\u007f') {
        senha += tecla;
        saida.write('*');
      }
    }

    entrada.on('data', receberTecla);
  });
}

function perguntar(leitor, mensagem) {
  return new Promise((resolve) => {
    leitor.question(`${mensagem}: `, resolve);
  });
}

async function executar() {
  const leitor = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    console.log('=== Cadastro de operador Babycare ===');
    console.log('A senha será usada somente para gerar o hash bcrypt e não será exibida.');
    console.log('');

    const nome = (await perguntar(leitor, 'Nome completo')).trim();
    const email = (await perguntar(leitor, 'E-mail')).trim();
    leitor.close();

    const senha = await perguntarSenha('Senha');
    const confirmacao = await perguntarSenha('Confirme a senha');

    if (senha !== confirmacao) {
      throw new Error('As senhas não coincidem.');
    }

    const usuario = await authService.cadastrar({
      nome,
      email,
      senha
    });

    console.log('');
    console.log('Usuário criado com sucesso.');
    console.log(`Nome: ${usuario.nome}`);
    console.log(`E-mail: ${usuario.email}`);
    console.log(`Perfil: ${usuario.perfil}`);
  } finally {
    await pool.end();
  }
}

executar().catch((erro) => {
  console.error(`Não foi possível criar o usuário: ${erro.message}`);
  process.exitCode = 1;
});
