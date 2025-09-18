const express = require("express");
const path = require("path");
require("dotenv").config({
  quiet: true,
});

//routes
const integracaoTiny = require("./routes/TinyRouter");
const integracaoML = require("./routes/MercadoLivreRouter");
const ApiMercadolivre = require("./routes/MercadoLivreRouter");
const integracaoMagalu = require("./routes/MagaluRouter");
const integracaoShopee = require("./routes/shopeeRouter");
const webhook = require("./routes/WebhookRouter");
const sequelize = require("./db/conn");

const app = express();

app.use(express.json());
app.use(express.text({ type: "*/*" }));
app.use(express.urlencoded({ extends: true }));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "index.html"));
});

app.get("/integracao/callback/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "callback.html"));
});

//Rotas que são definidas no /ROUTES
app.use(
  "/integracao",
  integracaoTiny,
  integracaoML,
  integracaoMagalu,
  integracaoShopee
);

app.use("/", ApiMercadolivre);

app.use("/webhook", webhook);

// sequelize.sync({ force: true }).then(() => {
sequelize.sync().then(() => {
  app.listen(process.env.PORT, () => {
    console.log("Servidor rodando na porta 5000");
  });
});
