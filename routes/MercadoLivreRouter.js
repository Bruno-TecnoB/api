const express = require("express");
const router = express.Router();
const integracaoML = require("../controllers/MercadoLivreController");

//Rotas para Integrações
router.post("/mercadolivre", integracaoML.criarIntegracaoML);
router.get("/mercadolivre/callback", integracaoML.concluirIntegracaoML);

//Rota para Conexão com API
router.post("/api/webhook", integracaoML.obterDespacho);

module.exports = router;
