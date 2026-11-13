const express = require('express');
const controller = require('../controllers/integracaoErpController');
const { verificarChaveERP } = require('../middlewares/erpApiKeyMiddleware');

const router = express.Router();

router.use(verificarChaveERP);
router.get('/produtos', controller.listarProdutos);
router.post('/movimentacoes', controller.registrarMovimentacao);

module.exports = router;
