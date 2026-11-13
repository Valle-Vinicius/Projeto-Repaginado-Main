const estoqueService = require('../../backend/services/estoqueService');
const repository = require('../../backend/repositories/integracaoErpRepository');
const {
  verificarChaveERP,
} = require('../../backend/middlewares/erpApiKeyMiddleware');
const service = require('../../backend/services/integracaoErpService');

jest.mock('../../backend/services/estoqueService', () => ({
  registrarMovimentacao: jest.fn(),
  ajustarEstoque: jest.fn(),
}));
jest.mock('../../backend/services/produtoService', () => ({
  listarProdutos: jest.fn(),
}));
jest.mock('../../backend/repositories/integracaoErpRepository', () => ({
  reservarEvento: jest.fn(),
  concluirEvento: jest.fn(),
  falharEvento: jest.fn(),
}));

describe('Integração ERP', () => {
  const chaveOriginal = process.env.ERP_API_KEY;
  const ambienteOriginal = process.env.NODE_ENV;

  afterEach(() => {
    jest.clearAllMocks();
    if (chaveOriginal === undefined) {
      delete process.env.ERP_API_KEY;
    } else {
      process.env.ERP_API_KEY = chaveOriginal;
    }
    if (ambienteOriginal === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = ambienteOriginal;
    }
  });

  function middlewareResponse() {
    const resposta = {
      status: jest.fn(),
      json: jest.fn(),
    };
    resposta.status.mockReturnValue(resposta);
    return resposta;
  }

  it('desativa os endpoints quando a chave não está configurada', () => {
    delete process.env.ERP_API_KEY;
    const req = { get: jest.fn() };
    const res = middlewareResponse();
    const next = jest.fn();

    verificarChaveERP(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ codigo: 'INTEGRACAO_ERP_NAO_CONFIGURADA' }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('rejeita uma chave inválida', () => {
    process.env.ERP_API_KEY = 'chave-segura-de-teste-com-mais-de-32-caracteres';
    const req = { get: jest.fn().mockReturnValue('incorreta') };
    const res = middlewareResponse();
    const next = jest.fn();

    verificarChaveERP(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('aceita a chave configurada', () => {
    process.env.ERP_API_KEY = 'chave-segura-de-teste-com-mais-de-32-caracteres';
    const req = { get: jest.fn().mockReturnValue(process.env.ERP_API_KEY) };
    const res = middlewareResponse();
    const next = jest.fn();

    verificarChaveERP(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('exige HTTPS em produção', () => {
    process.env.NODE_ENV = 'production';
    process.env.ERP_API_KEY = 'chave-segura-de-teste-com-mais-de-32-caracteres';
    const req = { secure: false, get: jest.fn() };
    const res = middlewareResponse();
    const next = jest.fn();

    verificarChaveERP(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('reproduz o resultado de um evento já concluído sem repetir a movimentação', async () => {
    const payload = {
      tipo: 'SAIDA',
      produtoId: 7,
      quantidade: 2,
      destinatario: 'Cliente',
      destino: 'Loja',
    };
    const resposta = { sucesso: true, dados: { id: 21 } };
    repository.reservarEvento
      .mockResolvedValueOnce({ novo: true })
      .mockImplementationOnce(async (eventoExternoId, payloadHash) => ({
        novo: false,
        evento: { payloadHash, status: 'CONCLUIDO', resposta },
      }));
    estoqueService.registrarMovimentacao.mockResolvedValue(resposta.dados);
    repository.concluirEvento.mockResolvedValue();

    await service.processarMovimentacao('ERP-21', payload);
    const repeticao = await service.processarMovimentacao('ERP-21', payload);

    expect(repeticao).toEqual({ resposta, repetida: true });
    expect(estoqueService.registrarMovimentacao).toHaveBeenCalledTimes(1);
  });

  it('não permite reutilizar a mesma chave para outro payload', async () => {
    repository.reservarEvento.mockResolvedValue({
      novo: false,
      evento: {
        payloadHash: 'hash-diferente',
        status: 'CONCLUIDO',
        resposta: {},
      },
    });

    await expect(
      service.processarMovimentacao('ERP-22', {
        tipo: 'ENTRADA',
        produtoId: 2,
        quantidade: 4,
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      codigo: 'IDEMPOTENCY_KEY_REUTILIZADA',
    });
    expect(estoqueService.registrarMovimentacao).not.toHaveBeenCalled();
  });
});
