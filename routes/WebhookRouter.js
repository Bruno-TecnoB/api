const express = require("express");
const router = express.Router();
const WebhookController = require("../controllers/WebhookController");

router.post("/integracao/tiny/", WebhookController.WebhookTiny);

module.exports = router;
