const express = require("express");
const router = express.Router();
const Coletas = require("../controllers/ColetaController");

router.get("/corte", Coletas.EnviosColeta);

module.exports = router;
