// routes/estoqueRoutes.js
// define os caminhos do estoque
// e envia cada requisicao para o controller.

const express = require('express');
const router = express.Router();

const estoqueController = require('../controllers/estoqueController');

// listar todo o estoque
router.get('/', estoqueController.listarEstoque);

// produtos especiais
router.get('/especiais', estoqueController.listarProdutosEspeciais);

// produtos proximos do vencimento
router.get('/validade', estoqueController.listarProximosDoVencimento);

// produtos vencidos
router.get('/vencidos', estoqueController.listarVencidos);

// FIFO de um produto
router.get('/fifo/:produtoId', estoqueController.listarFIFO);

// estoque de um produto
router.get('/produto/:id', estoqueController.buscarEstoquePorProduto);

// lotes de um produto
router.get('/produto/:id/lotes', estoqueController.listarLotesPorProduto);

module.exports = router;
