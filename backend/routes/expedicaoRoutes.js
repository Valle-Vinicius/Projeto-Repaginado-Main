const express = require('express');
const estoqueController = require('../controllers/estoqueController');
const { verificarToken, permitirPerfis } = require('../middlewares/authMiddleware');
const { PERFIS_ESTOQUE } = require('../services/estoqueService');

const router = express.Router();
const autorizarEstoque = permitirPerfis(...PERFIS_ESTOQUE);

router.get('/', verificarToken, autorizarEstoque, estoqueController.listarExpedicoes);
router.post('/', verificarToken, autorizarEstoque, estoqueController.registrarMovimentacao);

module.exports = router;
