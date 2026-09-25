const express = require('express');
const { verificarToken, permitirPerfis } = require('../middlewares/authMiddleware');
const controller = require('../controllers/relatorioController');

const router = express.Router();

router.get('/', verificarToken, permitirPerfis('OPERADOR_ESTOQUE', 'GERENTE', 'ADMINISTRADOR'), controller.consultar);

module.exports = router;