-- ============================================================================
-- BABYCARE - SCHEMA COMPLETO + CARGA DEMONSTRATIVA
-- Execute este arquivo inteiro uma única vez no MySQL Workbench.
-- Os KPIs serão calculados a partir dos registros inseridos no banco.
-- ============================================================================
-- Banco de dados do sistema Babycare
-- Compatível com MySQL 8.0+

CREATE DATABASE IF NOT EXISTS babycare
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE babycare;

-- Necessário apenas para os DELETEs controlados dos registros DEMO.
SET SQL_SAFE_UPDATES = 0;

-- Perfis usados pelo token e pela autorização do backend.
CREATE TABLE IF NOT EXISTS perfis (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(50) NOT NULL UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT chk_perfil_nome CHECK (CHAR_LENGTH(TRIM(nome)) >= 3)
);

CREATE TABLE IF NOT EXISTS departamentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(80) NOT NULL UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT chk_departamento_nome CHECK (CHAR_LENGTH(TRIM(nome)) >= 3)
);

-- A senha deve ser armazenada como hash bcrypt gerado pelo backend.
CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  senha_hash VARCHAR(255) NOT NULL,
  perfil_id INT NOT NULL,
  departamento_id INT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  tentativas_login INT NOT NULL DEFAULT 0,
  bloqueado_ate DATETIME NULL,
  ultimo_login_em DATETIME NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_usuario_perfil
    FOREIGN KEY (perfil_id) REFERENCES perfis(id),
  CONSTRAINT fk_usuario_departamento
    FOREIGN KEY (departamento_id) REFERENCES departamentos(id),
  CONSTRAINT chk_usuario_nome CHECK (CHAR_LENGTH(TRIM(nome)) BETWEEN 3 AND 120),
  CONSTRAINT chk_usuario_email CHECK (CHAR_LENGTH(email) BETWEEN 3 AND 255),
  CONSTRAINT chk_usuario_senha_hash CHECK (senha_hash LIKE '$2%'),
  CONSTRAINT chk_usuario_tentativas CHECK (tentativas_login >= 0)
);

-- Registra sucessos e falhas sem armazenar senha, hash ou token.
CREATE TABLE IF NOT EXISTS auditorias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NULL,
  acao VARCHAR(80) NOT NULL,
  entidade VARCHAR(80) NULL,
  entidade_id INT NULL,
  resultado VARCHAR(30) NOT NULL DEFAULT 'SUCESSO',
  detalhes JSON NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_auditoria_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    ON DELETE SET NULL,
  CONSTRAINT chk_auditoria_resultado CHECK (resultado IN ('SUCESSO', 'FALHA'))
);

CREATE INDEX idx_auditorias_usuario ON auditorias(usuario_id);
CREATE INDEX idx_auditorias_data ON auditorias(criado_em);
CREATE INDEX idx_usuarios_bloqueio ON usuarios(bloqueado_ate);

CREATE TABLE IF NOT EXISTS categorias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_categoria_nome CHECK (CHAR_LENGTH(TRIM(nome)) >= 3)
);

CREATE TABLE IF NOT EXISTS localizacoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL UNIQUE,
  descricao VARCHAR(255) NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_localizacao_nome CHECK (CHAR_LENGTH(TRIM(nome)) >= 3)
);

CREATE TABLE IF NOT EXISTS produtos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(50) NOT NULL UNIQUE,
  nome VARCHAR(150) NOT NULL,
  descricao TEXT NULL,
  categoria_id INT NOT NULL,
  estoque_minimo DECIMAL(12, 3) NOT NULL DEFAULT 0,
  unidade ENUM('UN', 'CX', 'PCT', 'KG', 'G', 'L', 'ML') NOT NULL DEFAULT 'UN',
  possui_validade BOOLEAN NOT NULL DEFAULT FALSE,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_produto_categoria
    FOREIGN KEY (categoria_id) REFERENCES categorias(id),
  CONSTRAINT chk_produto_codigo CHECK (CHAR_LENGTH(TRIM(codigo)) >= 1),
  CONSTRAINT chk_produto_nome CHECK (CHAR_LENGTH(TRIM(nome)) >= 2),
  CONSTRAINT chk_produto_estoque_minimo CHECK (estoque_minimo >= 0),
  CONSTRAINT chk_produto_unidade CHECK (unidade IN ('UN', 'CX', 'PCT', 'KG', 'G', 'L', 'ML'))
);

CREATE TABLE IF NOT EXISTS lotes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  produto_id INT NOT NULL,
  numero_lote VARCHAR(80) NOT NULL,
  fornecedor VARCHAR(150) NULL,
  documento VARCHAR(80) NULL,
  quantidade_atual DECIMAL(12, 3) NOT NULL DEFAULT 0,
  data_validade DATE NULL,
  localizacao_id INT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_lote_produto
    FOREIGN KEY (produto_id) REFERENCES produtos(id),
  CONSTRAINT fk_lote_localizacao
    FOREIGN KEY (localizacao_id) REFERENCES localizacoes(id)
    ON DELETE SET NULL,
  CONSTRAINT uq_lote_produto_numero UNIQUE (produto_id, numero_lote),
  CONSTRAINT chk_lote_numero CHECK (CHAR_LENGTH(TRIM(numero_lote)) >= 1),
  CONSTRAINT chk_lote_quantidade CHECK (quantidade_atual >= 0)
);

CREATE TABLE IF NOT EXISTS movimentacoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  produto_id INT NOT NULL,
  lote_id INT NULL,
  usuario_id INT NULL,
  destinatario VARCHAR(150) NULL,
  destino VARCHAR(150) NULL,
  documento VARCHAR(80) NULL,
  tipo ENUM('ENTRADA', 'SAIDA', 'AJUSTE') NOT NULL DEFAULT 'ENTRADA',
  quantidade DECIMAL(12, 3) NOT NULL,
  status ENUM('CONFIRMADA', 'CANCELADA') NOT NULL DEFAULT 'CONFIRMADA',
  observacao VARCHAR(255) NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_movimentacao_produto
    FOREIGN KEY (produto_id) REFERENCES produtos(id),
  CONSTRAINT fk_movimentacao_lote
    FOREIGN KEY (lote_id) REFERENCES lotes(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_movimentacao_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    ON DELETE SET NULL,
  CONSTRAINT chk_movimentacao_quantidade CHECK (quantidade > 0)
);

CREATE INDEX idx_produtos_ativo ON produtos(ativo);
CREATE INDEX idx_produtos_categoria ON produtos(categoria_id);
CREATE INDEX idx_lotes_validade ON lotes(data_validade);
CREATE INDEX idx_lotes_produto ON lotes(produto_id);
CREATE INDEX idx_movimentacoes_data_tipo ON movimentacoes(criado_em, tipo, status);
CREATE INDEX idx_movimentacoes_produto ON movimentacoes(produto_id);

-- Dados básicos necessários para o funcionamento inicial do sistema.
INSERT INTO perfis (nome, ativo)
VALUES
  ('OPERADOR_ESTOQUE', TRUE),
  ('GERENTE', TRUE),
  ('ADMINISTRADOR', TRUE)
ON DUPLICATE KEY UPDATE ativo = TRUE;

INSERT INTO departamentos (nome, ativo)
VALUES
  ('Administração', TRUE),
  ('Produção', TRUE),
  ('Estoque', TRUE),
  ('Clientes', TRUE)
ON DUPLICATE KEY UPDATE ativo = TRUE;

INSERT INTO categorias (nome, ativo)
VALUES
  ('Higiene e cuidados', TRUE),
  ('Alimentação', TRUE),
  ('Acessórios', TRUE)
ON DUPLICATE KEY UPDATE ativo = TRUE;

INSERT INTO localizacoes (nome, descricao, ativo)
VALUES
  ('Estoque principal', 'Área principal de armazenamento', TRUE),
  ('Separação', 'Área de preparação de expedições', TRUE),
  ('Quarentena', 'Itens aguardando conferência', TRUE)
ON DUPLICATE KEY UPDATE
  descricao = VALUES(descricao),
  ativo = TRUE;

-- O cadastro de produtos começa com estoque zero.
-- Entradas devem ser registradas no módulo de Estoque para preservar o histórico.
-- O campo possui_validade orienta o controle de lotes com data de validade.

-- Não existe usuário com senha em texto puro neste arquivo.
-- Para criar um usuário, gere o hash com o backend e insira somente o hash:
-- INSERT INTO usuarios (nome, email, senha_hash, perfil_id, departamento_id)
-- SELECT
--   'Nome do operador',
--   'operador@babycare.com',
--   'HASH_BCRYPT_GERADO_PELO_BACKEND',
--   p.id,
--   d.id
-- FROM perfis p
-- CROSS JOIN departamentos d
-- WHERE p.nome = 'OPERADOR_ESTOQUE'
--   AND d.nome = 'Estoque';

-- ============================================================================

-- CARGA DEMONSTRATIVA

-- ============================================================================
USE babycare;

-- ============================================================================
-- CARGA DE DEMONSTRAÇÃO - SOMENTE DESENVOLVIMENTO/APRESENTAÇÃO
-- ============================================================================
-- Todos os registros usam o prefixo DEMO- e a marca [DEMO].
-- Não execute em produção ou em uma base com operações reais misturadas.
-- A execução é repetível: remove somente os registros criados por este arquivo.
-- ============================================================================

-- Garante as colunas adicionadas pelos módulos de Recebimentos e Expedições.
-- Os blocos só executam ALTER TABLE quando a coluna ainda não existe.
SET @sql = (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE lotes ADD COLUMN fornecedor VARCHAR(150) NULL AFTER numero_lote',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'lotes' AND column_name = 'fornecedor'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE lotes ADD COLUMN documento VARCHAR(80) NULL AFTER fornecedor',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'lotes' AND column_name = 'documento'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE movimentacoes ADD COLUMN destinatario VARCHAR(150) NULL AFTER usuario_id',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'movimentacoes' AND column_name = 'destinatario'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE movimentacoes ADD COLUMN destino VARCHAR(150) NULL AFTER destinatario',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'movimentacoes' AND column_name = 'destino'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE movimentacoes ADD COLUMN documento VARCHAR(80) NULL AFTER destino',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'movimentacoes' AND column_name = 'documento'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

START TRANSACTION;

-- Remove apenas o histórico e os lotes desta carga.
DELETE FROM movimentacoes WHERE observacao LIKE '[DEMO] %';
DELETE FROM lotes WHERE numero_lote LIKE 'DEMO-%';
DELETE FROM produtos WHERE codigo LIKE 'DEMO-%';

-- Garante as categorias e localizações necessárias sem apagar as existentes.
INSERT INTO categorias (nome, ativo) VALUES
  ('Higiene e cuidados', TRUE),
  ('Alimentação', TRUE),
  ('Acessórios', TRUE),
  ('Saúde e bem-estar', TRUE)
ON DUPLICATE KEY UPDATE ativo = TRUE;

INSERT INTO localizacoes (nome, descricao, ativo) VALUES
  ('Estoque principal', 'Área principal de armazenamento', TRUE),
  ('Separação', 'Área de preparação de expedições', TRUE),
  ('Quarentena', 'Itens aguardando conferência', TRUE),
  ('Armazém secundário', 'Área auxiliar de armazenamento', TRUE)
ON DUPLICATE KEY UPDATE descricao = VALUES(descricao), ativo = TRUE;

SET @cat_higiene = (SELECT id FROM categorias WHERE nome = 'Higiene e cuidados' LIMIT 1);
SET @cat_alimentacao = (SELECT id FROM categorias WHERE nome = 'Alimentação' LIMIT 1);
SET @cat_acessorios = (SELECT id FROM categorias WHERE nome = 'Acessórios' LIMIT 1);
SET @cat_saude = (SELECT id FROM categorias WHERE nome = 'Saúde e bem-estar' LIMIT 1);
SET @loc_principal = (SELECT id FROM localizacoes WHERE nome = 'Estoque principal' LIMIT 1);
SET @loc_separacao = (SELECT id FROM localizacoes WHERE nome = 'Separação' LIMIT 1);
SET @loc_secundario = (SELECT id FROM localizacoes WHERE nome = 'Armazém secundário' LIMIT 1);

-- Catálogo demonstrativo com SKUs reservados pelo prefixo DEMO-.
INSERT INTO produtos (codigo, nome, descricao, categoria_id, estoque_minimo, unidade, possui_validade, ativo) VALUES
('DEMO-FRALDA-P','Fralda Babycare tamanho P','Fralda descartável demonstrativa tamanho P',@cat_higiene,40,'UN',TRUE,TRUE),
('DEMO-FRALDA-M','Fralda Babycare tamanho M','Fralda descartável demonstrativa tamanho M',@cat_higiene,50,'UN',TRUE,TRUE),
('DEMO-FRALDA-G','Fralda Babycare tamanho G','Fralda descartável demonstrativa tamanho G',@cat_higiene,45,'UN',TRUE,TRUE),
('DEMO-LENCO-72','Lenço umedecido Babycare 72 unidades','Lenço umedecido para cuidados diários',@cat_higiene,30,'PCT',TRUE,TRUE),
('DEMO-SABONETE','Sabonete líquido infantil 200 ml','Sabonete líquido suave para pele infantil',@cat_higiene,20,'ML',TRUE,TRUE),
('DEMO-FORMULA-1','Fórmula infantil etapa 1','Produto alimentício demonstrativo',@cat_alimentacao,15,'CX',TRUE,TRUE),
('DEMO-FORMULA-2','Fórmula infantil etapa 2','Produto alimentício demonstrativo',@cat_alimentacao,15,'CX',TRUE,TRUE),
('DEMO-MAMADEIRA','Mamadeira anticólica 240 ml','Mamadeira reutilizável',@cat_acessorios,10,'UN',FALSE,TRUE),
('DEMO-CHUPETA','Chupeta ortodôntica','Acessório infantil demonstrativo',@cat_acessorios,12,'UN',FALSE,TRUE),
('DEMO-TERMOMETRO','Termômetro digital','Item de acompanhamento de saúde',@cat_saude,5,'UN',FALSE,TRUE),
('DEMO-CREME','Creme preventivo 60 g','Creme de cuidado da pele',@cat_saude,18,'G',TRUE,TRUE),
('DEMO-ALGODAO','Algodão hidrófilo 50 g','Material de higiene e cuidado',@cat_higiene,20,'G',FALSE,TRUE),
('DEMO-TOALHA','Toalha infantil com capuz','Acessório têxtil demonstrativo',@cat_acessorios,8,'UN',FALSE,TRUE),
('DEMO-ASPIRADOR','Aspirador nasal infantil','Acessório de cuidado infantil',@cat_saude,6,'UN',FALSE,TRUE),
('DEMO-SORO','Soro fisiológico 500 ml','Produto de cuidado com validade',@cat_saude,12,'ML',TRUE,TRUE);

-- Lotes demonstrativos com saldos atuais realistas para a apresentação.
INSERT INTO lotes (produto_id, numero_lote, fornecedor, documento, quantidade_atual, data_validade, localizacao_id) VALUES
((SELECT id FROM produtos WHERE codigo='DEMO-FRALDA-P'),'DEMO-2026-P-01','Fornecedor Demo Saúde','NF-DEMO-1001',95,DATE_ADD(CURDATE(),INTERVAL 18 MONTH),@loc_principal),
((SELECT id FROM produtos WHERE codigo='DEMO-FRALDA-M'),'DEMO-2026-M-01','Fornecedor Demo Saúde','NF-DEMO-1002',130,DATE_ADD(CURDATE(),INTERVAL 18 MONTH),@loc_principal),
((SELECT id FROM produtos WHERE codigo='DEMO-FRALDA-G'),'DEMO-2026-G-01','Fornecedor Demo Saúde','NF-DEMO-1003',22,DATE_ADD(CURDATE(),INTERVAL 18 MONTH),@loc_principal),
((SELECT id FROM produtos WHERE codigo='DEMO-LENCO-72'),'DEMO-2026-L-01','Higiene Distribuidora Demo','NF-DEMO-1004',18,DATE_ADD(CURDATE(),INTERVAL 12 MONTH),@loc_secundario),
((SELECT id FROM produtos WHERE codigo='DEMO-SABONETE'),'DEMO-2026-S-01','Higiene Distribuidora Demo','NF-DEMO-1005',64,DATE_ADD(CURDATE(),INTERVAL 10 MONTH),@loc_principal),
((SELECT id FROM produtos WHERE codigo='DEMO-FORMULA-1'),'DEMO-2026-F1-01','Alimentos Infantis Demo','NF-DEMO-1006',9,DATE_ADD(CURDATE(),INTERVAL 8 MONTH),@loc_principal),
((SELECT id FROM produtos WHERE codigo='DEMO-FORMULA-2'),'DEMO-2026-F2-01','Alimentos Infantis Demo','NF-DEMO-1007',31,DATE_ADD(CURDATE(),INTERVAL 9 MONTH),@loc_principal),
((SELECT id FROM produtos WHERE codigo='DEMO-MAMADEIRA'),'DEMO-2026-MAM-01','Acessórios Baby Demo','NF-DEMO-1008',28,NULL,@loc_secundario),
((SELECT id FROM produtos WHERE codigo='DEMO-CHUPETA'),'DEMO-2026-CH-01','Acessórios Baby Demo','NF-DEMO-1009',7,NULL,@loc_principal),
((SELECT id FROM produtos WHERE codigo='DEMO-TERMOMETRO'),'DEMO-2026-T-01','Saúde Infantil Demo','NF-DEMO-1010',12,NULL,@loc_principal),
((SELECT id FROM produtos WHERE codigo='DEMO-CREME'),'DEMO-2026-C-01','Saúde Infantil Demo','NF-DEMO-1011',16,DATE_ADD(CURDATE(),INTERVAL 14 MONTH),@loc_principal),
((SELECT id FROM produtos WHERE codigo='DEMO-ALGODAO'),'DEMO-2026-A-01','Higiene Distribuidora Demo','NF-DEMO-1012',42,NULL,@loc_secundario),
((SELECT id FROM produtos WHERE codigo='DEMO-TOALHA'),'DEMO-2026-TO-01','Têxtil Infantil Demo','NF-DEMO-1013',14,NULL,@loc_secundario),
((SELECT id FROM produtos WHERE codigo='DEMO-ASPIRADOR'),'DEMO-2026-AS-01','Saúde Infantil Demo','NF-DEMO-1014',4,NULL,@loc_principal),
((SELECT id FROM produtos WHERE codigo='DEMO-SORO'),'DEMO-2026-S-02','Saúde Infantil Demo','NF-DEMO-1015',5,DATE_ADD(CURDATE(),INTERVAL 7 MONTH),@loc_principal);

-- Entradas e saídas marcadas; o saldo final dos lotes acima permanece coerente.
INSERT INTO movimentacoes (produto_id, lote_id, tipo, quantidade, status, observacao, criado_em) VALUES
((SELECT id FROM produtos WHERE codigo='DEMO-FRALDA-P'),(SELECT id FROM lotes WHERE numero_lote='DEMO-2026-P-01'),'ENTRADA',120,'CONFIRMADA','[DEMO] Recebimento inicial do lote P',DATE_SUB(NOW(),INTERVAL 18 DAY)),
((SELECT id FROM produtos WHERE codigo='DEMO-FRALDA-P'),(SELECT id FROM lotes WHERE numero_lote='DEMO-2026-P-01'),'SAIDA',25,'CONFIRMADA','[DEMO] Expedição para unidade Norte',DATE_SUB(NOW(),INTERVAL 3 DAY)),
((SELECT id FROM produtos WHERE codigo='DEMO-FRALDA-M'),(SELECT id FROM lotes WHERE numero_lote='DEMO-2026-M-01'),'ENTRADA',150,'CONFIRMADA','[DEMO] Recebimento inicial do lote M',DATE_SUB(NOW(),INTERVAL 15 DAY)),
((SELECT id FROM produtos WHERE codigo='DEMO-FRALDA-M'),(SELECT id FROM lotes WHERE numero_lote='DEMO-2026-M-01'),'SAIDA',20,'CONFIRMADA','[DEMO] Expedição para unidade Central',DATE_SUB(NOW(),INTERVAL 1 DAY)),
((SELECT id FROM produtos WHERE codigo='DEMO-FRALDA-G'),(SELECT id FROM lotes WHERE numero_lote='DEMO-2026-G-01'),'ENTRADA',60,'CONFIRMADA','[DEMO] Recebimento inicial do lote G',DATE_SUB(NOW(),INTERVAL 12 DAY)),
((SELECT id FROM produtos WHERE codigo='DEMO-FRALDA-G'),(SELECT id FROM lotes WHERE numero_lote='DEMO-2026-G-01'),'SAIDA',38,'CONFIRMADA','[DEMO] Expedição para unidade Sul',DATE_SUB(NOW(),INTERVAL 2 DAY)),
((SELECT id FROM produtos WHERE codigo='DEMO-LENCO-72'),(SELECT id FROM lotes WHERE numero_lote='DEMO-2026-L-01'),'ENTRADA',30,'CONFIRMADA','[DEMO] Recebimento de lenços',DATE_SUB(NOW(),INTERVAL 10 DAY)),
((SELECT id FROM produtos WHERE codigo='DEMO-LENCO-72'),(SELECT id FROM lotes WHERE numero_lote='DEMO-2026-L-01'),'SAIDA',12,'CONFIRMADA','[DEMO] Expedição para unidade Central',DATE_SUB(NOW(),INTERVAL 4 DAY)),
((SELECT id FROM produtos WHERE codigo='DEMO-SABONETE'),(SELECT id FROM lotes WHERE numero_lote='DEMO-2026-S-01'),'ENTRADA',80,'CONFIRMADA','[DEMO] Recebimento de sabonetes',DATE_SUB(NOW(),INTERVAL 9 DAY)),
((SELECT id FROM produtos WHERE codigo='DEMO-SABONETE'),(SELECT id FROM lotes WHERE numero_lote='DEMO-2026-S-01'),'SAIDA',16,'CONFIRMADA','[DEMO] Expedição para unidade Norte',DATE_SUB(NOW(),INTERVAL 5 DAY)),
((SELECT id FROM produtos WHERE codigo='DEMO-FORMULA-1'),(SELECT id FROM lotes WHERE numero_lote='DEMO-2026-F1-01'),'ENTRADA',18,'CONFIRMADA','[DEMO] Recebimento de fórmula etapa 1',DATE_SUB(NOW(),INTERVAL 7 DAY)),
((SELECT id FROM produtos WHERE codigo='DEMO-FORMULA-1'),(SELECT id FROM lotes WHERE numero_lote='DEMO-2026-F1-01'),'SAIDA',9,'CONFIRMADA','[DEMO] Expedição para unidade Central',DATE_SUB(NOW(),INTERVAL 1 DAY)),
((SELECT id FROM produtos WHERE codigo='DEMO-FORMULA-2'),(SELECT id FROM lotes WHERE numero_lote='DEMO-2026-F2-01'),'ENTRADA',40,'CONFIRMADA','[DEMO] Recebimento de fórmula etapa 2',DATE_SUB(NOW(),INTERVAL 6 DAY)),
((SELECT id FROM produtos WHERE codigo='DEMO-FORMULA-2'),(SELECT id FROM lotes WHERE numero_lote='DEMO-2026-F2-01'),'SAIDA',9,'CONFIRMADA','[DEMO] Expedição para unidade Sul',DATE_SUB(NOW(),INTERVAL 2 DAY)),
((SELECT id FROM produtos WHERE codigo='DEMO-MAMADEIRA'),(SELECT id FROM lotes WHERE numero_lote='DEMO-2026-MAM-01'),'ENTRADA',28,'CONFIRMADA','[DEMO] Recebimento de acessórios',DATE_SUB(NOW(),INTERVAL 5 DAY)),
((SELECT id FROM produtos WHERE codigo='DEMO-CHUPETA'),(SELECT id FROM lotes WHERE numero_lote='DEMO-2026-CH-01'),'ENTRADA',7,'CONFIRMADA','[DEMO] Recebimento de acessórios',DATE_SUB(NOW(),INTERVAL 4 DAY)),
((SELECT id FROM produtos WHERE codigo='DEMO-TERMOMETRO'),(SELECT id FROM lotes WHERE numero_lote='DEMO-2026-T-01'),'ENTRADA',12,'CONFIRMADA','[DEMO] Recebimento de termômetros',DATE_SUB(NOW(),INTERVAL 3 DAY)),
((SELECT id FROM produtos WHERE codigo='DEMO-CREME'),(SELECT id FROM lotes WHERE numero_lote='DEMO-2026-C-01'),'ENTRADA',20,'CONFIRMADA','[DEMO] Recebimento de creme',DATE_SUB(NOW(),INTERVAL 2 DAY)),
((SELECT id FROM produtos WHERE codigo='DEMO-CREME'),(SELECT id FROM lotes WHERE numero_lote='DEMO-2026-C-01'),'SAIDA',4,'CONFIRMADA','[DEMO] Expedição para unidade Norte',DATE_SUB(NOW(),INTERVAL 1 DAY)),
((SELECT id FROM produtos WHERE codigo='DEMO-ALGODAO'),(SELECT id FROM lotes WHERE numero_lote='DEMO-2026-A-01'),'ENTRADA',42,'CONFIRMADA','[DEMO] Recebimento de algodão',DATE_SUB(NOW(),INTERVAL 1 DAY)),
((SELECT id FROM produtos WHERE codigo='DEMO-TOALHA'),(SELECT id FROM lotes WHERE numero_lote='DEMO-2026-TO-01'),'ENTRADA',14,'CONFIRMADA','[DEMO] Recebimento têxtil',DATE_SUB(NOW(),INTERVAL 8 DAY)),
((SELECT id FROM produtos WHERE codigo='DEMO-ASPIRADOR'),(SELECT id FROM lotes WHERE numero_lote='DEMO-2026-AS-01'),'ENTRADA',4,'CONFIRMADA','[DEMO] Recebimento de acessórios de saúde',DATE_SUB(NOW(),INTERVAL 6 DAY)),
((SELECT id FROM produtos WHERE codigo='DEMO-SORO'),(SELECT id FROM lotes WHERE numero_lote='DEMO-2026-S-02'),'ENTRADA',8,'CONFIRMADA','[DEMO] Recebimento de soro fisiológico',DATE_SUB(NOW(),INTERVAL 1 DAY)),
((SELECT id FROM produtos WHERE codigo='DEMO-SORO'),(SELECT id FROM lotes WHERE numero_lote='DEMO-2026-S-02'),'SAIDA',3,'CONFIRMADA','[DEMO] Expedição para unidade Central',NOW());

-- Completa os campos de rastreabilidade das saídas demonstrativas.
UPDATE movimentacoes m
INNER JOIN produtos p ON p.id = m.produto_id
SET
  m.destinatario = CASE
    WHEN p.codigo IN ('DEMO-FRALDA-P','DEMO-SABONETE','DEMO-CREME') THEN 'Unidade Babycare Norte'
    WHEN p.codigo IN ('DEMO-FRALDA-M','DEMO-FORMULA-1','DEMO-SORO') THEN 'Unidade Babycare Central'
    ELSE 'Unidade Babycare Sul'
  END,
  m.destino = CASE
    WHEN p.codigo IN ('DEMO-FRALDA-P','DEMO-SABONETE','DEMO-CREME') THEN 'Setor de distribuição Norte'
    WHEN p.codigo IN ('DEMO-FRALDA-M','DEMO-FORMULA-1','DEMO-SORO') THEN 'Setor de distribuição Central'
    ELSE 'Setor de distribuição Sul'
  END,
  m.documento = CONCAT('REQ-DEMO-', LPAD(m.id, 5, '0'))
WHERE m.tipo = 'SAIDA'
  AND m.observacao LIKE '[DEMO] %';

COMMIT;

-- Conferência final.
SELECT COUNT(*) AS produtos_demo FROM produtos WHERE codigo LIKE 'DEMO-%';
SELECT COUNT(*) AS lotes_demo FROM lotes WHERE numero_lote LIKE 'DEMO-%';
SELECT COUNT(*) AS movimentacoes_demo FROM movimentacoes WHERE observacao LIKE '[DEMO] %';

-- Restaura a proteção da sessão após a carga.
SET SQL_SAFE_UPDATES = 1;
