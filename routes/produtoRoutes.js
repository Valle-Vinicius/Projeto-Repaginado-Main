const express = require('express');

const router = express.Router();

const produtoController = require('../controllers/produtoController');

router.get('/', produtoController.listar);
router.post('/', produtoController.cadastrar);
router.get('/:id', produtoController.buscarPorId);
router.put('/:id', produtoController.atualizar);
router.delete('/:id', produtoController.remover);

module.exports = router;