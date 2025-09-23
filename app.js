const express = require("express");
const bodyParser = require("body-parser");
require("dotenv").config({ quiet: true });
const { connectRabbitMQ, QUEUE_NAME } = require("./rabbitmq");
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

// Endpoint que recebe webhooks
app.post("/", async (req, res) => {
  try {
    if (!channel)
      return res.status(500).send("Canal RabbitMQ não inicializado.");

    const payload = req.body;

    if (!payload || Object.keys(payload).length === 0) {
      console.log("Webhook de Teste recebido");
      return res.sendStatus(200);
    }

    payload.tentativas = 0;
    channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(payload)), {
      persistent: true,
    });
    res.status(200).send();
  } catch (err) {
    console.error("Erro ao processar webhook:", err);
    res.status(500).send("Erro interno");
  }
});

const consumerStart = require("./consumer");
