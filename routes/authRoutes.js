const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');

router.post('/cadastrar', authController.cadastrar);
router.post('/login', authController.login);

// URL final: GET /api/auth/google
router.get('/google', authController.redirecionarGoogle);

// URL final: GET /api/auth/google/callback
router.get('/google/callback', authController.callbackGoogle);

module.exports = router;