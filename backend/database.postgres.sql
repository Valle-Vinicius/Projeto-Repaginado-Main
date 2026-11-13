BEGIN;

CREATE TABLE IF NOT EXISTS perfis (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(50) NOT NULL UNIQUE CHECK (CHAR_LENGTH(TRIM(nome)) >= 3),
  ativo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS departamentos (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(80) NOT NULL UNIQUE CHECK (CHAR_LENGTH(TRIM(nome)) >= 3),
  ativo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(120) NOT NULL CHECK (CHAR_LENGTH(TRIM(nome)) BETWEEN 3 AND 120),
  email VARCHAR(255) NOT NULL UNIQUE CHECK (CHAR_LENGTH(email) BETWEEN 3 AND 255),
  senha_hash VARCHAR(255) NOT NULL CHECK (senha_hash LIKE '$2%'),
  perfil_id INTEGER NOT NULL REFERENCES perfis(id),
  departamento_id INTEGER REFERENCES departamentos(id),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  tentativas_login INTEGER NOT NULL DEFAULT 0 CHECK (tentativas_login >= 0),
  bloqueado_ate TIMESTAMP,
  ultimo_login_em TIMESTAMP,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auditorias (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  acao VARCHAR(80) NOT NULL,
  entidade VARCHAR(80),
  entidade_id INTEGER,
  resultado VARCHAR(30) NOT NULL DEFAULT 'SUCESSO' CHECK (resultado IN ('SUCESSO', 'FALHA')),
  detalhes JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categorias (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL UNIQUE CHECK (CHAR_LENGTH(TRIM(nome)) >= 3),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS localizacoes (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL UNIQUE CHECK (CHAR_LENGTH(TRIM(nome)) >= 3),
  descricao VARCHAR(255),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS produtos (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(50) NOT NULL UNIQUE CHECK (CHAR_LENGTH(TRIM(codigo)) >= 1),
  nome VARCHAR(150) NOT NULL CHECK (CHAR_LENGTH(TRIM(nome)) >= 2),
  descricao TEXT,
  categoria_id INTEGER NOT NULL REFERENCES categorias(id),
  estoque_minimo DECIMAL(12, 3) NOT NULL DEFAULT 0 CHECK (estoque_minimo >= 0),
  unidade VARCHAR(3) NOT NULL DEFAULT 'UN' CHECK (unidade IN ('UN', 'CX', 'PCT', 'KG', 'G', 'L', 'ML')),
  possui_validade BOOLEAN NOT NULL DEFAULT FALSE,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lotes (
  id SERIAL PRIMARY KEY,
  produto_id INTEGER NOT NULL REFERENCES produtos(id),
  numero_lote VARCHAR(80) NOT NULL CHECK (CHAR_LENGTH(TRIM(numero_lote)) >= 1),
  fornecedor VARCHAR(150),
  documento VARCHAR(80),
  quantidade_inicial DECIMAL(12, 3) NOT NULL DEFAULT 0,
  quantidade_atual DECIMAL(12, 3) NOT NULL DEFAULT 0 CHECK (quantidade_atual >= 0),
  data_validade DATE,
  localizacao_id INTEGER REFERENCES localizacoes(id) ON DELETE SET NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_lote_produto_numero UNIQUE (produto_id, numero_lote)
);

CREATE TABLE IF NOT EXISTS movimentacoes (
  id SERIAL PRIMARY KEY,
  produto_id INTEGER NOT NULL REFERENCES produtos(id),
  lote_id INTEGER REFERENCES lotes(id) ON DELETE SET NULL,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  destinatario VARCHAR(150),
  destino VARCHAR(150),
  documento VARCHAR(80),
  tipo VARCHAR(10) NOT NULL DEFAULT 'ENTRADA' CHECK (tipo IN ('ENTRADA', 'SAIDA', 'AJUSTE')),
  quantidade DECIMAL(12, 3) NOT NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'CONFIRMADA' CHECK (status IN ('CONFIRMADA', 'CANCELADA')),
  observacao VARCHAR(255),
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_movimentacao_quantidade CHECK (quantidade > 0 OR tipo = 'AJUSTE')
);

CREATE TABLE IF NOT EXISTS integracao_erp_eventos (
  id SERIAL PRIMARY KEY,
  evento_externo_id VARCHAR(120) NOT NULL UNIQUE
    CHECK (CHAR_LENGTH(TRIM(evento_externo_id)) BETWEEN 1 AND 120),
  payload_hash CHAR(64) NOT NULL,
  status VARCHAR(16) NOT NULL CHECK (status IN ('PROCESSANDO', 'CONCLUIDO', 'FALHA')),
  resposta JSONB,
  erro_status INTEGER,
  erro_codigo VARCHAR(80),
  erro_mensagem VARCHAR(255),
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE,
  expira_em TIMESTAMP NOT NULL,
  usado BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auditorias_usuario ON auditorias(usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditorias_data ON auditorias(criado_em);
CREATE INDEX IF NOT EXISTS idx_usuarios_bloqueio ON usuarios(bloqueado_ate);
CREATE INDEX IF NOT EXISTS idx_produtos_ativo ON produtos(ativo);
CREATE INDEX IF NOT EXISTS idx_produtos_categoria ON produtos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_lotes_validade ON lotes(data_validade);
CREATE INDEX IF NOT EXISTS idx_lotes_produto ON lotes(produto_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_data_tipo ON movimentacoes(criado_em, tipo, status);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_produto ON movimentacoes(produto_id);
CREATE INDEX IF NOT EXISTS idx_integracao_erp_status ON integracao_erp_eventos(status, criado_em);
CREATE INDEX IF NOT EXISTS idx_reset_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_reset_usuario ON password_reset_tokens(usuario_id);

CREATE OR REPLACE FUNCTION atualizar_timestamp() RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_usuarios_atualizado_em ON usuarios;
CREATE TRIGGER trg_usuarios_atualizado_em BEFORE UPDATE ON usuarios
FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();
DROP TRIGGER IF EXISTS trg_produtos_atualizado_em ON produtos;
CREATE TRIGGER trg_produtos_atualizado_em BEFORE UPDATE ON produtos
FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();
DROP TRIGGER IF EXISTS trg_lotes_atualizado_em ON lotes;
CREATE TRIGGER trg_lotes_atualizado_em BEFORE UPDATE ON lotes
FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();

INSERT INTO perfis (nome, ativo) VALUES
  ('OPERADOR_ESTOQUE', TRUE),
  ('GERENTE', TRUE),
  ('ADMINISTRADOR', TRUE)
ON CONFLICT (nome) DO NOTHING;

INSERT INTO departamentos (nome, ativo) VALUES
  ('Administração', TRUE),
  ('Produção', TRUE),
  ('Estoque', TRUE),
  ('Clientes', TRUE)
ON CONFLICT (nome) DO NOTHING;

INSERT INTO categorias (nome, ativo) VALUES
  ('Higiene e cuidados', TRUE),
  ('Alimentação', TRUE),
  ('Acessórios', TRUE),
  ('Saúde e bem-estar', TRUE)
ON CONFLICT (nome) DO NOTHING;

INSERT INTO localizacoes (nome, descricao, ativo) VALUES
  ('Estoque principal', 'Área principal de armazenamento', TRUE),
  ('Separação', 'Área de preparação de expedições', TRUE),
  ('Quarentena', 'Itens aguardando conferência', TRUE),
  ('Armazém secundário', 'Área auxiliar de armazenamento', TRUE)
ON CONFLICT (nome) DO NOTHING;

WITH produtos_demo (codigo, nome, descricao, categoria, estoque_minimo, unidade, possui_validade) AS (
  VALUES
    ('DEMO-FRALDA-P', 'Fralda infantil tamanho P', 'Pacote demonstrativo tamanho P', 'Higiene e cuidados', 20, 'PCT', TRUE),
    ('DEMO-FRALDA-M', 'Fralda infantil tamanho M', 'Pacote demonstrativo tamanho M', 'Higiene e cuidados', 25, 'PCT', TRUE),
    ('DEMO-FRALDA-G', 'Fralda infantil tamanho G', 'Pacote demonstrativo tamanho G', 'Higiene e cuidados', 18, 'PCT', TRUE),
    ('DEMO-FRALDA-XG', 'Fralda infantil tamanho XG', 'Pacote demonstrativo tamanho XG', 'Higiene e cuidados', 15, 'PCT', TRUE),
    ('DEMO-LENCO-72', 'Lenço umedecido 72 unidades', 'Pacote de lenços para cuidados diários', 'Higiene e cuidados', 18, 'PCT', TRUE),
    ('DEMO-SHAMPOO', 'Shampoo infantil 200 ml', 'Shampoo suave demonstrativo', 'Higiene e cuidados', 12, 'UN', TRUE),
    ('DEMO-SABONETE', 'Sabonete líquido infantil 200 ml', 'Sabonete líquido demonstrativo', 'Higiene e cuidados', 14, 'UN', TRUE),
    ('DEMO-CREME', 'Creme preventivo 60 g', 'Creme protetor demonstrativo', 'Higiene e cuidados', 10, 'UN', TRUE),
    ('DEMO-ALGODAO', 'Algodão hidrófilo 50 g', 'Algodão para cuidados infantis', 'Higiene e cuidados', 12, 'PCT', TRUE),
    ('DEMO-COTONETE', 'Hastes flexíveis 75 unidades', 'Hastes flexíveis demonstrativas', 'Higiene e cuidados', 10, 'CX', TRUE),
    ('DEMO-FORMULA-1', 'Fórmula infantil etapa 1', 'Lata demonstrativa etapa 1', 'Alimentação', 8, 'UN', TRUE),
    ('DEMO-FORMULA-2', 'Fórmula infantil etapa 2', 'Lata demonstrativa etapa 2', 'Alimentação', 8, 'UN', TRUE),
    ('DEMO-FORMULA-3', 'Fórmula infantil etapa 3', 'Lata demonstrativa etapa 3', 'Alimentação', 6, 'UN', TRUE),
    ('DEMO-MINGAU-ARROZ', 'Cereal infantil de arroz', 'Cereal demonstrativo de arroz', 'Alimentação', 10, 'CX', TRUE),
    ('DEMO-MINGAU-MULTI', 'Cereal infantil multicereais', 'Cereal demonstrativo multicereais', 'Alimentação', 9, 'CX', TRUE),
    ('DEMO-PAPINHA-FRUTA', 'Papinha de frutas', 'Papinha demonstrativa de frutas', 'Alimentação', 12, 'UN', TRUE),
    ('DEMO-MAMADEIRA-150', 'Mamadeira anticólica 150 ml', 'Mamadeira demonstrativa pequena', 'Acessórios', 7, 'UN', FALSE),
    ('DEMO-MAMADEIRA-240', 'Mamadeira anticólica 240 ml', 'Mamadeira demonstrativa média', 'Acessórios', 8, 'UN', FALSE),
    ('DEMO-BICO-SILICONE', 'Bico de silicone fluxo lento', 'Bico demonstrativo para mamadeira', 'Acessórios', 10, 'UN', FALSE),
    ('DEMO-CHUPETA-0', 'Chupeta ortodôntica 0 a 6 meses', 'Chupeta demonstrativa', 'Acessórios', 8, 'UN', FALSE),
    ('DEMO-CHUPETA-6', 'Chupeta ortodôntica 6 a 18 meses', 'Chupeta demonstrativa', 'Acessórios', 8, 'UN', FALSE),
    ('DEMO-PRENDEDOR', 'Prendedor de chupeta', 'Acessório demonstrativo', 'Acessórios', 5, 'UN', FALSE),
    ('DEMO-TOALHA', 'Toalha infantil com capuz', 'Toalha demonstrativa', 'Acessórios', 6, 'UN', FALSE),
    ('DEMO-MANTA', 'Manta infantil algodão', 'Manta demonstrativa', 'Acessórios', 5, 'UN', FALSE),
    ('DEMO-TERMOMETRO', 'Termômetro digital', 'Termômetro demonstrativo', 'Saúde e bem-estar', 4, 'UN', FALSE),
    ('DEMO-SORO', 'Soro fisiológico 100 ml', 'Frasco demonstrativo', 'Saúde e bem-estar', 10, 'UN', TRUE),
    ('DEMO-ASPIRADOR', 'Aspirador nasal infantil', 'Aspirador demonstrativo', 'Saúde e bem-estar', 4, 'UN', FALSE),
    ('DEMO-ESCOVA', 'Escova para mamadeira', 'Escova demonstrativa para higienização', 'Higiene e cuidados', 5, 'UN', FALSE),
    ('DEMO-TROCADOR', 'Trocador portátil', 'Trocador demonstrativo', 'Acessórios', 3, 'UN', FALSE),
    ('DEMO-BOLSA', 'Bolsa maternidade compacta', 'Bolsa demonstrativa', 'Acessórios', 3, 'UN', FALSE)
)
INSERT INTO produtos (codigo, nome, descricao, categoria_id, estoque_minimo, unidade, possui_validade, ativo)
SELECT d.codigo, d.nome, d.descricao, c.id, d.estoque_minimo, d.unidade, d.possui_validade, TRUE
FROM produtos_demo d
INNER JOIN categorias c ON c.nome = d.categoria
ON CONFLICT (codigo) DO NOTHING;

WITH lotes_demo (codigo, quantidade, dias_validade, localizacao) AS (
  VALUES
    ('DEMO-FRALDA-P', 42, NULL, 'Estoque principal'),
    ('DEMO-FRALDA-M', 31, NULL, 'Estoque principal'),
    ('DEMO-FRALDA-G', 12, NULL, 'Estoque principal'),
    ('DEMO-FRALDA-XG', 20, NULL, 'Armazém secundário'),
    ('DEMO-LENCO-72', 9, 120, 'Estoque principal'),
    ('DEMO-SHAMPOO', 15, 180, 'Armazém secundário'),
    ('DEMO-SABONETE', 6, 9, 'Estoque principal'),
    ('DEMO-CREME', 11, 25, 'Estoque principal'),
    ('DEMO-ALGODAO', 18, NULL, 'Armazém secundário'),
    ('DEMO-COTONETE', 12, NULL, 'Estoque principal'),
    ('DEMO-FORMULA-1', 14, 240, 'Estoque principal'),
    ('DEMO-FORMULA-2', 7, 150, 'Estoque principal'),
    ('DEMO-FORMULA-3', 10, 90, 'Armazém secundário'),
    ('DEMO-MINGAU-ARROZ', 16, 200, 'Estoque principal'),
    ('DEMO-MINGAU-MULTI', 8, 60, 'Estoque principal'),
    ('DEMO-PAPINHA-FRUTA', 13, 30, 'Separação'),
    ('DEMO-MAMADEIRA-150', 9, NULL, 'Estoque principal'),
    ('DEMO-MAMADEIRA-240', 12, NULL, 'Estoque principal'),
    ('DEMO-BICO-SILICONE', 20, NULL, 'Armazém secundário'),
    ('DEMO-CHUPETA-0', 11, NULL, 'Estoque principal'),
    ('DEMO-CHUPETA-6', 7, NULL, 'Estoque principal'),
    ('DEMO-PRENDEDOR', 6, NULL, 'Armazém secundário'),
    ('DEMO-TOALHA', 9, NULL, 'Estoque principal'),
    ('DEMO-MANTA', 5, NULL, 'Armazém secundário'),
    ('DEMO-TERMOMETRO', 6, NULL, 'Estoque principal'),
    ('DEMO-SORO', 8, -3, 'Quarentena'),
    ('DEMO-ASPIRADOR', 4, NULL, 'Estoque principal'),
    ('DEMO-ESCOVA', 8, NULL, 'Armazém secundário'),
    ('DEMO-TROCADOR', 4, NULL, 'Estoque principal'),
    ('DEMO-BOLSA', 5, NULL, 'Separação')
)
INSERT INTO lotes (
  produto_id,
  numero_lote,
  fornecedor,
  documento,
  quantidade_inicial,
  quantidade_atual,
  data_validade,
  localizacao_id
)
SELECT
  p.id,
  'DEMO-SEED-' || d.codigo,
  'Fornecedor Demo Babycare',
  'NF-DEMO-' || d.codigo,
  d.quantidade,
  d.quantidade,
  CASE WHEN d.dias_validade IS NULL THEN NULL ELSE CURRENT_DATE + d.dias_validade END,
  loc.id
FROM lotes_demo d
INNER JOIN produtos p ON p.codigo = d.codigo
INNER JOIN localizacoes loc ON loc.nome = d.localizacao
WHERE NOT EXISTS (
  SELECT 1
  FROM lotes existente
  WHERE existente.produto_id = p.id
    AND existente.numero_lote = 'DEMO-SEED-' || d.codigo
);

INSERT INTO movimentacoes (produto_id, lote_id, tipo, quantidade, status, observacao)
SELECT p.id, l.id, 'ENTRADA', l.quantidade_inicial, 'CONFIRMADA', '[DEMO] Carga inicial de demonstração'
FROM produtos p
INNER JOIN lotes l ON l.produto_id = p.id
WHERE l.numero_lote LIKE 'DEMO-SEED-%'
  AND NOT EXISTS (
    SELECT 1
    FROM movimentacoes m
    WHERE m.lote_id = l.id
      AND m.observacao = '[DEMO] Carga inicial de demonstração'
  );

COMMIT;