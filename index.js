const express = require("express");
const path = require("path");
const amqp = require("amqplib");

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Conexão global com RabbitMQ
let channel;
async function connectRabbitMQ() {
  try {
    console.log("🔄 Tentando conectar ao RabbitMQ...");
    const connection = await amqp.connect({
      protocol: "amqp",
      hostname: "localhost",
      port: 5672,
      username: "guest",
      password: "guest",
    });

    channel = await connection.createChannel();
    await channel.assertQueue("cadastros", { durable: true });

    console.log("✅ Conectado ao RabbitMQ e fila criada!");
  } catch (err) {
    console.error("❌ Erro ao conectar no RabbitMQ:", err);
  }
}

app.get("/api", (req, res) => {
  res.sendFile(path.join(__dirname, "form.html"));
});

app.post("/api/usuarios", (req, res) => {
  const novoUsuario = req.body;

  // Enviar para RabbitMQ
  if (channel) {
    const msg = JSON.stringify(novoUsuario);
    channel.sendToQueue("cadastros", Buffer.from(msg), { persistent: true });
    console.log("📤 Usuário enviado para RabbitMQ:", msg);
  }

  res.status(201).json({
    mensagem: "Usuário criado com sucesso!",
    usuario: novoUsuario,
  });
});

app.get("/api/usuarios", (req, res) => {
  try {
    const data = fs.readFileSync("cadastros.txt", "utf-8");
    const usuarios = data
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => JSON.parse(line));

    let html = "<h1>Usuários cadastrados</h1><ul>";
    usuarios.forEach((u) => {
      html += `<li>Nome: ${u.nome}, E-mail: ${u.email}</li>`;
    });
    html += "</ul><a href='/api'>Voltar</a>";

    res.send(html);
  } catch (err) {
    res.status(500).send("Erro ao ler usuários.");
  }
});

app.listen(port, () => {
  console.log("Rodando");
  connectRabbitMQ(); // conecta no RabbitMQ ao iniciar
});
