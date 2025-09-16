const amqp = require('amqplib');
// Conectar ao RabbitMQ via AMQP
const RABBITMQ_URL = 'amqp://admin:sua_senha_forte@localhost:5672';
const QUEUE_NAME = 'webhooks';
// Iniciar consumer e criar conexão e canal persistente
async function startConsumer() {
  const connection = await amqp.connect(RABBITMQ_URL);
  const channel = await connection.createChannel();
  await channel.assertQueue(QUEUE_NAME, { durable: true });

  console.log('Aguardando mensagens na fila...');

  channel.prefetch(5); // Processa até 5 mensagens por vez
  // Lê mensagens e converte para JSON
  channel.consume(QUEUE_NAME, async (msg) => {
    if (msg) {
      const data = JSON.parse(msg.content.toString());
      console.log('Processando mensagem:', data);

      try {
        // Aqui processa os dados, ex: gravar no RDS
        // await gravarNoRDS(data);

        // Confirma processamento e remove da fila
        channel.ack(msg);
      } catch (err) {
        console.error('Erro ao processar mensagem:', err);
        channel.nack(msg, false, true); // Reenvia à fila
      }
    }
  }, { noAck: false });
}

startConsumer();