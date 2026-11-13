# Roteiro de demonstração e teste funcional do BabyCare

Este roteiro é para abrir o site diante do professor e demonstrar os fluxos funcionando, com destaque para o FEFO. O cenário de movimentação de estoque grava dados: prepare-o em ambiente local/staging ou use somente um produto de demonstração autorizado. **Não faça entradas e saídas de teste sobre produtos reais da operação.**

## Antes de apresentar

1. Confirme com o administrador que sua conta está ativa e qual é o perfil dela.
2. Deixe abertas estas páginas:
   - Site: <https://babycaree.vercel.app/>
   - Saúde do backend: <https://babycare-app-uxmd.onrender.com/api/health>
3. Na página de saúde, confirme `status: "ok"` e `banco: "conectado"`.
4. Se a demonstração incluir FEFO, prepare previamente os dados abaixo em staging/local. A tela de cadastro de produto inicia com saldo zero; o estoque entra pelo módulo **Recebimentos**.
5. Se o único ambiente disponível for produção, faça a parte de navegação e consulta, mas não registre movimentações sem autorização e estoque reservado para a apresentação.

## Apresentação sugerida (5 a 10 minutos)

### 1. Apresente o objetivo

**Mostre:** página de login e, em uma frase, explique que o BabyCare organiza produtos, lotes, validade e movimentações de estoque.

**Fala sugerida:** “O sistema ajuda a acompanhar o saldo e a rastreabilidade dos lotes. Vou mostrar desde o cadastro até uma saída, e como a validade define qual lote é baixado primeiro.”

### 2. Entre no sistema

1. Acesse <https://babycaree.vercel.app/> e faça login com a conta ativa fornecida pelo administrador.
2. Mostre o Dashboard após entrar.
3. Atualize a página uma vez para confirmar que a sessão continua ativa.

**Nota para o apresentador:** antes do login, `GET /api/perfil` pode retornar `401`; a página consulta se já existe uma sessão. Depois de um login bem-sucedido, essa chamada deve retornar `200`. Um erro CORS ou um `404 NOT_FOUND` não é esperado.

### 3. Mostre o Dashboard e o catálogo

1. No Dashboard, apresente os indicadores e a navegação lateral.
2. Abra **Produtos** e mostre a lista, pesquisa e filtros disponíveis.
3. Explique que o cadastro cria o produto, mas não adiciona quantidade ao estoque. As entradas são registradas separadamente em **Recebimentos**.

Não é necessário criar produto durante a fala. Se for demonstrar FEFO, use o produto de demonstração preparado antes.

## 4. Demonstre o FEFO com dados controlados

**FEFO** significa *First Expire, First Out*: entre lotes disponíveis e não vencidos, o sistema consome primeiro o que tem a data de validade mais próxima. Não é FIFO, que prioriza a ordem de entrada.

### Dados para preparar

Use um produto de demonstração que tenha controle de validade. Cadastre-o em **Produtos → Cadastrar produto**, usando uma categoria existente, unidade `UN`, estoque mínimo e **Possui validade? Sim**. O formulário exige nome, SKU, categoria, unidade, estoque mínimo e data futura. Use um SKU exclusivo, por exemplo `DEMO-FEFO-AULA-01`.

Em **Recebimentos**, registre dois lotes para esse mesmo produto. Cadastre primeiro o lote de validade mais distante para deixar claro que a baixa não está seguindo a ordem de chegada:

| Ordem de entrada | Lote | Quantidade | Validade |
| --- | --- | ---: | --- |
| Primeiro | `DEMO-FEFO-A` | 10 | daqui a aproximadamente 60 dias |
| Segundo | `DEMO-FEFO-B` | 10 | daqui a aproximadamente 30 dias |

Para cada recebimento, selecione uma localização existente e escolha datas futuras. Os números de lote precisam ser diferentes. Fornecedor, documento e observação são opcionais.

### Execução ao vivo

1. Abra **Validade** e mostre os dois lotes, suas validades e quantidades.
2. Abra **Estoque → Registrar saída**. O formulário deve mostrar **Destinatário** e **Destino**. Como o sistema escolhe os lotes por FEFO, os campos de lote, validade e localização da entrada não são usados na saída.
3. Selecione o produto de demonstração e informe quantidade `12`.
4. Preencha destinatário e destino com valores de demonstração, por exemplo `Apresentação escolar` e `Estoque de demonstração`. Confirme somente em ambiente isolado ou com saldo reservado.
5. Abra **Expedições** e procure as movimentações do produto e os lotes consumidos.
6. Volte a **Validade** e confira as quantidades remanescentes.

### Resultado esperado

O lote `DEMO-FEFO-B`, que vence antes, deve ser baixado primeiro: 10 unidades. Para completar a saída de 12, o sistema baixa mais 2 unidades do lote `DEMO-FEFO-A`.

| Lote | Antes | Saída esperada | Depois |
| --- | ---: | ---: | ---: |
| `DEMO-FEFO-B` (vence antes) | 10 | 10 | 0 |
| `DEMO-FEFO-A` (vence depois) | 10 | 2 | 8 |

O saldo do produto deve ficar em 8. No histórico, procure as movimentações associadas aos dois lotes; na tela **Validade**, o lote zerado pode deixar de aparecer porque não possui saldo atual.

**Fala sugerida:** “O lote A entrou primeiro, mas vence depois. Mesmo assim, o sistema consumiu primeiro o lote B, que vence antes. Isso demonstra FEFO pela validade, não FIFO pela chegada.”

**Importante:** o modal de expedição agora identifica a regra como FEFO. O teste automatizado correspondente fica em [`tests/fefo/fefo.test.js`](./tests/fefo/fefo.test.js); ele também cobre uma saída que atravessa mais de um lote.

## 5. Mostre rastreabilidade e demais telas

Depois da demonstração, separe alguns minutos para mostrar:

- **Recebimentos:** data, produto, lote, fornecedor, quantidade e validade.
- **Expedições:** produto, lote consumido, quantidade, destinatário e destino.
- **Validade:** lotes com data e quantidade restante.
- **Estoque:** saldo e histórico do produto.
- **Auditoria:** registros de operações disponíveis para o perfil da conta.
- **Relatórios:** consulte os filtros e os resultados apresentados.

As opções visíveis e as ações permitidas podem variar conforme o perfil do usuário.

## Checklist rápido para saber se a demonstração passou

- [ ] A raiz do site abre o login; não há `404 NOT_FOUND`.
- [ ] O backend retorna `status: "ok"` e `banco: "conectado"`.
- [ ] O login funciona e a sessão continua após atualizar.
- [ ] Após entrar, `GET /api/perfil` retorna `200` e não há erro CORS.
- [ ] Dashboard, Produtos, Estoque, Validade, Recebimentos e Expedições carregam.
- [ ] No cenário FEFO, o lote com validade mais próxima foi consumido primeiro e os saldos finais conferem.
- [ ] O histórico mostra a saída vinculada aos lotes correspondentes.

## Problemas comuns durante a apresentação

| O que aparece | O que conferir |
| --- | --- |
| `401` em `/api/perfil` antes do login | Normal: ainda não há sessão. Depois de entrar, deve retornar `200`. |
| `401` em `/api/perfil` depois do login | Verifique se o navegador aceitou e enviou o cookie `babycareToken`; cookies de terceiros podem ser bloqueados. |
| `blocked by CORS policy` | Em Render → Environment, `CORS_ORIGINS` precisa conter exatamente `https://babycaree.vercel.app` (sem barra final). Aguarde o serviço ficar **Live**. |
| A API chama `babycaree.vercel.app/api/...` | Confira `VITE_API_URL` na Vercel: `https://babycare-app-uxmd.onrender.com/api`; depois faça novo deploy. |
| `403` | A conta está autenticada, mas o perfil não pode executar aquela ação. |
| `404 NOT_FOUND` da Vercel | Confirme que abriu o domínio de produção e que o último deployment está **Ready**. |
| `503` no health | Confira o estado do backend e a conexão com o banco no Render. |

## Testes automatizados (para preparar antes, não durante a apresentação)

Na raiz do projeto:

```powershell
npm run build
npm test
```

`npm run build` verifica a compilação do frontend. `npm test` recria o banco local `babycare_test` e executa Jest; o setup restringe a operação a um PostgreSQL local. Não aponte os testes para o banco do Render. A suíte automatizada é evidência complementar: ela não substitui a demonstração visual no site.

## Limitações conhecidas

- O fluxo de recuperação de senha ainda não deve ser apresentado como funcional.
- Não use produtos ou quantidades reais para a demonstração FEFO.
- Se não houver staging ou saldo de demonstração autorizado, mostre o cenário FEFO com os dados do teste automatizado, sem registrar movimentações no banco de produção.
