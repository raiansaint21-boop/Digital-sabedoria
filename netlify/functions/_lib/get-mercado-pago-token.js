function normalizeToken(rawValue) {
  if (!rawValue) return "";

  var token = String(rawValue).trim();
  if (!token) return "";

  if (
    (token.startsWith('"') && token.endsWith('"')) ||
    (token.startsWith("'") && token.endsWith("'"))
  ) {
    token = token.slice(1, -1).trim();
  }

  if (/^Bearer\s+/i.test(token)) {
    token = token.replace(/^Bearer\s+/i, "").trim();
  }

  return token;
}

function getMercadoPagoAccessToken() {
  var supportedEnvNames = [
    "MERCADO_PAGO_ACCESS_TOKEN",
    "MERCADO_PAGO_ACESS_TOKEN",
    "MERCADOPAGO_ACCESS_TOKEN",
    "MP_ACCESS_TOKEN",
  ];

  for (var i = 0; i < supportedEnvNames.length; i += 1) {
    var token = normalizeToken(process.env[supportedEnvNames[i]]);
    if (token) return token;
  }

  return "";
}

module.exports = {
  getMercadoPagoAccessToken: getMercadoPagoAccessToken,
};
