const { DataTypes } = require("sequelize");
const sequelize = require("../db/conn");

const CriarIntegracao = sequelize.define(
  "IntegracaoTiny",
  {
    name: { type: DataTypes.STRING, allowNull: false },
    db_name: { type: DataTypes.STRING, allowNull: false },
    status: { type: DataTypes.STRING, allowNull: false },
    cnpj: { type: DataTypes.INTEGER, allowNull: false },
    code: { type: DataTypes.STRING, allowNull: true },
    client_id: { type: DataTypes.INTEGER, allowNull: false },
    client_secret: { type: DataTypes.STRING, allowNull: false },
    AccesstokenV2: { type: DataTypes.STRING, allowNull: true },
    AccesstokenV3: { type: DataTypes.STRING, allowNull: true },
    refreshToken: { type: DataTypes.STRING, allowNull: true },
    expires_in: { type: DataTypes.STRING, allowNull: true },
  },

  { tableName: "integracoes_tiny", timestamps: true }
);

module.exports = CriarIntegracao;
