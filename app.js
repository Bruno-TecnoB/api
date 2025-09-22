const express = require("express");
const bodyParser = require("body-parser");
require("dotenv").config({ quiet: true });
const { connectRabbitMQ, QUEUE_NAME } = require("./rabbitmq");
const EnviosColeta = require("./routes/ColetaRouter");
const sequelize = require("./db/conn");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Conexão RabbitMQ antes de iniciar o servidor
(async () => {
  try {
    channel = await connectRabbitMQ();

    // Inicializa servidor só depois de conectar RabbitMQ
    await sequelize.sync();
    app.listen(process.env.PORT || 5000, () => {
      console.log("Servidor rodando na porta 5000");
    });
  } catch (err) {
    console.error("Erro ao inicializar RabbitMQ:", err);
  }
})();

// Endpoint que recebe webhook
app.post("/", async (req, res) => {
  if (!req.body) {
    console.log("o Payload veio Vazio no APP.js");
    return res.status(200).send();
  }

  try {
    if (!channel)
      return res.status(500).send("Canal RabbitMQ não inicializado.");

    const payload = req.body;

    payload.tentativas = 1;
    channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(payload)), {
      persistent: true,
    });
    res.status(200).send({ Payload: payload });
  } catch (err) {
    console.error("Erro ao processar webhook:", err);
    res.status(500).send("Erro interno");
  }
});

app.use("/", EnviosColeta);

const consumer = require("./consumer");

module.exports = { app };
