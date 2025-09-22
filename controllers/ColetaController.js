const axios = require("axios");
require("dotenv").config({ quiet: true });

async function EnviosColeta(req, res) {
  const seller = 217713439;
  const response = await axios.get(
    `https://api.mercadolibre.com/users/${seller}/shipping/schedule/cross_docking`,
    { headers: { Authorization: `Bearer ${process.env.TOKEN_ML}` } }
  );

  const segundaFeira = response.data.schedule.monday;
  const TercaFeira = response.data.schedule.tuesday;
  const QuartaFeira = response.data.schedule.wednesday;
  const QuintaFeira = response.data.schedule.thursday;
  const SextaFeira = response.data.schedule.friday;
  const Sabado = response.data.schedule.saturday;

  console.log("segundaFeira: ", JSON.stringify(segundaFeira));
  console.log("TercaFeira: ", JSON.stringify(TercaFeira));
  console.log("QuartaFeira: ", JSON.stringify(QuartaFeira));
  console.log("QuintaFeira: ", JSON.stringify(QuintaFeira));
  console.log("SextaFeira: ", JSON.stringify(SextaFeira));
  console.log("Sabado: ", JSON.stringify(Sabado));
  res.status(200).send();
}

module.exports = { EnviosColeta };
