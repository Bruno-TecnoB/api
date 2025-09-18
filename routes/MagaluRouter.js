const express = require("express");
const router = express.Router();
const integracaoMagalu = require("../controllers/MagaluController");

router.post("/magalu", integracaoMagalu.criarIntegracaoMagalu);
router.get("/magalu/", integracaoMagalu.concluirIntegracaoMagalu);

module.exports = router;
