const fs = require("fs");
const amqp = require("amqplib");
// Conectar ao RabbitMQ
const RABBITMQ_URL = "amqp://bruno:123@localhost:5672"; // URL do seu RabbitMQ
const QUEUE_NAME = "webhook_queue";
const RETRY_QUEUE = "webhook_retry"; // Fila de retry

// Função para enviar mensagens para a fila
async function sendToQueue(messages, toRetry = false) {
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();

    // Garante que as filas existam
    await channel.assertQueue(QUEUE_NAME, { durable: true });
    await channel.assertQueue(RETRY_QUEUE, {
      durable: true,
      arguments: {
        "x-dead-letter-exchange": "", // volta para exchange default
        "x-dead-letter-routing-key": QUEUE_NAME, // redireciona para fila principal
        "x-message-ttl": 60000, // 1 minuto em ms
      },
    });

    // Decide para qual fila enviar
    const targetQueue = toRetry ? RETRY_QUEUE : QUEUE_NAME;

    messages.forEach((msg) => {
      const messageBuffer = Buffer.from(JSON.stringify(msg));
      channel.sendToQueue(targetQueue, messageBuffer, { persistent: true });
      console.log(`📤 Mensagem enviada para ${targetQueue}:`, msg);
    });

    await channel.close();
    await connection.close();
  } catch (error) {
    console.error("Erro ao enviar para a fila:", error);
  }
}

// Ler arquivo JSON
fs.readFile("webhook_1_1.json", "utf8", (err, data) => {
  if (err) {
    console.error("Erro ao ler o arquivo:", err);
    return;
  }

  try {
    const jsonData = JSON.parse(data);

    // Se JSON vazio → manda para retry
    if (
      !jsonData ||
      (Array.isArray(jsonData) && jsonData.length === 0) ||
      (typeof jsonData === "object" && Object.keys(jsonData).length === 0)
    ) {
      console.log("⚠️ JSON vazio, enviando para retry...");
      sendToQueue([{}], true); // manda objeto vazio só para ocupar a mensagem
      // Se for array → manda cada item
    } else if (Array.isArray(jsonData)) {
      sendToQueue(jsonData);
    } else {
      sendToQueue([jsonData]);
    }
  } catch (parseErr) {
    console.error("Erro ao parsear JSON:", parseErr);
  }
});
