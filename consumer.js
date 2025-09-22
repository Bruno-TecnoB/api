const { connectRabbitMQ } = require("./rabbitmq");
const { QUEUE_NAME, RETRY_QUEUE } = require("./rabbitmq");
const { processarPayload } = require("./controllers/MercadoLivreController");
const fs = require("fs");
const path = require("path");

const ERROR_FILE = path.join(__dirname, "payloads_erro.json");
const MAX_ATTEMPTS = 3;

function saveErrorPayload(payload) {
  let errors = [];
  if (fs.existsSync(ERROR_FILE)) {
    errors = JSON.parse(fs.readFileSync(ERROR_FILE, "utf8"));
  }
  errors.push(payload);
  fs.writeFileSync(ERROR_FILE, JSON.stringify(errors, null, 2));
}

async function consumerStart(res) {
  try {
    const channel = await connectRabbitMQ();
    // console.log("Aguardando mensagens na fila:", QUEUE_NAME);

    channel.consume(
      QUEUE_NAME,
      async (msg) => {
        if (!msg) return;

        const body = JSON.parse(msg.content.toString());
        let tentativas = body.tentativas;
        tentativas = tentativas + 1;
        body.tentativas = tentativas;

        if (body.tentativas > MAX_ATTEMPTS) {
          console.log(
            "Máximo de tentativas alcançado. Salvando payload de erro."
          );
          saveErrorPayload(body);
          channel.ack(msg);
          return;
        }

        try {
          await processarPayload({ body }, res);
          channel.ack(msg);
        } catch (err) {
          console.error(`Erro ao processar mensagem: ${err.message}`);
        }
      },
      { noAck: false }
    );
  } catch (err) {
    console.error("Erro no consumer:", err);
  }
}

consumerStart();

module.exports = { consumerStart };
