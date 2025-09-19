const axios = require("axios");
const fs = require("fs").promises;
const path = require("path");
const { connectRabbitMQ } = require("../rabbitmq");
const { RETRY_QUEUE } = require("../rabbitmq");
require("dotenv").config();

const arquivoPath = path.join(__dirname, "../json/pedidos.json");

// Função principal para processar payload
async function processarPayload(req, res) {
  const body = req.body;
  //console.log("Body_ProcessarPayload:", body);
  const numeroPedido = body?.dados?.id;
  const plataforma = (body?.dados?.nomeEcommerce || "").trim().toLowerCase();
  let order_id = body?.dados?.idPedidoEcommerce;
  const codigoSituacao = (body?.dados?.codigoSituacao || "").toLowerCase();

  if (!order_id) {
    return res.status(400).json({ error: "Nenhum pedido encontrado." });
  }

  if (plataforma !== "mercado livre") {
    return res.status(200).json({ message: "Plataforma não é Mercado Livre" });
  }

  // Mapear situação
  const situacoesMap = {
    aberto: "em aberto",
    aprovado: "Aguardando Separação",
    preparando_envio: "em separação",
    faturado: "separados",
  };
  const situacaoDefinida = situacoesMap[codigoSituacao] || codigoSituacao;

  try {
    let idPedido;

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

    // Buscar shippingId no ML
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

    // Buscar status e expected_date
    let mlStatus = null;
    let expectedDate = null;

    if (shippingId) {
      const shippingResp = await axios.get(
        `https://api.mercadolibre.com/shipments/${shippingId}/sla`,
        { headers: { Authorization: `Bearer ${process.env.TOKEN_ML}` } }
      );
      mlStatus = shippingResp.data?.status;
      //expectedDate = shippingResp.data?.expected_date;
    } else {
      mlStatus = null;
      console.log("Nenhum shippingId encontrado para o pedido:", idPedido);
    }

    if (!expectedDate) {
      const channel = await connectRabbitMQ();
      channel.sendToQueue(RETRY_QUEUE, Buffer.from(JSON.stringify(body)), {
        persistent: true,
      });
      console.log(`Reenviando pedido para fila de retry.`);
      return;
    }

    // Montar pedido
    const pedido = {
      order_id: idPedido,
      id_tiny: numeroPedido,
      plataforma: "Mercado Livre",
      status: situacaoDefinida,
      status_ml: mlStatus,
      expected_date: expectedDate,
      updated_at: new Date().toISOString(),
    };

    console.log(pedido);

    // Salvar ou atualizar de forma segura
    await salvarOuAtualizarPedido(pedido);
    return pedido;
  } catch (err) {
    console.error(
      "Erro em processarPayload:",
      err?.response?.data || err.message || err
    );
    return res
      .status(500)
      .json({ error: err?.response?.data || err.message || err });
  }
}

async function salvarOuAtualizarPedido(payload) {
  const dadosExistentes = await carregarPedidos();
  const index = dadosExistentes.findIndex(
    (p) => p.order_id === payload.order_id
  );

  if (index !== -1) {
    dadosExistentes[index] = { ...dadosExistentes[index], ...payload };
  } else {
    dadosExistentes.push(payload);
  }

  await fs.writeFile(arquivoPath, JSON.stringify(dadosExistentes, null, 2));
}

async function carregarPedidos() {
  try {
    const conteudo = await fs.readFile(arquivoPath, "utf-8");
    return JSON.parse(conteudo);
  } catch (err) {
    if (err.code === "ENOENT") return []; // Arquivo não existe
    if (err instanceof SyntaxError) {
      // Renomeia arquivo corrompido para análise posterior
      const backupPath = arquivoPath + ".corrompido_" + Date.now();
      await fs.rename(arquivoPath, backupPath);
      console.error(`Arquivo JSON corrompido renomeado para: ${backupPath}`);
      return [];
    }
    console.error("Erro ao ler o arquivo:", err);
    return [];
  }
}

module.exports = { processarPayload };
