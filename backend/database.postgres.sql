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

COMMIT;