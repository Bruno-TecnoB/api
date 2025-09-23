const express = require("express");
const router = express.Router();
const ShopeeController = require("../controllers/ShopeeController");

router.post("/shopee", ShopeeController.ShopeeAuthUrl);
router.post("/obter_refresh_token", ShopeeController.RenovarAccessToken);
router.get("/shopee/concluir", ShopeeController.concluirIntegracaoShopee);
router.post("/DataDespacho", ShopeeController.DataDespacho);

module.exports = router;
