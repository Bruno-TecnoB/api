const express = require("express");
const amqp = require("amqplib");

const app = express();
app.use(express.json());

// URL RabbitMQ: ajusta com usuário, senha e IP do EC2
const RABBITMQ_URL = "amqp://bruno:123@localhost:5672";
const QUEUE_NAME = "webhooks";

let channel;

// Inicializa conexão e canal
async function initRabbitMQ() {
  const connection = await amqp.connect(RABBITMQ_URL);
  channel = await connection.createChannel();
  await channel.assertQueue(QUEUE_NAME, { durable: true });
  console.log("Conexão com RabbitMQ estabelecida.");
}

// Envia mensagem para fila
function sendToQueue(message) {
  channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)), {
    persistent: true,
  });
}

// Endpoint para receber webhooks do ERP Tiny
app.post("/", (req, res) => {
  try {
    // Caminho do arquivo
    const filePath = path.join(__dirname, "webhook_1_1.json");

    // Lê o conteúdo do JSON
    const fileContent = fs.readFileSync(filePath, "utf-8");

    // Converte para objeto JavaScript
    const webhookData = JSON.parse(fileContent);

    console.log("📂 Requisição carregada do arquivo:", webhookData);

    // Envia para a fila RabbitMQ
    sendToQueue(webhookData);

    res.status(200).send({ status: "Arquivo lido e enviado para a fila" });
  } catch (err) {
    console.error("❌ Erro ao ler o arquivo JSON:", err);
    res.status(500).send({ status: "Erro ao processar arquivo JSON" });
  }
});

// Inicializa RabbitMQ e servidor
initRabbitMQ().then(() => {
  const PORT = 3002;
  app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
});
