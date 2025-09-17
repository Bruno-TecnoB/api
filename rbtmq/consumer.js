const fs = require("fs");
const amqp = require("amqplib");

// URL RabbitMQ: ajusta com usuário, senha e IP do EC2
const RABBITMQ_URL = "amqp://bruno:123@localhost:5672";
const QUEUE_NAME = "webhook_queue";
const RETRY_QUEUE = "webhook_retry"; // fila de retry
const FILE_NAME = "requisicoes.txt";

// Inicializa conexão e canal
async function startConsumer() {
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();
    console.log("Aguardando mensagens...");
    // Garante que as filas existam
    await channel.assertQueue(QUEUE_NAME, { durable: true });
    await channel.assertQueue(RETRY_QUEUE, {
      durable: true,
      arguments: {
        "x-dead-letter-exchange": "",
        "x-dead-letter-routing-key": QUEUE_NAME,
        "x-message-ttl": 20000,
      },
    });

    console.log("✅ Aguardando mensagens na fila:", QUEUE_NAME);
    // Recebe mensagens da fila e transforma de "buffer binário" para string
    channel.consume(QUEUE_NAME, (msg) => {
      if (msg !== null) {
        const messageContent = msg.content.toString();
        let parsed;

        try {
          parsed = JSON.parse(messageContent);
        } catch (err) {
          console.error("❌ Erro ao parsear JSON:", err);
          channel.ack(msg);
          return;
        }

        // 1 - Checa se mensagem está vazia
        const isEmpty =
          !parsed ||
          (Array.isArray(parsed) && parsed.length === 0) ||
          (typeof parsed === "object" && Object.keys(parsed).length === 0);

        if (isEmpty) {
          console.log("⚠️ Mensagem vazia, enviando para retry...");
          channel.sendToQueue(RETRY_QUEUE, Buffer.from(messageContent), {
            persistent: true,
          });
          channel.ack(msg); // confirma que tratamos a mensagem
          return;
        }

        // 2 - Se não estiver vazia → processa normalmente
        console.log("📩 Mensagem recebida:", messageContent);

        fs.appendFile(FILE_NAME, messageContent + "\n", (err) => {
          if (err) console.error("❌ Erro ao escrever no arquivo:", err);
        });

        channel.ack(msg); // confirma processamento
      }
    });
  } catch (error) {
    console.error("Erro no consumer:", error);
  }
}

startConsumer();
