const express = require('express');
const authController = require('../controllers/authController');
const { loginLimiter } = require('../middlewares/rateLimiter');

const router = express.Router();

// Login com rate limiting (5 tentativas a cada 15 min por IP)
router.post('/login', loginLimiter, authController.login);
router.post('/logout', authController.logout);

// Cadastro público DESATIVADO por segurança.
// Para criar usuários, use o módulo /api/usuarios (requer autenticação de gestor).
// A rota /cadastro foi removida para evitar criação de usuários não autorizados.

module.exports = router;