const express = require("express");
const router = express.Router();
const integracaoTiny = require("../controllers/TinyController");

router.post("/tiny", integracaoTiny.criarIntegracao);
router.get("/tiny/callback", integracaoTiny.concluirIntegracao);

module.exports = router;
