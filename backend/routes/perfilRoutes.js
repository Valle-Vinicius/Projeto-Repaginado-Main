const express = require("express");
const { verificarToken } = require("../middlewares/authMiddleware");
const controller = require("../controllers/perfilController");
const router = express.Router();
router.get("/", verificarToken, controller.obter);
router.patch("/", verificarToken, controller.atualizar);
module.exports = router;
