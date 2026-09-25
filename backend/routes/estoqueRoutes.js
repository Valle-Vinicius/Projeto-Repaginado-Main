const express = require('express');
const estoqueController = require('../controllers/estoqueController');
const { verificarToken, permitirPerfis } = require('../middlewares/authMiddleware');
const { PERFIS_ESTOQUE } = require('../services/estoqueService');

const router = express.Router();

router.use(verificarToken, permitirPerfis(...PERFIS_ESTOQUE));
router.get('/', estoqueController.obterEstoque);
router.post('/movimentacoes', estoqueController.registrarMovimentacao);

module.exports = router;
