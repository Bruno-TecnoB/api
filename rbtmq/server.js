const fs = require("fs");
const amqp = require("amqplib");

// Conectar ao RabbitMQ
const RABBITMQ_URL = "amqp://bruno:123@localhost:5672";
const QUEUE_NAME = "webhook_queue";
const RETRY_QUEUE = "webhook_retry"; // Fila de retry
const FILE_NAME = "webhook_1_1.json"; // Arquivo JSON

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
        "x-dead-letter-exchange": "",
        "x-dead-letter-routing-key": QUEUE_NAME,
        "x-message-ttl": 20000, // 20 segundos
      },
    });

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

// Função para processar o arquivo JSON
function processFile() {
  fs.readFile(FILE_NAME, "utf8", (err, data) => {
    if (err) {
      console.error("Erro ao ler o arquivo:", err);
      return;
    }

    // Arquivo vazio → enviar para fila de retry
    if (!data || data.trim() === "") {
      console.log("⚠️ Arquivo JSON vazio, enviando para retry...");
      sendToQueue([{}], true);
      return;
    }

    // Arquivo com conteúdo → parsear e enviar para fila principal
    try {
      const jsonData = JSON.parse(data);
      if (Array.isArray(jsonData)) {
        sendToQueue(jsonData);
      } else {
        sendToQueue([jsonData]);
      }
    } catch (parseErr) {
      console.error("Erro ao parsear JSON:", parseErr);
    }
  });
}

// Executa imediatamente na inicialização
processFile();

// Executa a cada 20 segundos
setInterval(() => {
  processFile();
}, 20000);
