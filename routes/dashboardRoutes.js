const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const {
  verificarToken,
  permitirPerfis
} = require('../middlewares/authMiddleware');

const router = express.Router();

const PERFIS_DASHBOARD = [
  'OPERADOR_ESTOQUE',
  'GERENTE',
  'ADMINISTRADOR'
];

router.get(
  '/',
  verificarToken,
  permitirPerfis(...PERFIS_DASHBOARD),
  dashboardController.obterDashboard
);

module.exports = router;
