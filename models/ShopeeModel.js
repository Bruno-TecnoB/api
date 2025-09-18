const { DataTypes } = require("sequelize");
const sequelize = require("../db/conn");

const IntegracaoShopee = sequelize.define(
  "integracao_shopee",
  {
    name: { type: DataTypes.STRING, allowNull: false },
    db_name: { type: DataTypes.STRING, allowNull: false },
    status: { type: DataTypes.STRING, allowNull: false },
    cnpj: { type: DataTypes.INTEGER, allowNull: false },
    code: { type: DataTypes.STRING, allowNull: true },
    shop_id: { type: DataTypes.STRING, allowNull: false },
    partner_id: { type: DataTypes.INTEGER, allowNull: false },
    partner_key: { type: DataTypes.STRING, allowNull: false },
    access_token: { type: DataTypes.STRING, allowNull: true },
    refresh_token: { type: DataTypes.STRING, allowNull: true },
    expire_in: { type: DataTypes.STRING, allowNull: true },
  },

  { tableName: "integracao_shopee", timestamps: true }
);

module.exports = IntegracaoShopee;
