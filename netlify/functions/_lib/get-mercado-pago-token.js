function getMercadoPagoAccessToken() {
  var canonicalToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (canonicalToken) {
    return canonicalToken;
  }

  var legacyToken = process.env.MERCADO_PAGO_ACESS_TOKEN;
  if (legacyToken) {
    return legacyToken;
  }

  return "";
}

module.exports = {
  getMercadoPagoAccessToken: getMercadoPagoAccessToken,
};
