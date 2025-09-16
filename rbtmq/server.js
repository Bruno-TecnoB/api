const express = require('express');
const amqp = require('amqplib');

const app = express();
app.use(express.json());

// URL RabbitMQ: ajusta com usuário, senha e IP do EC2
const RABBITMQ_URL = 'amqp://admin:sua_senha_forte@localhost:5672';
const QUEUE_NAME = 'webhooks';

let channel;

// Inicializa conexão e canal
async function initRabbitMQ() {
  const connection = await amqp.connect(RABBITMQ_URL);
  channel = await connection.createChannel();
  await channel.assertQueue(QUEUE_NAME, { durable: true });
  console.log('Conexão com RabbitMQ estabelecida.');
}

// Envia mensagem para fila
function sendToQueue(message) {
  channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)), { persistent: true });
}

// Endpoint para receber webhooks do ERP Tiny
app.post('/webhook', (req, res) => {
  const webhookData = req.body;
  console.log('Webhook recebido:', webhookData);

  sendToQueue(webhookData);

  res.status(200).send({ status: 'Recebido e enfileirado' });
});

// Inicializa RabbitMQ e servidor
initRabbitMQ().then(() => {
  const PORT = 3000;
  app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
});