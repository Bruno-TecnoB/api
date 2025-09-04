const express = require("express");
const path = require("path");
const amqp = require('amqplib');

const app = express();
const port = 3000;


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Conexão global com RabbitMQ
let channel;
async function connectRabbitMQ() {
  try {
    const connection = await amqp.connect("amqp://13.59.97.160"); // ou IP da VPS
    channel = await connection.createChannel();
    await channel.assertQueue("cadastros", { durable: true });
    console.log("✅ Conectado ao RabbitMQ");
  } catch (err) {
    console.error("❌ Erro ao conectar no RabbitMQ", err);
  }
}

app.get("/api", (req, res) => {
    res.sendFile(path.join(__dirname, "form.html"))});

app.post("/api/usuarios", (req, res) => {
    const novoUsuario = req.body;

    // Enviar para RabbitMQ
    if (channel) {
    const msg = JSON.stringify(novoUsuario);
    channel.sendToQueue("cadastros", Buffer.from(msg), { persistent: true });
    console.log("📤 Usuário enviado para RabbitMQ:", msg);
  }

    res.status(201).json({
        mensagem:"Usuário criado com sucesso!",
        usuario: novoUsuario,
    })
})

app.listen(port, () => {
    console.log("Rodando")
    connectRabbitMQ(); // conecta no RabbitMQ ao iniciar
})
