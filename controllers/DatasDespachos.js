const axios = require("axios");
const crypto = require("crypto");
const fs = require("fs").promises;
const path = require("path");
const { connectRabbitMQ } = require("../rabbitmq");
const { RETRY_QUEUE } = require("../rabbitmq");
const { concluirIntegracaoShopee } = require("./ShopeeController");
require("dotenv").config({ quiet: true });

async function DataDespachoShopee(order_id, numeroPedido, situacaoDefinida) {
  console.log("order_id: ", order_id);
  const partner_id = process.env.partner_id;
  const partner_key = process.env.partner_key;
  const shop_id = process.env.shop_id;
  const access_token = process.env.TOKEN_SHOPEE;

  const path = "/api/v2/order/get_order_detail";
  const host = "https://openplatform.shopee.com.br";
  const timestamp = Math.floor(Date.now() / 1000);

  const baseString = `${partner_id}${path}${timestamp}${access_token}${shop_id}`;
  const sign = crypto
    .createHmac("sha256", partner_key)
    .update(baseString)
    .digest("hex");

  const url = `${host}${path}?partner_id=${partner_id}&timestamp=${timestamp}&sign=${sign}&shop_id=${shop_id}&access_token=${access_token}`;

  try {
    const response = await axios.get(url, {
      headers: { "Content-Type": "application/json" },
      params: {
        order_sn_list: order_id,
        response_optional_fields: "buyer_user_id,recipient_address",
      },
    });

    let data_despacho = response.data.response.order_list[0];
    const DataParaEnvio = data_despacho.days_to_ship;
    const order_status = data_despacho.order_status;
    const dataMaximaDespacho = new Date(
      data_despacho.ship_by_date * 1000
    ).toLocaleString();

    // console.log(
    //   `Data Para envio em ${DataParaEnvio} Dias, Data Para Despacho ${dataMaximaDespacho}`
    // );

    const pedido = {
      order_id: order_id,
      id_tiny: numeroPedido,
      plataforma: "Shopee",
      status_da_api: order_status,
      data_Maxima_de_Despacho: dataMaximaDespacho,
      data_criacao: new Date().toISOString(),
    };

    console.log("Pedido: ", pedido);
    await salvarOuAtualizarPedido(pedido);
  } catch (error) {
    console.error("Erro:", error.response?.data || error.message);
  }
}

async function processarPayload(req, res) {
  const body = req.body;
  console.log("Body: ", body);
  const numeroPedido = body?.dados?.id;
  const plataforma = (body?.dados?.nomeEcommerce || "").trim().toLowerCase();
  const FormaEnvio = (body?.dados?.formaEnvio.descricao || "")
    .trim()
    .toLowerCase();

  let order_id = body?.dados?.idPedidoEcommerce;
  const codigoSituacao = (body?.dados?.codigoSituacao || "").toLowerCase();

  if (!order_id) {
    console.log({ error: "Nenhum pedido encontrado." });
    return;
  }

  if (plataforma == "shopee") {
    const DespachoShopee = await DataDespachoShopee(
      order_id,
      numeroPedido,
      codigoSituacao
    );
    return;
  }

  if (plataforma !== "mercado livre") {
    return;
  }

  if (FormaEnvio == "MercadoEnvios Flex") {
    return;
  }

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
      const id_tiny = observacoes.match(/\d+/);

      if (!id_tiny) {
        return res.status(404).json({
          error: "Não foi possível extrair o ID do pedido ML do Tiny",
        });
      }

      idPedido = id_tiny[0];
    } else {
      idPedido = order_id;
    }

    let shippingId = null;
    let resultadoReqML = null;
    try {
      const responseOrder = await axios.get(
        `https://api.mercadolibre.com/orders/${idPedido}`,
        { headers: { Authorization: `Bearer ${process.env.TOKEN_ML}` } }
      );
      shippingId = responseOrder.data?.shipping?.id;
      resultadoReqML = responseOrder.data;
      resultadoReqML.indentificador = "responseOrder ";
    } catch (err) {
      if (err.response?.status === 404) {
        const responsePack = await axios.get(
          `https://api.mercadolibre.com/packs/${idPedido}`,
          { headers: { Authorization: `Bearer ${process.env.TOKEN_ML}` } }
        );
        shippingId = responsePack.data?.shipment?.id;
        resultadoReqML = responsePack.data;
        resultadoReqML.indentificador = "ResponsePack ";
      } else {
        throw err;
      }
    }

    let mlStatus = null;
    let expectedDate = null;

    if (shippingId) {
      const shippingResp = await axios.get(
        `https://api.mercadolibre.com/shipments/${shippingId}/sla`,
        { headers: { Authorization: `Bearer ${process.env.TOKEN_ML}` } }
      );
      mlStatus = shippingResp.data?.status;
      expectedDate = shippingResp.data?.expected_date;
      console.log(shippingResp.data);
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

    const status = {
      on_time: "No Prazo",
      delayed: "Atrasado",
    };

    const pedido = {
      order_id: idPedido,
      id_tiny: numeroPedido,
      plataforma: "Mercado Livre",
      status: situacaoDefinida,
      status_da_api: status[mlStatus] || "Sem status",
      data_Maxima_de_Despacho: expectedDate,
      data_criacao: new Date().toISOString(),
    };

    console.log("Pedido: ", pedido);
    await salvarOuAtualizarPedido(pedido);

    return pedido;
  } catch (err) {
    console.error(
      "Erro em processarPayload:",
      err?.response?.data || err.message || err
    );
    console.log({ error: err?.response?.data || err.message || err });
    return;
  }
}

async function salvarOuAtualizarPedido(payload) {
  const arquivoPath = path.join(__dirname, "../json/pedidos.json");
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
  const arquivoPath = path.join(__dirname, "../json/pedidos.json");

  try {
    const conteudo = await fs.readFile(arquivoPath, "utf-8");
    return JSON.parse(conteudo);
  } catch (err) {
    if (err.code === "ENOENT") return [];
    if (err instanceof SyntaxError) {
      const backupPath = arquivoPath + ".corrompido_" + Date.now();
      await fs.rename(arquivoPath, backupPath);
      console.error(`Arquivo JSON corrompido renomeado para: ${backupPath}`);
      return [];
    }
    console.error("Erro ao ler o arquivo:", err);
    return [];
  }
}

module.exports = { processarPayload, DataDespachoShopee };
