const express = require("express");
const validadeController = require("../controllers/validadeController");
const {
  verificarToken,
  permitirPerfis,
} = require("../middlewares/authMiddleware");

const router = express.Router();
const perfisEstoque = ["OPERADOR_ESTOQUE", "GERENTE", "ADMINISTRADOR"];

router.get(
  "/",
  verificarToken,
  permitirPerfis(...perfisEstoque),
  validadeController.listar,
);

module.exports = router;
