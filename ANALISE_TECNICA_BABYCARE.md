# Análise técnica do BabyCare

## Escopo e método

Esta análise descreve o código-fonte atual, não apenas o que a documentação promete. O sistema tem páginas HTML/CSS/JavaScript sem framework de UI, uma API Node.js/Express e **PostgreSQL no runtime atual**, hospedado no Railway conforme informado pela equipe. O arquivo `backend/database.sql` é um esquema MySQL histórico/demonstrativo; o servidor lê `backend/database.postgres.sql`. A análise não acessou o serviço hospedado diretamente.

O arquivo legado `EXPLICACAO_DO_PROJETO.txt` ainda descreve MySQL e chama a regra de baixa de FIFO; essas afirmações não correspondem ao runtime. Use esta análise atualizada como referência para a apresentação.

Os testes unitários sem banco foram executados: 3 suítes e 8 casos passaram. A suíte de integração não foi executada porque `npm run test:setup` apaga e recria o banco local `babycare_test`; não execute esse setup em ambiente com dados que precisem ser preservados. A integração ainda precisa ser validada em um banco local descartável.

## 1. Arquitetura encontrada

### Organização

- `backend/server.js`: inicializa Express, middlewares, rotas, schema e servidor HTTP.
- `backend/config/`: ambiente, pool PostgreSQL, transações e adaptação de placeholders.
- `backend/routes/`: caminhos HTTP e encadeamento de autenticação/autorização.
- `backend/controllers/`: adapta `req`/`res`, escolhe status HTTP e serializa respostas.
- `backend/services/`: validações de negócio, composição e normalização dos dados.
- `backend/repositories/`: SQL e acesso persistente.
- `backend/validators/`: validação dos payloads de login, produtos, recebimento e expedição.
- `frontend/src/pages/`: páginas MPA; cada página normalmente tem `index.html` e módulo JS.
- `frontend/src/js/core/`: API base, sessão visual, navegação, tabelas responsivas e utilitários.
- `frontend/src/css/`: estilos globais e específicos de página.
- `tests/`: testes Jest de integração contra o servidor e PostgreSQL.

Há separação efetiva entre Routes, Controllers, Services e Repositories. Os validadores são uma camada adicional. Não é uma API genérica de CRUD: cada recurso tem seus endpoints concretos.

### Servidor e comunicação

O `server.js` configura Express, CORS com lista de origens, `cookie-parser`, parser JSON com limite de 10 KB, cabeçalhos, rate limits, endpoints da API e, em produção, o frontend compilado em `frontend/dist`. A inicialização executa `inicializarBanco()` antes de abrir a porta e pode criar um administrador bootstrap se as variáveis próprias estiverem definidas.

No desenvolvimento, Vite serve as páginas MPA em `localhost:5173` e faz proxy de `/api` para `localhost:3000` (configurado em `vite.config.js`). Em produção, o Express serve os arquivos e páginas compilados. O cliente define `API_URL` como `VITE_API_URL` ou `/api`.

**Fluxo HTTP típico**:

1. Um módulo da página reage a evento de formulário/clique e chama `fetch`.
2. A requisição usa `credentials: 'include'`; no dev passa pelo proxy Vite.
3. Express processa parser/limiter, encontra a rota e executa `verificarToken` e, quando aplicável, `permitirPerfis`.
4. Controller encaminha os dados ao Service; o Service valida/rege o caso e chama o Repository.
5. Repository executa SQL parametrizado no PostgreSQL; em operações de estoque usa transação.
6. Controller responde JSON; frontend exibe mensagem/atualiza a tabela ou os indicadores.

Uma resposta comum de erro contém `sucesso: false`, `codigo` e `mensagem`. O código diferencia erros de payload, autenticação, autorização, produto inexistente e saldo insuficiente, por exemplo.

## 2. Frontend

### HTML, JavaScript e CSS

As páginas são HTML sem renderizador de componentes. Os formulários/tabelas declaram elementos e IDs; os módulos JS localizam elementos por `querySelector`, registram eventos, constroem opções/linhas, atualizam texto e classes do DOM e mostram modais/toasts.

Arquivos representativos:

- Login: `frontend/src/pages/login/index.html`, `login.js`, `frontend/src/css/login.css`.
- Dashboard: `frontend/src/pages/dashboard/index.html`, `dashboard.js`, `frontend/src/css/dashboard.css`.
- Produtos: `frontend/src/pages/produtos/index.html`, `produtos.js`, `frontend/src/css/produtos.css`; formulário em `formulario-produto/`.
- Estoque, recebimentos e expedições: respectivos `index.html`/JS e `estoque.css`, `recebimentos.css`, `expedicoes.css`.
- Relatórios, validade, auditoria, usuários e configurações: páginas e módulos homônimos.
- Compartilhados: `frontend/src/js/core/index.js`, `ui.js`, `sidebar.js`, `responsive-tables.js`, `frontend/src/css/app.css` e `responsive-tables.css`.

`index.html` inclui `<meta name="viewport">`; a navegação lateral possui controle móvel e há media queries (por exemplo, tabelas viram cartões em larguras menores). A implementação é responsiva por CSS, não por framework. Há suporte a `prefers-reduced-motion` em estilos comuns. Para a apresentação, mostrem a página-fonte em `frontend/src/pages/`, não apenas o artefato gerado em `frontend/dist/`.

### Requisições, sessão e eventos

`login.js` valida e-mail/senha no navegador, envia `POST /api/auth/login` com `credentials: 'include'`, e guarda **apenas os dados públicos do usuário** em `localStorage` ou `sessionStorage` conforme “Lembrar de mim”. Os módulos de outras páginas chamam `fetch` com credenciais incluídas. Não há armazenamento do JWT no Web Storage no fluxo atual.

`core/index.js` contém leitura dos dados visuais do usuário, escape de texto, helper `requisitar`, filtros persistidos, atalhos, breadcrumb e configuração responsiva. Páginas como recebimentos/expedições implementam helpers locais parecidos e ligam eventos de `submit`, `change`, busca, filtros de período, fechar modal e Escape.

O servidor devolve o perfil/nome para o frontend, mas a interface não é fronteira de segurança: a autorização real ocorre nas rotas do backend.

## 3. Backend, rotas e validação

### Endpoints principais

| Caminho | Operações | Proteção principal |
|---|---|---|
| `/api/health` | `GET` | Verifica conectividade do banco |
| `/api/auth/login`, `/logout` | `POST` | Login com limitador; logout limpa cookie |
| `/api/auth/esqueci-senha`, `/redefinir-senha` | `POST` | Rotas públicas de recuperação |
| `/api/dashboard` | `GET` | Token e operador/gerente/admin |
| `/api/produtos`, `/categorias`, `/:id`, `/:id/desativar` | `GET`, `POST`, `PATCH` | Token e perfis de estoque |
| `/api/estoque` | `GET`; `/movimentacoes` `POST`; `/ajuste` `POST` | Token e perfis de estoque; ajuste restrito a gerente/administrador |
| `/api/recebimentos`, `/api/expedicoes` | `GET`, `POST` | Token e perfis de estoque |
| `/api/validade`, `/api/relatorios`, `/api/auditorias` | `GET` | Token e perfis autorizados |
| `/api/usuarios`, `/opcoes`, `/:id` | `GET`, `POST`, `PATCH`, `DELETE` | Gestão por gerente/admin; exclusão lógica só admin |
| `/api/perfil` | `GET`, `PATCH` | Token |

As rotas detalhadas ficam em `backend/routes/`. A recuperação de senha está montada em `/api/auth` junto das rotas de autenticação.

### Exemplo de camadas

No recebimento: `recebimentoRoutes.js` aplica autenticação/perfil e chama o controller de estoque; `estoqueController.js` recebe `req.body`; `estoqueService.js` normaliza `tipo`, executa `recebimentoValidator.validarEntrada`; `estoqueRepository.js` abre transação, exige validade para produto controlado, rejeita datas passadas e impede reentrada no mesmo lote com validade diferente, além de criar movimento e auditoria.

No cadastro de produto: rota → `produtoController` → `produtoService` (valida payload, confirma categoria ativa) → `produtoRepository` (insert/consulta SQL). Produto começa sem lote/saldo; entrada de mercadoria é operação separada.

Validadores verificam tipos, campos, texto obrigatório/opcional, limites, IDs, quantidade positiva e data válida `AAAA-MM-DD`. O schema também possui `CHECK`, `UNIQUE` e FKs. Erros são convertidos em respostas HTTP pelos controllers; detalhes internos não são enviados como resposta em vários fluxos.

### PostgreSQL e prepared statements

O backend depende de `pg`, não `mysql2`. `config/database.js` usa pool PostgreSQL (máximo 10 conexões) e queries parametrizadas. Repositories escrevem `?`; `config/sql.js` converte placeholders não citados para `$1`, `$2`, etc. Os valores seguem separados do SQL, por exemplo:

```js
await executarQuery(
  'SELECT id FROM lotes WHERE produto_id = ? AND numero_lote = ? FOR UPDATE',
  [produtoId, numeroLote]
);
```

Isso protege valores de dados contra injeção SQL. Trechos dinâmicos de nomes/condições são construídos a partir de listas/campos permitidos ou filtros controlados; não se deve confundir parametrização de valores com interpolação arbitrária de SQL.

`executarTransacao` faz `BEGIN`, callback, `COMMIT`; em erro tenta `ROLLBACK` e relança o erro. O schema de runtime é lido de `backend/database.postgres.sql`.

## 4. Banco de dados: o que o código realmente usa

### O arquivo solicitado: `backend/database.sql` (MySQL histórico)

Esse arquivo declara o banco `babycare`, compatibilidade MySQL 8+, dados iniciais e demonstração. As tabelas são:

1. **`perfis`** — `id INT AUTO_INCREMENT` PK; `nome VARCHAR(50)` NOT NULL/UNIQUE; `ativo BOOLEAN` NOT NULL default TRUE; CHECK para nome com ao menos 3 caracteres.
2. **`departamentos`** — `id INT AUTO_INCREMENT` PK; `nome VARCHAR(80)` NOT NULL/UNIQUE; `ativo BOOLEAN`; CHECK de nome.
3. **`usuarios`** — `id INT AUTO_INCREMENT` PK; `nome VARCHAR(120)`, `email VARCHAR(255)` UNIQUE, `senha_hash VARCHAR(255)`, `perfil_id INT` NOT NULL FK para `perfis`, `departamento_id INT` FK nullable para `departamentos`, `ativo BOOLEAN`, `tentativas_login INT`, `bloqueado_ate DATETIME`, `ultimo_login_em DATETIME`, `criado_em`/`atualizado_em DATETIME`; CHECKs de nome/e-mail, hash iniciado por `$2` e tentativas não negativas.
4. **`auditorias`** — `id INT AUTO_INCREMENT` PK; `usuario_id INT` nullable FK com `ON DELETE SET NULL`; `acao VARCHAR(80)` NOT NULL; `entidade VARCHAR(80)`, `entidade_id INT`, `resultado VARCHAR(30)` com CHECK `SUCESSO/FALHA`, `detalhes JSON`, `criado_em DATETIME`; índices em usuário e data.
5. **`categorias`** — `id INT AUTO_INCREMENT` PK; `nome VARCHAR(100)` UNIQUE; `ativo BOOLEAN`; `criado_em DATETIME`; CHECK de nome.
6. **`localizacoes`** — `id INT AUTO_INCREMENT` PK; `nome VARCHAR(100)` UNIQUE; `descricao VARCHAR(255)`, `ativo BOOLEAN`, `criado_em DATETIME`; CHECK de nome.
7. **`produtos`** — `id INT AUTO_INCREMENT` PK; `codigo VARCHAR(50)` UNIQUE; `nome VARCHAR(150)`, `descricao TEXT`, `categoria_id INT` FK para categoria, `estoque_minimo DECIMAL(12,3)`, `unidade ENUM('UN','CX','PCT','KG','G','L','ML')`, `possui_validade BOOLEAN`, `ativo BOOLEAN`, timestamps; CHECKs de código/nome/unidade e mínimo não negativo.
8. **`lotes`** — `id INT AUTO_INCREMENT` PK; `produto_id INT` FK; `numero_lote VARCHAR(80)`, `fornecedor VARCHAR(150)`, `documento VARCHAR(80)`, `quantidade_atual DECIMAL(12,3)`, `data_validade DATE`, `localizacao_id INT` nullable FK com `ON DELETE SET NULL`, `ativo BOOLEAN`, timestamps; UNIQUE `(produto_id, numero_lote)` e CHECK de quantidade não negativa.
9. **`movimentacoes`** — `id INT AUTO_INCREMENT` PK; `produto_id INT` FK, `lote_id INT` nullable FK com `ON DELETE SET NULL`, `usuario_id INT` nullable FK com `ON DELETE SET NULL`, `destinatario VARCHAR(150)`, `destino VARCHAR(150)`, `documento VARCHAR(80)`, `tipo ENUM('ENTRADA','SAIDA','AJUSTE')`, `quantidade DECIMAL(12,3)`, `status ENUM('CONFIRMADA','CANCELADA')`, `observacao VARCHAR(255)`, `criado_em DATETIME`; CHECK exige quantidade positiva.

Índices explícitos adicionais: produtos ativo/categoria, lotes validade/produto, movimentações data-tipo-status/produto, usuários bloqueio e auditorias usuário/data. PKs e `UNIQUE` também criam índices conforme o banco.

Relacionamentos: perfil e departamento classificam usuário; categoria classifica produto; cada lote pertence a um produto e pode apontar para localização; movimento refere produto, lote e usuário; auditoria pode apontar para usuário. Não existe tabela relacional `fornecedores`: fornecedor é texto guardado no lote. Estoque atual é a soma de `quantidade_atual` dos lotes ativos, não um campo de saldo em `produtos`.

### Schema que inicializa o servidor: PostgreSQL

`backend/database.postgres.sql` cria as mesmas entidades centrais com tipos e sintaxe PostgreSQL (`SERIAL`, `JSONB`, `TIMESTAMP`, `CHECK`, `ON CONFLICT`) e adiciona **`password_reset_tokens`**. Também tem `quantidade_inicial` em `lotes`, ausente do MySQL, e permite quantidade negativa somente quando `tipo = 'AJUSTE'` nas movimentações. Há triggers para `atualizado_em` em usuários/produtos/lotes e seeds demonstrativos.

**Divergência crítica para a apresentação:** o `database.sql` pedido não é o schema aplicado em produção/testes. Além de diferenças de dialeto, o MySQL exige `quantidade > 0`, enquanto ajustes de redução gravam movimento negativo; e o backend registra `quantidade_inicial` no ajuste, coluna que não está no MySQL. Não apresentem MySQL como banco em uso pelo servidor atual.

## 5. Autenticação, autorização e segurança

- **Senha:** `authService.js` compara com `bcrypt.compare`; cadastro/alteração grava hash via bcrypt. O servidor pode criar bootstrap com cost 12; serviços comuns usam cost 10.
- **JWT:** assinado com `JWT_SECRET`, claims `id` e `perfil`, expiração padrão `2h` (configurável em parte do código), validado com algoritmo HS256.
- **Transporte atual:** `authController.login` define `babycareToken` em cookie `httpOnly`, `SameSite=Strict`, `Secure` em produção, caminho `/`, expiração definida pelo controller. O token não vai no JSON de sucesso. O middleware lê primeiro esse cookie e aceita também `Authorization: Bearer`.
- **RBAC:** `permitirPerfis(...)` compara o perfil do token com os perfis permitidos na rota. Perfis centrais: operador de estoque, gerente e administrador. Ex.: gestão de usuários é gerente/admin; inativar usuário só admin.
- **Bloqueio:** cinco falhas de senha podem bloquear a conta por 15 minutos. Há também rate limiting de login de cinco requisições/15 minutos por IP e limite geral de API de 100/15 min. As duas defesas têm escopos distintos.
- **Enumeração de contas:** login usa mensagem uniforme para usuário inexistente, senha errada, conta inativa ou bloqueada e executa comparação com hash dummy se não encontra usuário.
- **SQL injection:** uso de placeholders PostgreSQL e valores separados; ver seção anterior.
- **Auditoria:** login, recebimento, expedição, ajuste e gestão de usuários registram eventos em `auditorias`. Auditoria de estoque é chamada na mesma transação da alteração; falha pode cancelar a transação. No login, a falha ao auditar é logada e não muda a resposta de autenticação. Auditoria é histórico consultável, mas não há garantia de imutabilidade criptográfica.
- **Cabeçalhos/CORS:** servidor define alguns headers, restringe origens CORS e limita tamanho do JSON. Não há biblioteca Helmet. Cookie SameSite ajuda contra envio cross-site, mas não foi encontrado mecanismo explícito de token CSRF.

**Limitações importantes:** autorização confia no perfil assinado no JWT e não recarrega usuário/perfil do banco em cada requisição; uma conta/perfil desativado depois do login pode manter o acesso até expiração. O tempo de expiração do cookie é fixado em duas horas e pode divergir de `JWT_EXPIRES_IN`. Logout apaga o cookie no navegador, mas não existe revogação/lista de JWT no servidor.

**Recuperação de senha:** `passwordResetService.js` gera token aleatório e grava validade de uma hora; tokens anteriores são marcados usados. Porém, não há envio real de e-mail implementado: o código apenas informa que o envio ocorreria em produção e faz log sem revelar o token. Assim, a recuperação ponta a ponta não está operacional para um usuário comum. A alteração de senha e consumo do token também são queries separadas, não uma transação.

## 6. Estoque: cadastro, recebimento, fornecedores e movimentação

- Produto tem SKU/código único, nome, categoria, unidade, estoque mínimo e indicador `possui_validade`; seu saldo inicial é zero.
- Recebimento exige produto, quantidade positiva e aceita número de lote, fornecedor, nota/documento, validade, localização e observação. Se o número do lote já existe para o produto, a entrada soma no lote; se não, cria lote. Sempre grava movimento `ENTRADA` e auditoria.
- Fornecedor não tem cadastro separado: é um campo de texto guardado em `lotes`.
- A expedição pede produto, quantidade, destinatário e destino; documento/motivo/observação podem ser enviados. A saída é dividida em uma ou mais linhas de movimentação, uma por lote consumido.
- Ajuste compara saldo atual ao saldo informado e exige justificativa. Uma diferença positiva exige número de lote; para produto com validade controlada, também exige data futura ou atual. Se o lote já existe, a validade precisa coincidir; o aumento soma no mesmo lote sem substituir a validade. Diferença negativa retira unidades dos lotes ordenados por FEFO e registra movimentos `AJUSTE` negativos. A rota é restrita a gerente/administrador e não possui chamador na interface atual.
- A desativação lógica do produto é transacional e bloqueia a operação se ainda houver quantidade positiva em lote ativo, inclusive vencido.
- Estoque disponível é `SUM(lotes.quantidade_atual)` de lotes ativos. Estado calculado no service: zero → `SEM_ESTOQUE`; saldo positivo até o mínimo → `BAIXO`; acima → `NORMAL`. Dashboard separa sem estoque de baixo estoque.
- Validade é registrada por lote. Telas/listas distinguem vencido, crítico (até 7 dias), atenção (8–30) e normal. A política corrigida bloqueia lotes vencidos na expedição e os exclui do saldo disponível; os alertas continuam mostrando lotes vencidos para tratamento.

**Caminho do recebimento:** formulário `recebimentos.js` → `POST /api/recebimentos` com JSON → middleware de sessão/perfil → `estoqueController.registrarMovimentacao` → `estoqueService.registrarMovimentacao` → `recebimentoValidator` → `estoqueRepository.registrarEntrada` → transação SQL para lote + movimentação + auditoria → resposta 201 → recarga de histórico/saldo no frontend.

**Ponto de atenção:** tanto `POST /api/recebimentos` quanto `POST /api/expedicoes` chamam o mesmo controller e decidem a operação pelo `tipo` do corpo. Portanto, o path não força por si só `ENTRADA` ou `SAIDA`; o service aceita qualquer dos dois tipos nas duas rotas. Isso não corresponde a endpoints semanticamente estritos.

## 7. Algoritmo de baixa de lotes: FIFO ou FEFO?

O código executável está em `backend/repositories/estoqueRepository.js`, na consulta `buscarProdutoComLotes`. Ela seleciona lotes ativos com saldo maior que zero e ordena:

```sql
ORDER BY CASE WHEN data_validade IS NULL THEN 1 ELSE 0 END,
  data_validade ASC, criado_em ASC, id ASC
FOR UPDATE
```

O filtro da consulta inclui apenas lotes sem data ou ainda válidos:

```sql
WHERE produto_id = ? AND ativo = TRUE AND quantidade_atual > 0
  AND (data_validade >= CURRENT_DATE OR (data_validade IS NULL AND ? = FALSE))
```

O segundo parâmetro indica `possui_validade`: lote sem data só fica disponível quando o produto não exige controle de validade. Isso significa:

1. Lotes vencidos são excluídos da seleção de saída e do saldo disponível.
2. Entre os lotes disponíveis com validade, vence primeiro sai primeiro (`data_validade ASC`).
3. Empate de validade é resolvido pelo lote criado antes e, por fim, menor ID.
4. Lotes sem validade só ficam disponíveis para produtos sem controle de validade; nesses casos, ficam no final, ordenados por criação/ID.

Logo, o critério primário é **FEFO** (*First Expired, First Out* / vence primeiro, sai primeiro), **não FIFO puro** (*First In, First Out* / entrou primeiro, sai primeiro). A data de criação só decide empate ou ordena os lotes sem validade permitidos. Lotes vencidos não podem ser expedidos; se há saldo vencido e o saldo válido é insuficiente, a API retorna `422 LOTE_VENCIDO`, orientando a segregação e o descarte. Lotes sem validade de produtos controlados também ficam indisponíveis e retornam `LOTE_SEM_VALIDADE` quando impedem a expedição.

Na saída, a transação primeiro soma apenas os lotes bloqueados e ainda válidos. Se a quantidade disponível for insuficiente e houver lote vencido com saldo, rejeita com `422 LOTE_VENCIDO`; se não houver lote vencido, retorna `422 ESTOQUE_INSUFICIENTE`. Para produto controlado, lote sem validade também é excluído e pode gerar `LOTE_SEM_VALIDADE`. Nenhuma quantidade é alterada em caso de erro. Se houver saldo válido suficiente, percorre a lista:

```js
const retirada = Math.min(Number(lote.quantidade_atual), restante);
await conexao.execute(
  'UPDATE lotes SET quantidade_atual = quantidade_atual - ? WHERE id = ?',
  [retirada, lote.id]
);
// grava uma SAIDA ligada ao lote
restante -= retirada;
```

Se a quantidade do primeiro lote não basta, ele é esgotado (ou parcialmente consumido), `restante` diminui e o loop continua no próximo. Cada lote usado gera uma movimentação separada. `FOR UPDATE` bloqueia as linhas lidas para concorrência; `BEGIN/COMMIT` torna saldo, movimentos e auditoria atômicos. Erro provoca `ROLLBACK`.

**Exemplo para demonstrar:** lote X: 20 unidades, vence em 10 dias; lote Y: 30, vence em 40 dias; saída de 25. Apesar de Y poder ter sido recebido antes, FEFO ordena X primeiro. Baixa 20 de X (fica 0), faltam 5; baixa 5 de Y (fica 25). São duas movimentações de saída. Se houver também lote vencido, ele não entra no cálculo; quando o saldo válido não basta e há lote vencido, a operação é rejeitada antes de alterar qualquer lote.

`tests/fefo/fefo.test.js` cobre a validade mais próxima, múltiplos lotes, nulos por último, exclusão de vencidos, saldo disponível, desempate por `criado_em` e consumo total. `tests/recebimentos/recebimentos.test.js` cobre data obrigatória para produtos controlados, rejeição de data passada e imutabilidade da validade do lote em reentradas.

## 8. Dashboard e relatórios

### Dashboard

`dashboardRepository.js` consulta posição atual de produtos/lotes, movimentos por período, validade, estoque baixo/zero, categorias e atividades recentes. `dashboardService.js` valida e normaliza os dados e compara movimentações do período atual com o anterior. Períodos aceitos: hoje, 7 dias, 30 dias e mês.

Na interface (`dashboard.js` + `dashboard/index.html`) aparecem total de produtos ativos, saldo agregado, baixo estoque, movimentos, gráfico de entradas/saídas por dia, distribuição por categoria, atividades e alertas de validade/vencidos. O gráfico é desenhado pelo próprio JavaScript com SVG, não há biblioteca de gráficos detectada. Catálogo/estoque representam a posição atual; período filtra movimentos e atividades.

### Relatórios

`relatorioRepository.js` soma e conta movimentações confirmadas, agrega por data, categoria e produto e busca histórico (limite 200; ranking por produto até 50). Filtros: hoje/7 dias/30 dias/mês, tipo (`ENTRADA`/`SAIDA`) e categoria/produto. `relatorios.js` cria gráfico SVG, barras de distribuição, histórico e exporta CSV.

O browser envia parâmetros a `GET /api/relatorios`; a resposta inclui `dados` com `resumo`, `serie`, `porCategoria`, `porProduto`, `historico`, categorias e produtos. Há também página separada de validades e API `/api/validade`.

**Limites a explicar:** relatórios não provam uma funcionalidade de impressão/PDF; o export observado é CSV. Ajuste não é uma opção de tipo no filtro, embora o resumo sem filtro possa contar movimentações do tipo `AJUSTE`. Não foi encontrado job/alerta por e-mail: os alertas são consultados e exibidos na aplicação.

## 9. Testes e qualidade

- Runner efetivo no nível raiz: Jest (`jest.config.js`, Node, `maxWorkers: 1`, timeout de 60 s); `npm test` chama setup PostgreSQL e Jest serial. O `backend/package.json` também declara `node --test`, mas a suíte existente está em Jest.
- São testes de integração: iniciam servidor real em porta 3900 e usam PostgreSQL `babycare_test`; helpers fazem chamadas HTTP e verificações diretas no banco.
- Cobertura existente: login/payload/JWT/bloqueio/auditoria (`auth`), RBAC (`autorizacao`), produtos, recebimentos, expedições, limites/rollback e FEFO (`fefo`), além de testes unitários de tipo de rota, isolamento do servidor, regras de validade, consultas de datas/validade, ajustes e desativação segura.
- Não encontrei suíte frontend/DOM, testes dos cálculos/gráficos de dashboard e relatórios, recuperação de senha, nem cobertura percentual configurada. Não se pode afirmar cobertura total.
- `tests/scripts/setup-test-db.js` executa `DROP DATABASE ... WITH (FORCE)` somente para `babycare_test` local, depois recria schema e usuários de teste; requer PostgreSQL local e dependências instaladas. A configuração dos testes recusa host remoto e o processo do servidor de testes limpa `DATABASE_URL`, evitando herdar a conexão do Railway.

Os testes de autenticação agora extraem o cookie emitido pelo login e exercitam o acesso com cookie; os testes de produtos refletem o `PATCH` implementado e bloqueiam desativação com saldo; recebimentos e expedições rejeitam o tipo incorreto. Os casos de validade cobrem lotes vencidos, data obrigatória/passada, validade imutável, datas sem conversão de fuso e lotes sem saldo. Ajuste tem testes para justificativa, lote/validade e perfis autorizados. A execução integral ainda depende de um banco local descartável `babycare_test`.

## 10. Pontos fortes, limitações e melhorias sugeridas

**Pontos fortes:** camadas bem reconhecíveis; consultas parametrizadas; sessão em cookie HttpOnly; hash de senha; bloqueio e rate limit; autorização no servidor; constraints e FKs; movimentação de estoque com transação e lock de lote; trilha de auditoria; testes de integração relevantes para o caminho FEFO e saldo insuficiente.

**Limitações demonstráveis:** existe um schema MySQL histórico diferente do PostgreSQL usado no Railway; recuperação de senha ainda não entrega token por e-mail e permanece pendente de implementação, conforme decisão da equipe; fornecedor é texto livre; o endpoint de ajuste é somente API, sem formulário no frontend; o descarte físico dos vencidos ainda depende do processo da equipe; JWT não é revogado/revalidado no banco; não há testes visíveis para dashboard/relatório/frontend.

**Melhorias prioritárias para uma próxima versão:** manter PostgreSQL como fonte de verdade e identificar claramente o SQL MySQL como histórico; implementar futuramente o envio seguro de recuperação de senha; formalizar o processo operacional de descarte dos lotes vencidos; revogar/revalidar sessão em casos de usuário desativado; acrescentar testes para dashboard/relatórios e recuperação quando esse fluxo for implementado; configurar cobertura e CI.

# Roteiro de apresentação (15 slides)

Para caber em uma apresentação acadêmica, cada pessoa pode explicar o slide em linguagem simples e mostrar somente o arquivo/trecho indicado. Use os dados demonstrativos do próprio banco e evite alegar recursos que não estejam implementados.

## 1. Apresentação do BabyCare
- **Slide:** nome, propósito, imagem da aplicação e áreas do sistema.
- **Fala:** “É uma aplicação web para catálogo, lotes e operações de estoque de produtos infantis; o saldo é calculado pelos lotes.”
- **Arquivos:** `frontend/src/pages/dashboard/index.html`, `frontend/src/pages/produtos/index.html`.
- **Código:** os campos de produto e indicadores do dashboard.
- **Demonstração:** abrir dashboard e navegar para Produtos.

## 2. Problema que resolve
- **Slide:** risco de não saber saldo, validade ou histórico de entrada/saída.
- **Fala:** “O sistema organiza saldo por lote, registra movimentações e mostra alertas; bloqueia a expedição de vencidos, mas o descarte físico segue o processo da equipe.”
- **Arquivos:** `backend/repositories/estoqueRepository.js`, `backend/repositories/validadeRepository.js`.
- **Código:** soma de `quantidade_atual`; classificação por validade.
- **Demonstração:** mostrar um saldo e a lista de lotes/validades.

## 3. Tecnologias utilizadas
- **Slide:** HTML, CSS, JS, Vite, Node, Express, PostgreSQL, Jest, bcrypt/JWT.
- **Fala:** “O frontend é JavaScript puro; o runtime usa PostgreSQL, apesar do SQL MySQL histórico.”
- **Arquivos:** `package.json`, `backend/package.json`, `vite.config.js`, `backend/config/database.js`.
- **Código:** `require('pg')`/`new Pool` e proxy Vite `/api`.
- **Demonstração:** mostrar scripts `npm run dev` e composição Vite + backend sem executar setup destrutivo.

## 4. Arquitetura
- **Slide:** navegador → API Express → route/controller/service/validator/repository → PostgreSQL.
- **Fala:** explicar a responsabilidade de cada camada com uma única operação de recebimento.
- **Arquivos:** `backend/routes/recebimentoRoutes.js`, `backend/controllers/estoqueController.js`, `backend/services/estoqueService.js`, `backend/repositories/estoqueRepository.js`.
- **Código:** encadeamento POST `/api/recebimentos`.
- **Demonstração:** seguir a chamada no código, sem tentar mostrar todas as pastas.

## 5. Funcionamento do frontend
- **Slide:** formulário, tabela, filtros e responsividade.
- **Fala:** “HTML define estrutura, CSS aparência e JavaScript ouve eventos, chama API e atualiza DOM.”
- **Arquivos:** `frontend/src/pages/recebimentos/index.html`, `recebimentos.js`, `frontend/src/css/recebimentos.css`, `frontend/src/css/responsive-tables.css`.
- **Código:** evento `submit`, `fetch` com `credentials: 'include'`, renderização da tabela.
- **Demonstração:** filtrar histórico e abrir modal sem gravar se não for ambiente de demonstração.

## 6. Funcionamento do backend
- **Slide:** middleware e rotas REST principais.
- **Fala:** “Express recebe a requisição, a rota compõe autenticação e permissões, controller dá resposta e service/repository realizam regra e persistência.”
- **Arquivos:** `backend/server.js`, `backend/routes/estoqueRoutes.js`, `backend/controllers/estoqueController.js`.
- **Código:** montagem de `/api/estoque`, `verificarToken`, `permitirPerfis`.
- **Demonstração:** endpoint de health e resposta JSON (se ambiente disponível).

## 7. Banco de dados
- **Slide:** diagrama simples `categoria → produto → lote → movimentação`; usuário → perfil; auditoria → usuário.
- **Fala:** “O saldo reside nos lotes; FK protege referências. O banco ativo é PostgreSQL, não o MySQL do arquivo histórico.”
- **Arquivos:** `backend/database.postgres.sql`, `backend/database.sql`.
- **Código:** `UNIQUE(produto_id, numero_lote)`, FK e CHECK de quantidade.
- **Demonstração:** consultar lotes de um produto e somar os saldos.

## 8. Autenticação e segurança
- **Slide:** bcrypt, JWT em cookie HttpOnly, autorização por perfil e limites de login.
- **Fala:** explicar que senha não é armazenada em texto e que o backend decide autorização.
- **Arquivos:** `backend/services/authService.js`, `backend/controllers/authController.js`, `backend/middlewares/authMiddleware.js`, `backend/middlewares/rateLimiter.js`.
- **Código:** `bcrypt.compare`, `jwt.sign`, cookie `httpOnly`, `permitirPerfis`.
- **Demonstração:** login inválido genérico e diferença entre 401 (não autenticado) e 403 (sem permissão).

## 9. Gerenciamento de estoque
- **Slide:** cadastro sem saldo → recebimento cria lote → expedição baixa saldo → histórico.
- **Fala:** distinguir cadastro de produto da entrada física; fornecedor é armazenado como texto no lote.
- **Arquivos:** `frontend/src/pages/formulario-produto/formulario-produto.js`, `frontend/src/pages/recebimentos/recebimentos.js`, `backend/validators/recebimentoValidator.js`, `backend/repositories/estoqueRepository.js`.
- **Código:** soma no lote existente e grava `ENTRADA` confirmada.
- **Demonstração:** cadastrar produto de teste, receber quantidade e conferir saldo/lote.

## 10. Algoritmo FEFO
- **Slide:** comparação curta FIFO versus FEFO; ordenar visualmente lotes por validade.
- **Fala:** “O código usa FEFO: validade mais próxima primeiro. FIFO aparece só como desempate pela criação.”
- **Arquivos:** `backend/repositories/estoqueRepository.js`, `tests/fefo/fefo.test.js`.
- **Código:** `ORDER BY ... data_validade ASC, criado_em ASC ... FOR UPDATE` e loop `Math.min`.
- **Demonstração:** 20 unidades que vencem em 10 dias + 30 em 40 dias; expedir 25 → primeiro lote zera, segundo fica com 25; mostrar duas linhas de movimento.

## 11. Dashboard e relatórios
- **Slide:** cartões, gráfico diário, alertas, filtros e exportação CSV.
- **Fala:** “SQL agrega no backend; o JS recebe JSON e desenha SVG/tabelas. Não usamos uma biblioteca externa de gráficos.”
- **Arquivos:** `backend/repositories/dashboardRepository.js`, `backend/services/dashboardService.js`, `frontend/src/pages/dashboard/dashboard.js`, `frontend/src/pages/relatorios/relatorios.js`.
- **Código:** consultas de soma/contagem e criação do SVG.
- **Demonstração:** trocar período e exportar histórico CSV.

## 12. Auditoria
- **Slide:** eventos de login, recebimento, expedição e ajuste.
- **Fala:** “Movimentação é histórico operacional; auditoria registra ação, usuário, resultado e detalhes.”
- **Arquivos:** `backend/repositories/auditoriaRepository.js`, `backend/services/auditoriaService.js`, `frontend/src/pages/auditoria/auditoria.js`.
- **Código:** `registrarNaConexao` dentro da transação do estoque.
- **Demonstração:** filtrar auditoria por ação/resultado após recebimento de teste.

## 13. Testes realizados
- **Slide:** Jest + PostgreSQL de teste; áreas com testes; limitações.
- **Fala:** “Há testes de integração para autenticação, autorização, produtos, recebimentos, expedições e FEFO; não afirmamos cobertura total nem execução bem-sucedida sem rodá-los.”
- **Arquivos:** `jest.config.js`, `tests/auth/auth.test.js`, `tests/autorizacao/autorizacao.test.js`, `tests/fefo/fefo.test.js`, `tests/scripts/setup-test-db.js`.
- **Código:** exemplos de expectativa de saldo/rollback e cenários FEFO.
- **Demonstração:** apresentar os testes como evidência de cenários escritos; antes de executar, confirmar que `babycare_test` é descartável.

## 14. Dificuldades técnicas e soluções
- **Slide:** rastreabilidade de lotes, consistência em concorrência, autenticação e integração.
- **Fala:** “Locks e transação ajudam a impedir duas expedições de consumir o mesmo saldo; constraints protegem integridade.”
- **Arquivos:** `backend/config/database.js`, `backend/repositories/estoqueRepository.js`, `backend/database.postgres.sql`.
- **Código:** `FOR UPDATE`, `BEGIN/COMMIT/ROLLBACK`.
- **Demonstração:** saída que atravessa dois lotes; explicar o rollback do saldo insuficiente.
- **Nota honesta:** apontar o schema MySQL histórico e a recuperação de senha ainda planejada como itens pendentes, sem apresentar como funcionalidades concluídas.

## 15. Conclusão
- **Slide:** benefícios comprovados, ressalvas técnicas e próximos passos.
- **Fala:** “O sistema entrega controle de produtos/lotes, entradas/saídas, perfis, auditoria, alertas e relatórios. A política de saída implementada é FEFO, e o banco corrente é PostgreSQL.”
- **Arquivos:** dashboard, recebimentos/expedições e schema PostgreSQL.
- **Código:** saldo calculado pela soma dos lotes e transação de baixa.
- **Demonstração:** fechar o ciclo: saldo inicial → recebimento → expedição FEFO → saldo e auditoria.

## Perguntas prováveis da banca

- **“O banco é MySQL?”** O runtime atual usa `pg`/PostgreSQL e lê `database.postgres.sql`; `database.sql` é a versão MySQL histórica.
- **“É FIFO?”** O nome em alguns textos/testes diz FIFO, mas o código ordena primeiro por validade; é FEFO, com criação como desempate.
- **“O token fica no localStorage?”** Não no fluxo atual. JWT vai em cookie HttpOnly; Web Storage contém apenas dados públicos do usuário e filtros.
- **“Vencido é bloqueado?”** Sim. A expedição exclui lotes vencidos do saldo disponível e, quando eles seriam necessários, responde `LOTE_VENCIDO`; os alertas continuam listando-os para descarte.
- **“O que garante saldo correto?”** Transação, `FOR UPDATE`, checagem de saldo agregado, CHECK de lote não negativo e rollback em erro.
- **“Fornecedor é uma tabela?”** Não; é texto no lote.
- **“A recuperação envia e-mail?”** Não há envio implementado; o token é gravado, mas não existe entrega funcional ao usuário.
- **“Todos os testes passam?”** Ainda não foi confirmado: a suíte de integração não foi executada porque o setup recria `babycare_test`. Os testes desalinhados identificados já foram atualizados.
