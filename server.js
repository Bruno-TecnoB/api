const amqp = require("amqplib");
const bodyParser = require("body-parser");

app.use(bodyParser.json());

// Configurações RabbitMQ
const RABBITMQ_URL = "amqp://bruno:123@localhost:5672";
const QUEUE_NAME = "webhook_queue";
const RETRY_QUEUE = "webhook_retry";

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

connectRabbitMQ();

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
