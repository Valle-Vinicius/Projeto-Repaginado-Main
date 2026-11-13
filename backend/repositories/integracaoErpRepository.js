const { executarQuery } = require('../config/database');

async function reservarEvento(eventoExternoId, payloadHash) {
  const inserido = await executarQuery(
    `INSERT INTO integracao_erp_eventos (evento_externo_id, payload_hash, status)
      VALUES (?, ?, 'PROCESSANDO')
      ON CONFLICT (evento_externo_id) DO NOTHING
      RETURNING evento_externo_id`,
    [eventoExternoId, payloadHash],
  );

  if (inserido.length) {
    return { novo: true };
  }

  const eventos = await executarQuery(
    `SELECT evento_externo_id AS "eventoExternoId", payload_hash AS "payloadHash",
        status, resposta, erro_status AS "erroStatus", erro_codigo AS "erroCodigo",
        erro_mensagem AS "erroMensagem"
      FROM integracao_erp_eventos
      WHERE evento_externo_id = ?`,
    [eventoExternoId],
  );

  if (!eventos.length) {
    throw new Error('O evento ERP não pôde ser recuperado após a reserva.');
  }

  return { novo: false, evento: eventos[0] };
}

async function concluirEvento(eventoExternoId, resposta) {
  await executarQuery(
    `UPDATE integracao_erp_eventos
      SET status = 'CONCLUIDO', resposta = ?::jsonb, atualizado_em = CURRENT_TIMESTAMP
      WHERE evento_externo_id = ?`,
    [JSON.stringify(resposta), eventoExternoId],
  );
}

async function falharEvento(eventoExternoId, status, codigo, mensagem) {
  await executarQuery(
    `UPDATE integracao_erp_eventos
      SET status = 'FALHA', erro_status = ?, erro_codigo = ?, erro_mensagem = ?,
        atualizado_em = CURRENT_TIMESTAMP
      WHERE evento_externo_id = ?`,
    [status, codigo, mensagem, eventoExternoId],
  );
}

module.exports = { reservarEvento, concluirEvento, falharEvento };
