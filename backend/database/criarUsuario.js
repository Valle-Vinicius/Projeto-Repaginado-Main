const readline = require("readline");
const bcrypt = require("bcryptjs");
const { pool } = require("../config/database");

function perguntar(leitor, mensagem) {
  return new Promise((resolve) =>
    leitor.question(`${mensagem}: `, (resposta) => resolve(resposta.trim())),
  );
}

async function perguntarSenha(leitor, mensagem) {
  return perguntar(leitor, mensagem);
}

async function buscarOpcoes() {
  const [perfis] = await pool.execute(
    "SELECT id, nome FROM perfis WHERE ativo = TRUE ORDER BY id ASC",
  );
  const [departamentos] = await pool.execute(
    "SELECT id, nome FROM departamentos WHERE ativo = TRUE ORDER BY nome ASC",
  );
  return { perfis, departamentos };
}

function mostrarOpcoes(titulo, itens) {
  console.log(`\n${titulo}:`);
  itens.forEach((item, indice) => {
    console.log(`${indice + 1}. ${item.nome}`);
  });
}

async function escolherOpcao(leitor, titulo, itens, obrigatoria = true) {
  if (!itens.length && obrigatoria)
    throw new Error(`Nenhuma opção cadastrada para ${titulo.toLowerCase()}.`);
  if (!itens.length) return null;

  mostrarOpcoes(titulo, itens);
  const resposta = await perguntar(leitor, "Escolha o número");
  const indice = Number(resposta) - 1;
  if (!Number.isInteger(indice) || !itens[indice]) {
    throw new Error(`Escolha inválida para ${titulo.toLowerCase()}.`);
  }
  return itens[indice];
}

async function executar() {
  const leitor = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log("=== Cadastro de usuário Babycare ===");
    console.log("A senha será armazenada somente como hash bcrypt.");

    const { perfis, departamentos } = await buscarOpcoes();
    const perfil = await escolherOpcao(leitor, "Cargo/perfil", perfis);
    const departamento = await escolherOpcao(
      leitor,
      "Departamento",
      departamentos,
      false,
    );

    const nome = await perguntar(leitor, "Nome completo");
    const email = (await perguntar(leitor, "E-mail")).toLowerCase();
    const senha = await perguntarSenha(leitor, "Senha");
    const confirmacao = await perguntarSenha(leitor, "Confirme a senha");

    if (nome.length < 3)
      throw new Error("O nome deve ter pelo menos 3 caracteres.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new Error("Informe um e-mail válido.");
    if (senha.length < 6)
      throw new Error("A senha deve ter pelo menos 6 caracteres.");
    if (senha !== confirmacao) throw new Error("As senhas não coincidem.");

    const [existentes] = await pool.execute(
      "SELECT id FROM usuarios WHERE LOWER(email) = LOWER(?) LIMIT 1",
      [email],
    );
    if (existentes.length)
      throw new Error("Já existe um usuário com este e-mail.");

    const senhaHash = await bcrypt.hash(senha, 10);
    const [resultado] = await pool.execute(
      `
      INSERT INTO usuarios
        (nome, email, senha_hash, perfil_id, departamento_id, ativo)
      VALUES (?, ?, ?, ?, ?, TRUE)
    `,
      [nome, email, senhaHash, perfil.id, departamento?.id || null],
    );

    await pool.execute(
      `
      INSERT INTO auditorias
        (usuario_id, acao, entidade, entidade_id, resultado, detalhes)
      VALUES (NULL, 'USUARIO_CRIADO_CLI', 'USUARIO', ?, 'SUCESSO', ?)
    `,
      [
        resultado.insertId,
        JSON.stringify({
          email,
          perfil: perfil.nome,
          departamento: departamento?.nome || null,
        }),
      ],
    );

    console.log("\nUsuário criado com sucesso.");
    console.log(`Nome: ${nome}`);
    console.log(`E-mail: ${email}`);
    console.log(`Cargo: ${perfil.nome}`);
    console.log(`Departamento: ${departamento?.nome || "Sem departamento"}`);
  } finally {
    leitor.close();
    await pool.end();
  }
}

executar().catch((erro) => {
  console.error(`Não foi possível criar o usuário: ${erro.message}`);
  process.exitCode = 1;
});
