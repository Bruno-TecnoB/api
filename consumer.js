const amqp = require("amqplib");

// URL RabbitMQ: ajusta com usuário, senha e IP do EC2
const RABBITMQ_URL = "amqp://bruno:123@localhost:5672";
const QUEUE_NAME = "webhook_queue";

// Inicializa conexão e canal
async function startConsumer() {
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();
    console.log("Aguardando mensagens...");
    // Garante que a fila exista
    await channel.assertQueue(QUEUE_NAME, { durable: true });

    console.log("✅ Aguardando mensagens na fila:", QUEUE_NAME);
    // Recebe mensagens da fila e transforma de "buffer binário" para string JSON
    channel.consume(
      QUEUE_NAME,
      (msg) => {
        if (msg) {
          // Converte buffer para JSON
          const payload = JSON.parse(msg.content.toString());

          console.log("📩 Payload convertido para JSON:", payload);

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
