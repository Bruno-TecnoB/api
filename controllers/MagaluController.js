const IntegracaoMagalu = require("../models/MagaluModel");
const axios = require("axios");
require("dotenv").config({
  quiet: true,
});

async function criarIntegracaoMagalu(req, res) {
  const { name, db_name, cnpj, client_id, client_secret } = req.body;

  try {
    if (!name) {
      return res.status(400).json({
        erroType: "nome_ausente",
        message: "Por favor escolha um nome para a sua integração!",
      });
    }

    let integracaoExistente = await IntegracaoMagalu.findOne({
      where: { name, db_name },
    });

    if (integracaoExistente) {
      return res.status(400).json({
        erroType: "nome_duplicado",
        message: "Já existe uma integração com esse nome.",
      });
    }

    integracaoExistente = await IntegracaoMagalu.findOne({
      where: { cnpj, client_id, client_secret },
    });

    if (integracaoExistente) {
      return res.status(400).json({
        erroType: "integracao_duplicada",
        message: "Já existe uma integração com esses dados.",
      });
    }

    const novaIntegracao = await IntegracaoMagalu.create({
      name,
      db_name,
      cnpj,
      client_id,
      client_secret,
      status: "Pendente",
    });

    const novaIntegracaoId = novaIntegracao.id.toString();

    const url = `https://id.magalu.com/login?client_id=${client_id}&redirect_uri=${process.env.REDIRECT_URI_MAGALU}&scope=${process.env.SCOPE}&response_type=code&choose_tenants=true&state=${novaIntegracaoId}`;

    return res.status(201).json({
      success: true,
      message: "Integração Magalu criada com sucesso",
      url,
      data: novaIntegracao,
    });
  } catch (err) {
    console.error("Erro ao Criar a Integração:", err);
    return res
      .status(500)
      .json({ error: "Ocorreu um erro ao criar a integração." });
  }
}

async function concluirIntegracaoMagalu(req, res) {
  const { code, state } = req.query;

  if (!code) return res.status(400).json({ error: "Code não encontrado" });

  try {
    const integracao = await IntegracaoMagalu.findByPk(state);
    if (!integracao) throw new Error("Integração não encontrada!");

    const { client_id, client_secret } = integracao;
    const redirect_uri = process.env.REDIRECT_URI_MAGALU;

    const response = await axios.post(
      "https://id.magalu.com/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id,
        client_secret,
        redirect_uri,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const { access_token, refresh_token, expires_in } = response.data;

    await integracao.update({
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresIn: expires_in,
      status: "Ativo",
    });

    res.json({
      message: "Integração Magalu concluída!",
      data: response.data,
    });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "Falha ao obter token da Magalu" });
  }
}

module.exports = {
  criarIntegracaoMagalu,
  concluirIntegracaoMagalu,
};
