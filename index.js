const express = require("express");
const app = express();
const port = 3000;
const path = require("path")


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/api", (req, res) => {
    res.sendFile(path.join(__dirname, "form.html"))});

app.post("/api/usuarios", (req, res) => {
    const novoUsuario = req.body;
    res.status(201).json({
        mensagem:"Usuário criado com sucesso!",
        usuario: novoUsuario,
    })
})

app.listen(port, () => {
    console.log("Rodando na porta 3000")
})
