/**
 * @swagger
 * tags:
 *   - name: Autenticação
 *     description: Login, logout e gestão de sessão.
 *   - name: Usuários
 *   - name: Produtos
 *   - name: Categorias
 *   - name: Estoque
 *   - name: Recebimentos
 *   - name: Expedições
 *   - name: Movimentações
 *   - name: Relatórios
 *   - name: Validade
 *   - name: Auditoria
 *   - name: Perfil
 *   - name: Redefinição de senha
 */

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Autenticação]
 *     summary: Autentica usuário e retorna cookie JWT httpOnly.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, senha]
 *             properties:
 *               email: { type: string, example: 'admin@babycare.com' }
 *               senha: { type: string, example: '123456' }
 *     responses:
 *       200:
 *         description: Login realizado com sucesso.
 *       401:
 *         description: Credenciais inválidas.
 *       423:
 *         description: Conta bloqueada por tentativas excedidas.
 */

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags: [Autenticação]
 *     summary: Encerra a sessão limpando o cookie de autenticação.
 *     responses:
 *       200:
 *         description: Logout realizado.
 */

/**
 * @swagger
 * /usuarios:
 *   get:
 *     tags: [Usuários]
 *     summary: Lista usuários com filtros de busca, perfil e status.
 *     parameters:
 *       - in: query
 *         name: busca
 *         schema: { type: string }
 *       - in: query
 *         name: perfilId
 *         schema: { type: string }
 *       - in: query
 *         name: ativo
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Lista de usuários.
 *       403:
 *         description: Permissão negada.
 *   post:
 *     tags: [Usuários]
 *     summary: Cadastra um novo usuário.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nome, email, senha, perfil]
 *             properties:
 *               nome: { type: string }
 *               email: { type: string }
 *               senha: { type: string }
 *               perfil: { type: string }
 *               departamentoId: { type: integer }
 *     responses:
 *       201:
 *         description: Usuário criado.
 *       400:
 *         description: Erro de validação.
 *       403:
 *         description: Permissão negada.
 */

/**
 * @swagger
 * /usuarios/{id}:
 *   patch:
 *     tags: [Usuários]
 *     summary: Atualiza dados de um usuário.
 *   delete:
 *     tags: [Usuários]
 *     summary: Inativa um usuário (apenas administrador).
 */

/**
 * @swagger
 * /usuarios/opcoes:
 *   get:
 *     tags: [Usuários]
 *     summary: Retorna perfis e departamentos disponíveis para cadastro.
 *     responses:
 *       200:
 *         description: Opções de cadastro.
 */

/**
 * @swagger
 * /produtos:
 *   get:
 *     tags: [Produtos]
 *     summary: Lista produtos com paginação, busca, categoria, status e filtro de estoque.
 *     parameters:
 *       - in: query
 *         name: pagina
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limite
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: busca
 *         schema: { type: string }
 *       - in: query
 *         name: categoriaId
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: estoque
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Lista paginada de produtos.
 *   post:
 *     tags: [Produtos]
 *     summary: Cadastra um novo produto.
 *     responses:
 *       201:
 *         description: Produto criado.
 *       400:
 *         description: Erro de validação.
 */

/**
 * @swagger
 * /produtos/categorias:
 *   get:
 *     tags: [Categorias]
 *     summary: Lista categorias de produtos.
 *     responses:
 *       200:
 *         description: Lista de categorias.
 */

/**
 * @swagger
 * /produtos/{id}/desativar:
 *   patch:
 *     tags: [Produtos]
 *     summary: Inativa um produto sem saldo pendente (somente administrador).
 *     description: A inativação é transacional, preserva o histórico e gera auditoria. É recusada se houver quantidade positiva em lote ativo, inclusive vencido.
 *     responses:
 *       200:
 *         description: Produto inativado.
 *       403:
 *         description: Apenas administradores podem inativar produtos.
 *       404:
 *         description: Produto não encontrado.
 *       409:
 *         description: Produto ainda possui saldo em lote ativo.
 */

/**
 * @swagger
 * /estoque:
 *   get:
 *     tags: [Estoque]
 *     summary: Retorna resumo do estoque e lista de produtos com saldo.
 *     responses:
 *       200:
 *         description: Dados do estoque.
 */

/**
 * @swagger
 * /estoque/movimentacoes:
 *   post:
 *     tags: [Movimentações]
 *     summary: Registra entrada ou saída de estoque (baixa FEFO).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tipo, produtoId, quantidade]
 *             properties:
 *               tipo: { type: string, enum: [ENTRADA, SAIDA] }
 *               produtoId: { type: integer }
 *               quantidade: { type: number }
 *               numeroLote: { type: string }
 *               dataValidade: { type: string, format: date, description: Obrigatória para produtos com controle de validade; não pode estar no passado. }
 *               localizacaoId: { type: integer }
 *               fornecedor: { type: string }
 *               destinatario: { type: string }
 *               destino: { type: string }
 *               documento: { type: string }
 *               motivo: { type: string }
 *               observacao: { type: string }
 *     responses:
 *       201:
 *         description: Movimentação registrada.
 *       400:
 *         description: Erro de validação.
 *       409:
 *         description: Número de lote já registrado com outra validade.
 *       422:
 *         description: Estoque disponível insuficiente, lote vencido ou lote controlado sem validade.
 */

/**
 * @swagger
 * /estoque/ajuste:
 *   post:
 *     tags: [Movimentações]
 *     summary: Ajusta o saldo atual de um produto.
 *     description: Restrito a gerente e administrador. Exige justificativa; aumentos exigem número de lote e, para produtos com controle de validade, uma data futura ou atual.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [produtoId, quantidadeNova, observacao]
 *             properties:
 *               produtoId: { type: integer }
 *               quantidadeNova: { type: number }
 *               observacao: { type: string, maxLength: 255, description: Justificativa obrigatória }
 *               numeroLote: { type: string, maxLength: 80 }
 *               dataValidade: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Ajuste registrado.
 *       400:
 *         description: Erro de validação.
 *       403:
 *         description: Perfil sem permissão para ajustar estoque.
 *       409:
 *         description: Conflito com lote ou validade já registrados.
 */

/**
 * @swagger
 * /estoque/movimentacoes:
 *   get:
 *     tags: [Movimentações]
 *     summary: Lista histórico de movimentações com filtros.
 *     responses:
 *       200:
 *         description: Histórico de movimentações.
 */

/**
 * @swagger
 * /recebimentos:
 *   get:
 *     tags: [Recebimentos]
 *     summary: Lista recebimentos com filtros de busca e período.
 *     responses:
 *       200:
 *         description: Lista de recebimentos.
 */

/**
 * @swagger
 * /expedicoes:
 *   get:
 *     tags: [Expedições]
 *     summary: Lista expedições com filtros de busca e período.
 *     responses:
 *       200:
 *         description: Lista de expedições.
 */

/**
 * @swagger
 * /dashboard:
 *   get:
 *     tags: [Relatórios]
 *     summary: Retorna indicadores do dashboard (estoque, alertas, atividades recentes).
 *     responses:
 *       200:
 *         description: Dados do dashboard.
 */

/**
 * @swagger
 * /relatorios:
 *   get:
 *     tags: [Relatórios]
 *     summary: Gera relatório de movimentações com filtros de período, tipo, categoria e produto.
 *     parameters:
 *       - in: query
 *         name: periodo
 *         schema: { type: string }
 *       - in: query
 *         name: tipo
 *         schema: { type: string }
 *       - in: query
 *         name: categoriaId
 *         schema: { type: string }
 *       - in: query
 *         name: produtoId
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Dados do relatório.
 */

/**
 * @swagger
 * /validade:
 *   get:
 *     tags: [Validade]
 *     summary: Lista produtos com lotes próximos do vencimento ou vencidos.
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [TODOS, VENCIDO, CRITICO, ATENCAO, NORMAL] }
 *       - in: query
 *         name: busca
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Lista de produtos por status de validade.
 */

/**
 * @swagger
 * /auditorias:
 *   get:
 *     tags: [Auditoria]
 *     summary: Lista eventos de auditoria com filtros de período, resultado e ação.
 *     responses:
 *       200:
 *         description: Eventos de auditoria.
 */

/**
 * @swagger
 * /perfil:
 *   get:
 *     tags: [Perfil]
 *     summary: Retorna dados do usuário logado.
 *   patch:
 *     tags: [Perfil]
 *     summary: Atualiza nome, e-mail ou senha do usuário logado.
 */

/**
 * @swagger
 * /auth/solicitar-reset:
 *   post:
 *     tags: [Redefinição de senha]
 *     summary: Solicita token de redefinição de senha por e-mail.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string }
 *     responses:
 *       200:
 *         description: Token gerado (se o e-mail existir).
 */

/**
 * @swagger
 * /auth/redefinir-senha:
 *   post:
 *     tags: [Redefinição de senha]
 *     summary: Redefine senha usando token de recuperação.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, novaSenha]
 *             properties:
 *               token: { type: string }
 *               novaSenha: { type: string }
 *     responses:
 *       200:
 *         description: Senha redefinida.
 *       400:
 *         description: Token inválido ou senha inválida.
 */
