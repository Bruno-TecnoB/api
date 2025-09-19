const { connectRabbitMQ } = require("./rabbitmq");
const { QUEUE_NAME, RETRY_QUEUE } = require("./rabbitmq");
const { processarPayload } = require("./controllers/MercadoLivreController");

async function consumerStart(res) {
  try {
    const channel = await connectRabbitMQ();
    console.log("Aguardando mensagens na fila:", QUEUE_NAME);

    channel.consume(
      QUEUE_NAME,
      async (msg) => {
        if (!msg) return;

        const body = JSON.parse(msg.content.toString());
        // console.log("Body_consumer: ", body);
        try {
          const result = await processarPayload({ body }, res);
          console.log("Mensagem processada pelo consumer:", result);
          channel.ack(msg);
        } catch (err) {
          console.error("Erro ao processar mensagem:", err.message);
          channel.nack(msg, false, false);

          await channel.sendToQueue(RETRY_QUEUE, msg.content, {
            persistent: true,
          });
        }
      },
      { noAck: false }
    );
  } catch (err) {
    console.error("Erro no consumer:", err);
  }
}

consumerStart();
