const amqp = require("amqplib");
const fs = require("fs");

async function startConsumer() {
  const connection = await amqp.connect("amqp://tecnobil.dev/api");
  const channel = await connection.createChannel();
  const queue = "cadastros";

  await channel.assertQueue(queue, { durable: true });
  console.log("📥 Aguardando cadastros...");

  channel.consume(queue, (msg) => {
    const cadastro = msg.content.toString();
    console.log("✅ Recebido:", cadastro);

    // grava em arquivo .txt
    fs.appendFileSync("cadastros.txt", cadastro + "\n");

    channel.ack(msg);
  });
}

startConsumer();