const qs = require("qs");
const axios = require("axios");
const IntegracaoTiny = require("../models/TinyModel");
require("dotenv").config({
  quiet: true,
});

async function criarIntegracao(req, res) {
  const { name, db_name, cnpj, client_id, client_secret, AccesstokenV2 } =
    req.body;

  try {
    if (!name) {
      return res.status(400).json({
        erroCode: "400",
        erroType: "nome_ausente",
        message: ["Por favor escolha um nome para a sua integração !"],
      });
    }

    let integracaoExistente = await IntegracaoTiny.findOne({
      where: { name, db_name },
    });

    if (integracaoExistente) {
      return res.status(400).json({
        erroCode: "400",
        erroType: "nome_duplicado",
        message: ["Já existe uma integração com esse nome."],
      });
    }

    integracaoExistente = await IntegracaoTiny.findOne({
      where: { cnpj, client_id, client_secret },
    });

    if (integracaoExistente) {
      return res.status(400).json({
        erroCode: "400",
        erroType: "integracao_existente",
        message: ["Já existe uma integração com esses Dados."],
      });
    }

    const novaIntegracao = await IntegracaoTiny.create({
      name,
      db_name: db_name,
      cnpj: cnpj,
      client_id: client_id,
      client_secret: client_secret,
      AccesstokenV2: AccesstokenV2,
      status: "Pendente",
    });

    const novaIntegracaoId = novaIntegracao.id.toString();

    const url = `https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/auth?client_id=${client_id}&redirect_uri=${process.env.REDIRECT_URI_TINY}&scope=openid&response_type=code&state=${novaIntegracaoId}`;

    return res.status(201).json({
      message: "Integração Tiny criada com sucesso",
      url: url,
      integracao: novaIntegracao,
    });
  } catch (err) {
    console.error("Erro ao Criar a Integração:", err);

    return res.status(500).json({
      error: "Ocorreu um erro ao Criar a Integração.",
    });
  }
}

async function concluirIntegracao(req, res) {
  const { code, state } = req.query;
  try {
    if (!code || !state) {
      return res.status(400).json({
        erroCode: "400",
        erroType: "code_ausente",
        message: ["Code ou state não foi encontrado."],
      });
    }

    const integracao = await IntegracaoTiny.findByPk(state);

    if (!integracao) {
      return res.status(404).json({ error: "Integração não encontrada" });
    }

    const { client_id, client_secret } = integracao;

    const response = await axios.post(
      "https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/token",
      qs.stringify({
        grant_type: "authorization_code",
        client_id: client_id,
        client_secret: client_secret,
        redirect_uri: process.env.REDIRECT_URI_TINY,
        code: code,
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    const { access_token, refresh_token, expires_in } = response.data;

    await integracao.update({
      AccesstokenV3: access_token,
      refreshToken: refresh_token,
      expires_in: expires_in,
      code,
      status: "Ativo",
    });

    return res.status(200).json({
      message: "Integração concluída com sucesso",
      code,
      state,
    });
  } catch (err) {
    console.error("Erro Tiny:", err.response?.data || err.message || err);
    return res.status(500).json({
      error: "Erro interno do servidor",
      detalhes: err.response?.data || err.message,
    });
  }
}

module.exports = { criarIntegracao, concluirIntegracao };
