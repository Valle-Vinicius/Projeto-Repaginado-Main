-- ============================================
-- BABYCARE - BANCO DE DADOS DE ESTOQUE
-- ============================================

CREATE DATABASE IF NOT EXISTS babycare_estoque
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE babycare_estoque;

-- ============================================
-- USUÁRIOS
-- ============================================
CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    perfil ENUM('operador', 'gerente', 'administrador') NOT NULL DEFAULT 'operador',
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================
-- CATEGORIAS
-- ============================================
CREATE TABLE categorias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    descricao VARCHAR(255),
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- LOCALIZAÇÕES (posição física no estoque)
-- ============================================
CREATE TABLE localizacoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    corredor VARCHAR(20),
    prateleira VARCHAR(20),
    nivel VARCHAR(20),
    descricao VARCHAR(150)
);

-- ============================================
-- PRODUTOS
-- ============================================
CREATE TABLE produtos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo_interno VARCHAR(50) NOT NULL UNIQUE,
    nome VARCHAR(150) NOT NULL,
    marca VARCHAR(100),
    categoria_id INT,
    faixa_etaria VARCHAR(50),
    tamanho VARCHAR(30),
    preco_custo DECIMAL(10,2) NOT NULL DEFAULT 0,
    preco_venda DECIMAL(10,2) NOT NULL DEFAULT 0,
    especial BOOLEAN NOT NULL DEFAULT FALSE,
    observacoes TEXT,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (categoria_id) REFERENCES categorias(id)
);

-- ============================================
-- LOTES (validade + FIFO)
-- ============================================
CREATE TABLE lotes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    produto_id INT NOT NULL,
    localizacao_id INT,
    quantidade INT NOT NULL DEFAULT 0,
    data_entrada DATE NOT NULL,
    data_validade DATE,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (produto_id) REFERENCES produtos(id),
    FOREIGN KEY (localizacao_id) REFERENCES localizacoes(id)
);

-- ============================================
-- MOVIMENTAÇÕES (entradas e saídas)
-- ============================================
CREATE TABLE movimentacoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    produto_id INT NOT NULL,
    lote_id INT,
    usuario_id INT NOT NULL,
    tipo ENUM('entrada', 'saida') NOT NULL,
    quantidade INT NOT NULL,
    data_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
    observacao VARCHAR(255),
    FOREIGN KEY (produto_id) REFERENCES produtos(id),
    FOREIGN KEY (lote_id) REFERENCES lotes(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- ============================================
-- RECEBIMENTOS
-- ============================================
CREATE TABLE recebimentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    produto_id INT NOT NULL,
    usuario_id INT NOT NULL,
    quantidade INT NOT NULL,
    fornecedor VARCHAR(150),
    data_recebimento DATETIME DEFAULT CURRENT_TIMESTAMP,
    observacao VARCHAR(255),
    FOREIGN KEY (produto_id) REFERENCES produtos(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- ============================================
-- EXPEDIÇÕES
-- ============================================
CREATE TABLE expedicoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    produto_id INT NOT NULL,
    usuario_id INT NOT NULL,
    quantidade INT NOT NULL,
    destino VARCHAR(150),
    data_expedicao DATETIME DEFAULT CURRENT_TIMESTAMP,
    observacao VARCHAR(255),
    FOREIGN KEY (produto_id) REFERENCES produtos(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- ============================================
-- AUDITORIA
-- ============================================
CREATE TABLE auditoria (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT,
    acao VARCHAR(150) NOT NULL,
    tabela_afetada VARCHAR(100),
    registro_id INT,
    detalhes TEXT,
    data_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- ============================================
-- USUÁRIO DE TESTE (senha: 12345678)
-- hash gerado com bcrypt, custo 10
-- ============================================
INSERT INTO usuarios (nome, email, senha_hash, perfil)
VALUES ('Teste Dev', 'teste@babycare.com', '$2b$10$SKwi4fZwR9YCgjJrpPZNAevzB2xL4pXtWQsYX7HVocK019VRr.5T2', 'operador');