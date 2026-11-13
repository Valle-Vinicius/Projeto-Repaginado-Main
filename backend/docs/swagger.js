const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Babycare API',
      version: '1.0.0',
      description:
        'API do sistema Babycare - controle de estoque, validade, recebimentos, expedições, relatórios e usuários.',
      contact: {
        name: 'Suporte Babycare',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000/api',
        description: 'Servidor de desenvolvimento local',
      },
    ],
    components: {
      securitySchemes: {
        CookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'babycareToken',
          description: 'JWT de autenticação armazenado em cookie httpOnly.',
        },
        ErpApiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-ERP-API-Key',
          description:
            'Credencial servidor-servidor configurada em ERP_API_KEY.',
        },
      },
      schemas: {
        Erro: {
          type: 'object',
          properties: {
            sucesso: { type: 'boolean', example: false },
            codigo: { type: 'string', example: 'ESTOQUE_INSUFICIENTE' },
            mensagem: { type: 'string', example: 'Quantidade indisponível.' },
          },
        },
        Usuario: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            nome: { type: 'string', example: 'João Silva' },
            email: { type: 'string', example: 'joao@babycare.com' },
            perfil: { type: 'string', example: 'ADMINISTRADOR' },
            departamento: { type: 'string', example: 'Estoque' },
            ativo: { type: 'boolean', example: true },
            ultimoLoginEm: { type: 'string', example: '2026-11-05T10:30:00Z' },
          },
        },
        Produto: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 42 },
            codigo: { type: 'string', example: 'PROD-001' },
            nome: { type: 'string', example: 'Fralda tamanho M' },
            descricao: {
              type: 'string',
              example: 'Fralda descartável tamanho médio',
            },
            sku: { type: 'string', example: 'SKU-12345' },
            categoriaId: { type: 'integer', example: 3 },
            categoria: { type: 'string', example: 'Higiene' },
            unidade: { type: 'string', example: 'UN' },
            estoqueAtual: { type: 'number', example: 120 },
            estoqueMinimo: { type: 'number', example: 10 },
            statusProduto: { type: 'string', example: 'ATIVO' },
            possuiValidade: { type: 'boolean', example: true },
            ultimaMovimentacao: {
              type: 'string',
              example: '2026-11-05T14:20:00Z',
            },
          },
        },
        Categoria: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 3 },
            nome: { type: 'string', example: 'Higiene' },
          },
        },
        Movimentacao: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1005 },
            tipo: { type: 'string', example: 'ENTRADA' },
            status: { type: 'string', example: 'CONFIRMADA' },
            quantidade: { type: 'number', example: 50 },
            numeroLote: { type: 'string', example: 'LOTE-2026-01' },
            dataValidade: { type: 'string', example: '2027-12-31' },
            localizacao: { type: 'string', example: 'Setor A' },
            fornecedor: { type: 'string', example: 'Fornecedor X' },
            destinatario: { type: 'string', example: 'Unidade Norte' },
            destino: { type: 'string', example: 'Setor de distribuição' },
            documento: { type: 'string', example: 'NF-123' },
            motivo: { type: 'string', example: 'EXPEDICAO' },
            observacao: { type: 'string', example: 'Saída para clínica' },
            criadoEm: { type: 'string', example: '2026-11-05T14:20:00Z' },
            responsavel: { type: 'string', example: 'João Silva' },
          },
        },
        RelatorioHistoricoItem: {
          type: 'object',
          properties: {
            tipo: { type: 'string', example: 'ENTRADA' },
            produto: { type: 'string', example: 'Fralda M' },
            quantidade: { type: 'number', example: 50 },
            numeroLote: { type: 'string', example: 'LOTE-001' },
            dataValidade: { type: 'string', example: '2027-12-31' },
            localizacao: { type: 'string', example: 'Setor A' },
            fornecedor: { type: 'string', example: 'Fornecedor X' },
            criadoEm: { type: 'string', example: '2026-11-05T14:20:00Z' },
            responsavel: { type: 'string', example: 'João Silva' },
          },
        },
      },
    },
    security: [{ CookieAuth: [] }],
  },
  apis: ['./backend/routes/*.js', './backend/docs/swagger-paths.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
