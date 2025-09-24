const axios = require("axios");
const crypto = require("crypto");
require("dotenv").config({ quiet: true });

async function getOrderDetail() {
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
        order_sn_list: "2509239K784Q42",
        response_optional_fields: "buyer_user_id,recipient_address",
      },
    });

    let data_despacho = response.data.response.order_list[0];
    const DataParaEnvio = data_despacho.days_to_ship;
    const order_status = data_despacho.order_status;
    const dataMaximaDespacho = new Date(
      data_despacho.ship_by_date * 1000
    ).toLocaleString();

    console.log(
      `Data Para envio em ${DataParaEnvio} Dias. \nData Para Despacho ${dataMaximaDespacho}.`
    );
  } catch (error) {
    console.error("Erro:", error.response?.data || error.message);
  }
}

getOrderDetail();
//
