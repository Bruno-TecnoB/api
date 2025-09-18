const express = require("express");
const router = express.Router();
const ShopeeController = require("../controllers/ShopeeController");

router.post("/shopee", ShopeeController.ShopeeAuthUrl);
router.get("/shopee/concluir", ShopeeController.concluirIntegracaoShopee);

module.exports = router;
