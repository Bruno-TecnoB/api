const IntegracaoML = require("../models/MercadoLivreModel");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
require("dotenv").config({
  quiet: true,
});

async function criarIntegracaoML(req, res) {
  const { name, db_name, cnpj, client_id, client_secret } = req.body;

  try {
    if (!name) {
      return res.status(501).json({
        erroCode: "501",
        erroType: "nome_ausente",
        message: ["Por favor escolha um nome para a sua integração !"],
      });
    }

    let integracaoExistente = await IntegracaoML.findOne({
      where: { name, db_name },
    });

    if (integracaoExistente) {
      return res.status(501).json({
        erroCode: "501",
        erroType: "nome_duplicado",
        message: ["Já existe uma integração com esse nome."],
      });
    }

    integracaoExistente = await IntegracaoML.findOne({
      where: { cnpj, client_id, client_secret },
    });

    if (integracaoExistente) {
      return res.status(501).json({
        erroCode: "501",
        erroType: "integracao_duplicada",
        message: ["Já existe uma integração com esses Dados."],
      });
    }

    const novaIntegracao = await IntegracaoML.create({
      name,
      db_name: db_name,
      cnpj: cnpj,
      client_id: client_id,
      client_secret: client_secret,
      status: "Pendente",
    });

    const novaIntegracaoId = novaIntegracao.id.toString();

    const url = `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${client_id}&redirect_uri=${process.env.REDIRECT_URI_ML}&state=${novaIntegracaoId}`;

    return res.status(201).json({
      success: true,
      message: "Integração Mercado livre criada com sucesso",
      url: url,
      data: novaIntegracao,
    });
  } catch (err) {
    console.error("Erro ao Criar a Integração:", err);

    return res.status(500).json({
      error: "Ocorreu um erro ao Criar a Integração.",
    });
  }
}

async function concluirIntegracaoML(req, res) {
  const { code, state } = req.query;

  if (!code) return res.status(400).json({ error: "Code não encontrado" });

  try {
    const integracao = await IntegracaoML.findByPk(state);

    if (!integracao) throw new Error("Integração não encontrada!");

    const { client_id, client_secret } = integracao;

    const redirect_uri = process.env.REDIRECT_URI_ML;

    const response = await axios.post(
      "https://api.mercadolibre.com/oauth/token",
      null,
      {
        params: {
          grant_type: "authorization_code",
          client_id,
          client_secret,
          code,
          redirect_uri,
        },
      }
    );

    const { access_token, refresh_token } = response.data;

    await integracao.update({
      AccessToken: access_token,
      refreshToken: refresh_token,
      code,
      status: "Ativo",
    });

    res.json({
      success: true,
      message: "Integração Mercado Livre concluída!",
      data: response.data,
    });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res
      .status(500)
      .json({ success: false, error: "Falha ao obter token do Mercado Livre" });
  }
}

async function obterDespacho(req, res) {
  const body = req.body;
  const numeroPedido = body?.dados?.id;
  const plataform = body?.dados?.nomeEcommerce;
  let order_id = body?.dados?.idPedidoEcommerce;

  try {
    if (!order_id) {
      return res.status(400).json({ error: "Nenhum pedido encontrado." });
    }

    if ((plataform || "").trim().toLowerCase() !== "mercado livre") {
      return res
        .status(200)
        .json({ message: "Plataforma não é Mercado Livre" });
    }

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

      const observacoes = tinyResp.data.retorno.pedido.observacoes || "";
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
      shippingId = responseOrder.data.shipping?.id;
      salvarArquivo(responseOrder.data);
    } catch (err) {
      if (err.response?.status === 404) {
        const responsePack = await axios.get(
          `https://api.mercadolibre.com/packs/${idPedido}`,
          { headers: { Authorization: `Bearer ${process.env.TOKEN_ML}` } }
        );
        shippingId = responsePack.data.shipment?.id;
        salvarArquivo(responsePack.data);
      } else {
        throw err;
      }
    }

    if (!shippingId) {
      return res
        .status(404)
        .json({ error: "Pedido não possui envio vinculado" });
    }

    const shippingResp = await axios.get(
      `https://api.mercadolibre.com/shipments/${shippingId}/sla`,
      { headers: { Authorization: `Bearer ${process.env.TOKEN_ML}` } }
    );
    salvarArquivo(shippingResp.data);

    const retorno = {
      order: parseInt(idPedido),
      plataform,
      status: shippingResp.data.status,
      expected_date: shippingResp.data.expected_date,
    };

    return res.status(200).json(retorno);
  } catch (err) {
    return res.status(500).json({ error: err.response?.data || err.message });
  }
}

function salvarArquivo(retorno) {
  const arquivoPath = path.join(__dirname, "pedidos.json");

  let dadosExistentes = [];

  // Se o arquivo já existe, lê e converte para array
  if (fs.existsSync(arquivoPath)) {
    const conteudo = fs.readFileSync(arquivoPath, "utf-8");
    dadosExistentes = JSON.parse(conteudo);
  }

  // Adiciona o novo retorno
  dadosExistentes.push(retorno);

  // Salva de volta no arquivo
  fs.writeFileSync(arquivoPath, JSON.stringify(dadosExistentes, null, 2));

  console.log("Arquivo salvo com sucesso!");
}

module.exports = {
  criarIntegracaoML,
  concluirIntegracaoML,
  obterDespacho,
};
