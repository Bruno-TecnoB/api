// const IntegracaoML = require("../models/MercadoLivreModel");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const getChannel = require("../app");
require("dotenv").config({ quiet: true });
const { QUEUE_NAME, RETRY_QUEUE } = require("./shared/constants/rabbitmq");

console.log("Fila principal:", QUEUE_NAME);

const arquivoPath = path.join(__dirname, "../json/pedidos.json");

if (fs.existsSync(arquivoPath)) {
  const conteudo = fs.readFileSync(arquivoPath, "utf-8");
  dadosExistentes = JSON.parse(conteudo);
}

async function obterDespacho(req, res) {
  const body = req.body;
  console.log(body);
  const numeroPedido = body?.dados?.id;
  const plataforma = (body?.dados?.nomeEcommerce || "").trim().toLowerCase();
  let order_id = body?.dados?.idPedidoEcommerce;
  const codigoSituacao = (body?.dados?.codigoSituacao || "").toLowerCase();
  let mlStatus = null;
  let expectedDate = null;
  let situacaoDefinida;
  let idPedido;

  try {
    if (!order_id) {
      return res.status(400).json({ error: "Nenhum pedido encontrado." });
    }

    if (plataforma !== "mercado livre") {
      return res
        .status(200)
        .json({ message: "Plataforma não é Mercado Livre" });
    }

    switch (codigoSituacao) {
      case "aberto":
        situacaoDefinida = "em aberto";
        break;
      case "aprovado":
        situacaoDefinida = "Aguardando Separação";
        break;
      case "preparando_envio":
        situacaoDefinida = "em separação";
        break;
      case "faturado":
        situacaoDefinida = "separados";
        break;
      default:
        situacaoDefinida = codigoSituacao;
    }

    if (order_id.startsWith("O")) {
      idPedido = order_id.slice(1);
    } else if (order_id.startsWith("S")) {
      const tinyResp = await axios.get(
        "https://api.tiny.com.br/api2/pdv.pedido.obter.php",
        {
          params: {
            token: process.env.TOKEN_TINY,
            formato: "json",
            id: numeroPedido,
          },
        }
      );

      const observacoes = tinyResp.data?.retorno?.pedido?.observacoes || "";
      const match = observacoes.match(/\d+/);

      if (!match) {
        return res.status(404).json({
          error: "Não foi possível extrair o ID do pedido ML do Tiny",
        });
      }

      idPedido = match[0];
    } else {
      idPedido = order_id;
    }

    let shippingId = null;
    try {
      const responseOrder = await axios.get(
        `https://api.mercadolibre.com/orders/${idPedido}`,
        { headers: { Authorization: `Bearer ${process.env.TOKEN_ML}` } }
      );

      shippingId = responseOrder.data?.shipping?.id;
    } catch (err) {
      if (err.response?.status === 404) {
        const responsePack = await axios.get(
          `https://api.mercadolibre.com/packs/${idPedido}`,
          { headers: { Authorization: `Bearer ${process.env.TOKEN_ML}` } }
        );

        shippingId = responsePack.data?.shipment?.id;
      } else {
        throw err;
      }
    }

    if (shippingId) {
      const shippingResp = await axios.get(
        `https://api.mercadolibre.com/shipments/${shippingId}/sla`,
        { headers: { Authorization: `Bearer ${process.env.TOKEN_ML}` } }
      );
      mlStatus = shippingResp.data?.status;
      expectedDate = shippingResp.data?.expected_date;
    }

    const pedido = {
      order_id: idPedido,
      id_tiny: numeroPedido,
      plataforma: "Mercado Livre",
      status: situacaoDefinida,
      status_ml: mlStatus,
      expected_date: expectedDate,
    };

    if (!shippingId) {
      const channel = getChannel();
      if (channel) {
        channel.sendToQueue(RETRY_QUEUE, Buffer.from(JSON.stringify(pedido)), {
          persistent: true,
        });
        console.log(
          "⚠️ Pedido sem shipment_id, enviado para fila retry:",
          pedido
        );
      }
    }

    salvarOuAtualizarPedido(pedido);
    return res.status(200).json(pedido);
  } catch (err) {
    console.error("Erro em obterDespacho:", err.response?.data || err.message);
    return res.status(500).json({ error: err.response?.data || err.message });
  }
}

function salvarOuAtualizarPedido(payload) {
  const dadosExistentes = carregarPedidos();
  const index = dadosExistentes.findIndex(
    (p) => p.order_id === payload.order_id
  );

  if (index !== -1) {
    dadosExistentes[index] = { ...dadosExistentes[index], ...payload };
  } else {
    dadosExistentes.push(payload);
  }

  fs.writeFileSync(arquivoPath, JSON.stringify(dadosExistentes, null, 2));
}

function carregarPedidos() {
  if (!fs.existsSync(arquivoPath)) return [];
  const conteudo = fs.readFileSync(arquivoPath, "utf-8");
  try {
    return JSON.parse(conteudo);
  } catch (err) {
    console.error("Erro ao ler o arquivo:", err);
    return [];
  }
}

module.exports = { obterDespacho };
