const axios = require("axios");
const path = require("path");
const fs = require("fs");
require("dotenv").config({
  quiet: true,
});

async function WebhookTiny(req, res) {
  try {
    // console.log("Body:", req.body);

    const marketplace = req.body?.dado?.nomeEcommerce;
    if (!marketplace || marketplace.toLowerCase() !== "mercado livre") {
      return res.status(200).send();
    }

    let orderId = req.body?.dados?.idPedidoEcommerce;
    if (!orderId) {
      return res
        .status(400)
        .json({ error: "ID do pedido não encontrado no body" });
    }

    if (orderId.startsWith("O")) {
      orderId = orderId.substring(1);
    }

    console.log("orderId: ", orderId);

    let situacao = req.body?.dados?.codigoSituacao;
    if (situacao && situacao.toLowerCase().includes("entregue")) {
      return res.status(200).send();
    }

    const url = `https://api.mercadolibre.com/orders/${orderId}`;

    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${process.env.TOKEN_ML}` },
    });

    console.log("Response:", JSON.stringify(response.data, null, 2));

    salvarArquivo(response.data);

    return res.status(200).json({ status: "ok", order: response.data });
  } catch (error) {
    console.error(
      "Erro no WebhookTiny:",
      error.response?.data || error.message
    );
    return res.status(500).json({ error: "Falha ao processar webhook" });
  }
}

async function salvarArquivo(dados) {
  const filePath = path.join(__dirname, "arquivosalvo.json");

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify([], null, 2));
  }

  let data = [];
  try {
    data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (e) {
    console.error("Erro ao ler JSON:", e);
  }

  data.push(dados);

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

  console.log("Arquivo salvo com sucesso.");
}

module.exports = { WebhookTiny };
