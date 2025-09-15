const express = require("express");
const path = require("path");
const fs = require("fs");
const amqp = require("amqplib");

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

app.post("/api/usuarios", (req, res) => {
  const novoUsuario = req.body;

  // Enviar para RabbitMQ
  if (channel) {
    const msg = JSON.stringify(novoUsuario);
    channel.sendToQueue("cadastros", Buffer.from(msg), { persistent: true });
  }

  // Salvar no cadastros.html
  const arquivo = path.join(__dirname, "cadastros.html");
  let html = "";

  // Se o arquivo existir, lê o conteúdo atual, exceto o </ul></body></html>
  if (fs.existsSync(arquivo)) {
    html = fs.readFileSync(arquivo, "utf-8");
    html = html.replace("</ul></body></html>", ""); // remove fechamento para adicionar novo item
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

  // Adiciona novo usuário
  html += `<li>Nome: ${novoUsuario.nome}, E-mail: ${novoUsuario.email}</li>\n`;

  // Fecha a lista e o HTML
  html += "</ul></body></html>";

  // Salva o arquivo
  fs.writeFileSync(arquivo, html, "utf-8");

  res.status(201).json({
    mensagem: "Usuário criado com sucesso!",
    usuario: novoUsuario,
  });
});

// Endpoint para exibir cadastros.html
app.get("/api/usuarios", (req, res) => {
  const arquivo = path.join(__dirname, "cadastros.html");
  if (fs.existsSync(arquivo)) {
    res.sendFile(arquivo);
  } else {
    res.send("<h1>Nenhum usuário cadastrado</h1><a href='/api'>Voltar</a>");
  }
});

app.listen(port, () => {
  console.log("Rodando na porta", port);
  connectRabbitMQ();
});
