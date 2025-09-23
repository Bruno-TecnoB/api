const amqp = require("amqplib");
const QUEUE_NAME = "main_queue";
const RETRY_QUEUE = "retry_queue";
const RABBITMQ_URL = "amqp://guest:guest@localhost:5672";
const RETRY_TTL = 20000;

let channel;

async function connectRabbitMQ() {
  if (channel) return channel;

  const connection = await amqp.connect(RABBITMQ_URL);
  channel = await connection.createChannel();

  // Fila principal
  await channel.assertQueue(QUEUE_NAME, { durable: true });

  // Fila de retry
  await channel.assertQueue(RETRY_QUEUE, {
    durable: true,
    arguments: {
      "x-dead-letter-exchange": "",
      "x-dead-letter-routing-key": QUEUE_NAME,
      "x-message-ttl": RETRY_TTL,
    },
  });

  return channel;
}
console.log("RabbitMQ conectado nas filas:", QUEUE_NAME, RETRY_QUEUE);

module.exports = {
  QUEUE_NAME,
  RETRY_QUEUE,
  RABBITMQ_URL,
  RETRY_TTL,
  connectRabbitMQ,
};
