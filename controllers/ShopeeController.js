const crypto = require("crypto");
require("dotenv").config({ quiet: true });
const shopeeModel = require("../models/ShopeeModel");
const axios = require("axios");

async function ShopeeAuthUrl(req, res) {
  const { partner_id, partner_key, shop_id, cnpj, name, db_name } = req.body;

  if (!partner_id || !partner_key || !shop_id || !name || !db_name) {
    return res.status(400).json({
      error: "Todos os dados são obrigatórios",
    });
  }

  const existingName = await shopeeModel.findOne({ where: { name } });
  if (existingName) {
    return res.status(400).json({
      error: "O nome informado já está em uso",
    });
  }

  const existingShop = await shopeeModel.findOne({ where: { shop_id } });
  if (existingShop) {
    return res.status(400).json({
      error: "O shop_id informado já está cadastrado",
    });
  }

  const existingCNPJ = await shopeeModel.findOne({ where: { cnpj } });
  if (existingCNPJ) {
    return res.status(400).json({
      error: "O CNPJ informado já está cadastrado",
    });
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const path = "/api/v2/shop/auth_partner";
  const REDIRECT_URI = process.env.REDIRECT_URI_SHOPEE;
  const base_string = `${partner_id}${path}${timestamp}`;
  const sign = crypto
    .createHmac("sha256", partner_key)
    .update(base_string)
    .digest("hex");

  const baseURL = `https://partner.shopeemobile.com${path}`;
  const url = `${baseURL}?partner_id=${partner_id}&timestamp=${timestamp}&sign=${sign}&redirect=${encodeURIComponent(
    REDIRECT_URI
  )}&shop_id=${shop_id}`;

  const novaIntegracao = await shopeeModel.create({
    name,
    db_name,
    cnpj,
    partner_id,
    partner_key,
    shop_id,
    status: "pendente",
  });

  return res.status(201).json({
    success: true,
    message: "Integração Shopee criada com sucesso",
    url: url,
    data: novaIntegracao,
  });
}

async function concluirIntegracaoShopee(req, res) {
  const { code, shop_id, state } = req.query;

  if (!code || !shop_id || !state) {
    return res.status(400).send({
      erro_code: 400,
      error_typer: "dados_invalidos.",
      Message: "Code ou shop ID não foi encontrado ou é inválido.",
    });
  }

  const integracaoExistente = await shopeeModel.findByPk(state);

  if (!integracaoExistente) {
    return res.status(400).send({
      erro_code: 400,
      error_type: "integracao_inexistente.",
      Message: "Nenhuma Integração foi encontrada com esse ID.",
    });
  }

  const partner_id = parseInt(integracaoExistente.partner_id);
  const partner_key = integracaoExistente.partner_key;
  const path = "/api/v2/auth/token/get";
  const url = `https://partner.shopeemobile.com${path}`;
  const timestamp = Math.floor(Date.now() / 1000);

  const baseString = `${partner_id}${path}${timestamp}`;
  const sign = crypto
    .createHmac("sha256", partner_key)
    .update(baseString)
    .digest("hex");

  const headers = { "Content-Type": "application/json" };
  const payload = {
    code,
    shop_id: parseInt(shop_id),
    partner_id,
  };
  const params = {
    partner_id,
    timestamp,
    sign,
  };

  try {
    const response = await axios.post(url, payload, {
      params,
      headers,
    });

    const RefreshToken = response.data.refresh_token;

    const refreshTokenData = await RenovarAccessToken(
      partner_id,
      partner_key,
      RefreshToken,
      shop_id
    );

    const { access_token, refresh_token, expire_in } = refreshTokenData;

    if (integracaoExistente) {
      (integracaoExistente.code = code),
        (integracaoExistente.access_token = access_token),
        (integracaoExistente.refresh_token = refresh_token),
        (integracaoExistente.expire_in = expire_in),
        (integracaoExistente.status = "Ativo");

      await integracaoExistente.save();
    }

    return res.json({
      success: true,
      Message: "Integração Shopee criada com Sucesso.",
      data: integracaoExistente,
    });
  } catch (err) {
    console.error(
      "Erro ao integrar com Shopee:",
      err.response?.data || err.message
    );

    return res.status(500).send({
      erro_code: 500,
      error_typer: "shopee_request_error",
      Message: err.response?.data || err.message,
    });
  }
}

async function RenovarAccessToken(
  partner_id,
  partner_key,
  refresh_token,
  shop_id
) {
  const path = "/api/v2/auth/access_token/get";
  const url = `https://partner.shopeemobile.com${path}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const headers = { "Content-Type": "application/json" };

  const baseString = `${partner_id}${path}${timestamp}`;
  const sign = crypto
    .createHmac("sha256", partner_key)
    .update(baseString)
    .digest("hex");

  const urlRefreshToken = `${url}?partner_id=${partner_id}&timestamp=${timestamp}&sign=${sign}`;

  const body = {
    refresh_token: refresh_token,
    shop_id: parseInt(shop_id),
    partner_id: partner_id,
  };

  const response = await axios.post(urlRefreshToken, body, { headers });
  const data = response.data;
  return data;
}

async function DataDespacho(req, res) {
  try {
    const { partner_id, partner_key, shop_id, access_token, order_sn } =
      req.body;
    const path = "/get_order_detail";
    const host = "https://partner.shopeemobile.com/api/v2";
    const timestamp = Math.floor(Date.now() / 1000);

    const baseString = `${partner_id}${path}${timestamp}${access_token}${shop_id}`;
    const sign = crypto
      .createHmac("sha256", partner_key)
      .update(baseString)
      .digest("hex");

    const url = `${host}${path}?partner_id=${partner_id}&timestamp=${timestamp}&sign=${sign}&shop_id=${shop_id}&access_token=${access_token}`;

    const body = {
      order_sn_list: [order_sn],
      response_optional_fields: "buyer_user_id,recipient_address",
    };

    const response = await axios.post(url, body, {
      headers: { "Content-Type": "application/json" },
    });

    console.log(JSON.stringify(response.data));

    return res.status(200).send(response.data);
  } catch (error) {
    return res.status(500).send({
      error: error.message,
      details: error.response?.data || null,
    });
  }
}

module.exports = {
  ShopeeAuthUrl,
  concluirIntegracaoShopee,
  DataDespacho,
  RenovarAccessToken,
};
