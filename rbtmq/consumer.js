const fs = require("fs");
const amqp = require("amqplib");

// URL RabbitMQ: ajusta com usuário, senha e IP do EC2
const RABBITMQ_URL = "amqp://bruno:123@localhost:5672";
const QUEUE_NAME = "webhook_queue";
const FILE_NAME = "requisicoes.txt";

// Inicializa conexão e canal
async function startConsumer() {
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();
    console.log("Aguardando mensagens...");
    // Recebe mensagens da fila e transforma de "buffer binário" para string
    channel.consume(QUEUE_NAME, (msg) => {
      if (msg !== null) {
        const messageContent = msg.content.toString();
        console.log("Mensagem recebida:", messageContent);

        // Gravar no arquivo requisicoes.txt
        fs.appendFile(FILE_NAME, messageContent + "\n", (err) => {
          if (err) console.error("Erro ao escrever no arquivo:", err);
        });

        channel.ack(msg); // Confirma que a mensagem foi processada
      }
    });
  } catch (error) {
    console.error("Erro no consumer:", error);
  }
}

startConsumer();
