const express = require("express");
const {
  verificarToken,
  permitirPerfis,
} = require("../middlewares/authMiddleware");
const auditoriaController = require("../controllers/auditoriaController");

const router = express.Router();

router.use((req, res, next) => {
  res.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

router.get(
  "/",
  verificarToken,
  permitirPerfis("OPERADOR_ESTOQUE", "GERENTE", "ADMINISTRADOR"),
  auditoriaController.listar,
);

module.exports = router;
