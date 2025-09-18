const amqp = require("amqplib");
const controller = require("./controllers/MercadoLivreController");

// URL RabbitMQ: ajusta com usuário, senha e IP do EC2
const RABBITMQ_URL = "amqp://bruno:123@localhost:5672";
const QUEUE_NAME = "webhook_queue";
const RETRY_QUEUE = "webhook_retry";
// Inicializa conexão e canal
async function startConsumer() {
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();
    console.log("Aguardando mensagens...");
    // Garante que a fila exista
    await channel.assertQueue(QUEUE_NAME, { durable: true });
    await channel.assertQueue(RETRY_QUEUE, {
      durable: true,
      arguments: {
        "x-dead-letter-exchange": "",
        "x-dead-letter-routing-key": QUEUE_NAME,
        "x-message-ttl": 300000, // 5 minutos
      },
    });

    console.log("✅ Aguardando mensagens na fila:", QUEUE_NAME);
    // Recebe mensagens da fila e transforma de "buffer binário" para string JSON
    channel.consume(
      QUEUE_NAME,
      (msg) => {
        if (msg) {
          controller.obterDespacho({
            body: JSON.parse(msg.content.toString()),
          });
          // Confirma processamento
          channel.ack(msg);
        }
      },
      { noAck: false } // garante que a mensagem só é removida após o ack
    );
  } catch (err) {
    console.error("❌ Erro no consumer:", err);
  }
}

startConsumer();
