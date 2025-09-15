const express = require("express");
const path = require("path");
const fs = require("fs");
const amqp = require("amqplib");
const redis = require("redis");

let redisClient;

async function connectRedis() {
  redisClient = redis.createClient(); // assume localhost:6379
  redisClient.on("error", (err) => console.error("Redis Client Error", err));

  await redisClient.connect();
  console.log("✅ Conectado ao Redis!");
}

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let channel;
async function connectRabbitMQ() {
  try {
    const connection = await amqp.connect({
      protocol: "amqp",
      hostname: "localhost",
      port: 5672,
      username: "guest",
      password: "guest",
    });

    channel = await connection.createChannel();
    await channel.assertQueue("cadastros", { durable: true });
  } catch (err) {
    console.error("Erro ao conectar no RabbitMQ:", err);
  }
}

app.get("/api", (req, res) => {
  res.sendFile(path.join(__dirname, "form.html"));
});

app.post("/api/usuarios", async (req, res) => {
  const novoUsuario = req.body;

  // Enviar para RabbitMQ
  if (channel) {
    const msg = JSON.stringify(novoUsuario);
    channel.sendToQueue("cadastros", Buffer.from(msg), { persistent: true });
  }

  // Salvar no cadastros.html
  const arquivo = path.join(__dirname, "cadastros.html");
  let html = "";

  if (fs.existsSync(arquivo)) {
    html = fs.readFileSync(arquivo, "utf-8");
    html = html.replace("</ul></body></html>", "");
  } else {
    html = `
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Usuários Cadastrados</title>
        </head>
        <body>
        <h1>Usuários Cadastrados</h1>
        <ul>
        `;
  }

  html += `<li>Nome: ${novoUsuario.nome}, E-mail: ${novoUsuario.email}</li>\n`;
  html += "</ul></body></html>";

  fs.writeFileSync(arquivo, html, "utf-8");

  // **Salvar também no Redis**
  try {
    await redisClient.rPush("usuarios", JSON.stringify(novoUsuario));
  } catch (err) {
    console.error("Erro ao salvar usuário no Redis:", err);
  }

  res.status(201).json({
    mensagem: "Usuário criado com sucesso!",
    usuario: novoUsuario,
  });
});

// Endpoint para exibir cadastros.html
app.get("/api/usuarios", async (req, res) => {
  try {
    const usuariosRedis = await redisClient.lRange("usuarios", 0, -1);

    if (usuariosRedis.length > 0) {
      // Gerar HTML a partir do Redis
      let html = "<h1>Usuários Cadastrados</h1><ul>";
      usuariosRedis.forEach((u) => {
        const usuario = JSON.parse(u);
        html += `<li>Nome: ${usuario.nome}, E-mail: ${usuario.email}</li>`;
      });
      html += "</ul><a href='/api'>Voltar</a>";
      return res.send(html);
    }

    // Se Redis vazio, lê do arquivo HTML
    const arquivo = path.join(__dirname, "cadastros.html");
    if (fs.existsSync(arquivo)) {
      return res.sendFile(arquivo);
    } else {
      return res.send(
        "<h1>Nenhum usuário cadastrado</h1><a href='/api'>Voltar</a>"
      );
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao ler usuários.");
  }
});

app.listen(port, async () => {
  console.log("Rodando na porta", port);
  connectRabbitMQ();
  connectRedis();
  await connectRedis();
});
