const fs = require("fs");
const amqp = require("amqplib");

const RABBITMQ_URL = "amqp://bruno:123@localhost:5672"; // URL do seu RabbitMQ
const QUEUE_NAME = "webhook_queue";

// Função para enviar mensagens
async function sendToQueue(messages) {
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();
    await channel.assertQueue(QUEUE_NAME, { durable: true });

    messages.forEach((msg) => {
      const messageBuffer = Buffer.from(JSON.stringify(msg));
      channel.sendToQueue(QUEUE_NAME, messageBuffer, { persistent: true });
      console.log("Mensagem enviada:", msg);
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
    // Se o JSON for um array, envia cada item
    if (Array.isArray(jsonData)) {
      sendToQueue(jsonData);
    } else {
      sendToQueue([jsonData]);
    }
  } catch (parseErr) {
    console.error("Erro ao parsear JSON:", parseErr);
  }
});
