const express = require("express");
const amqp = require("amqplib");
const bodyParser = require("body-parser");
const path = require("path");
require("dotenv").config({
  quiet: true,
});

const { QUEUE_NAME, RETRY_QUEUE } = require("./shared/constants/rabbitmq");
console.log("QUEUE_NAME:", QUEUE_NAME, "RETRY_QUEUE:", RETRY_QUEUE);

//routes
const integracaoTiny = require("./routes/TinyRouter");
// const integracaoML = require("./routes/MercadoLivreRouter");
//const ApiMercadolivre = require("./routes/MercadoLivreRouter");
const integracaoMagalu = require("./routes/MagaluRouter");
const integracaoShopee = require("./routes/ShopeeRouter");
const webhook = require("./routes/WebhookRouter");
const sequelize = require("./db/conn");

const app = express();

app.use(express.json());
app.use(express.text({ type: "*/*" }));
app.use(express.urlencoded({ extends: true }));
app.use(bodyParser.json());

// Configurações RabbitMQ
const RABBITMQ_URL = "amqp://bruno:123@localhost:5672";
let channel;

// Função para conectar e configurar filas
async function connectRabbitMQ() {
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();

    // Fila principal
    await channel.assertQueue(QUEUE_NAME, { durable: true });

    // Fila de retry com TTL de 5 minutos (300000 ms) e DLX para a principal
    await channel.assertQueue(RETRY_QUEUE, {
      durable: true,
      arguments: {
        "x-dead-letter-exchange": "",
        "x-dead-letter-routing-key": QUEUE_NAME,
        "x-message-ttl": 300000, // 5 minutos
      },
    });

    console.log("✅ RabbitMQ conectado. Filas:", QUEUE_NAME, "e", RETRY_QUEUE);
  } catch (error) {
    console.error("❌ Erro ao conectar no RabbitMQ:", error);
  }
}

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
  // integracaoML,
  integracaoMagalu,
  integracaoShopee
);

//app.use("/", ApiMercadolivre);

app.use("/webhook", webhook);

// Rota do webhook: envia tudo para a fila principal
app.post("/", (req, res) => {
  try {
    const payload = req.body;

    if (!channel) {
      return res.status(500).send("Canal RabbitMQ não inicializado.");
    }

    channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(payload)), {
      persistent: true,
    });

    console.log(
      "📥 Webhook recebido e enviado para a fila principal:",
      payload
    );
    res.status(200).send("Recebido com sucesso");
  } catch (err) {
    console.error("❌ Erro ao processar webhook:", err);
    res.status(500).send("Erro interno");
  }
});

connectRabbitMQ();

// sequelize.sync({ force: true }).then(() => {
sequelize.sync().then(() => {
  app.listen(process.env.PORT, () => {
    console.log("Servidor rodando na porta 5000");
  });
});

module.exports = { connectRabbitMQ };
