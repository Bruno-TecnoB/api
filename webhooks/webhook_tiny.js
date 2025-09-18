const axios = require("axios");

const order = 2000013060459444;
const TOKEN =
  "APP_USR-6434195101317282-091610-16fa10c725930dd5fd0934b70bb4477f-217713439";
const url = `https://api.mercadolibre.com/orders/${order}`;

async function obterPedido() {
  const response = await axios.get(url, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });

  console.log(JSON.stringify(response.data, null, 2));
}

async function Executar() {
  await obterPedido();
}

Executar();
