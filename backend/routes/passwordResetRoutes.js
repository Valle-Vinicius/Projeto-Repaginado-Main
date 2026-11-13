const express = require('express');
const controller = require('../controllers/passwordResetController');
const router = express.Router();

// Esqueci senha (público)
router.post('/esqueci-senha', controller.solicitar);

// Redefinir senha (público, com token)
router.post('/redefinir-senha', controller.redefinir);

module.exports = router;
