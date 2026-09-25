const express = require('express');
const produtoController = require('../controllers/produtoController');
const { verificarToken, permitirPerfis } = require('../middlewares/authMiddleware');
const { PERFIS_PRODUTO } = require('../services/produtoService');

const router = express.Router();
const autorizarProdutos = permitirPerfis(...PERFIS_PRODUTO);

router.get('/categorias', verificarToken, autorizarProdutos, produtoController.listarCategorias);
router.get('/', verificarToken, autorizarProdutos, produtoController.listarProdutos);
router.post('/', verificarToken, autorizarProdutos, produtoController.criarProduto);

module.exports = router;
