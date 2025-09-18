const amqp = require("amqplib");
const bodyParser = require("body-parser");

app.use(bodyParser.json());

// Configurar RabbitMQ
const RABBITMQ_URL = "amqp://bruno:123@localhost:5672";
const QUEUE_NAME = "webhook_queue";
const RETRY_QUEUE = "webhook_retry"; // Fila de retry

let channel;

// Função para conectar ao RabbitMQ e criar filas
async function connectRabbitMQ() {
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();

    // Fila principal
    await channel.assertQueue(QUEUE_NAME, { durable: true });

    // Fila de retry com TTL e DLX
    await channel.assertQueue(RETRY_QUEUE, {
      durable: true,
      arguments: {
        "x-dead-letter-exchange": "", // envia de volta para a fila principal
        "x-dead-letter-routing-key": QUEUE_NAME,
        "x-message-ttl": 20000, // 20 segundos
      },
    });

    console.log(
      "✅ Conectado ao RabbitMQ. Filas:",
      QUEUE_NAME,
      "e",
      RETRY_QUEUE
    );
  } catch (error) {
    console.error("❌ Erro ao conectar no RabbitMQ:", error);
  }
}
connectRabbitMQ();
// Rota para receber o webhook do Tiny
app.post("/", async (req, res) => {
  try {
    const payload = req.body;

    if (!channel) {
      return res.status(500).send("Canal RabbitMQ não inicializado.");
    }

    // Decide para qual fila enviar dependendo do shipment_id
    let filaDestino = QUEUE_NAME;
    if (!payload.shipment_id) {
      filaDestino = RETRY_QUEUE;
      console.log(
        "⚠️ Payload sem shipment_id, enviado para fila de retry:",
        payload
      );
    } else {
      console.log(
        "📥 Webhook recebido e enviado para fila principal:",
        payload
      );
    }

    // Envia a mensagem para a fila correta
    channel.sendToQueue(filaDestino, Buffer.from(JSON.stringify(payload)), {
      persistent: true,
    });

    res.status(200).send("Recebido com sucesso");
  } catch (err) {
    console.error("❌ Erro ao processar webhook:", err);
    res.status(500).send("Erro interno");
  }
});
