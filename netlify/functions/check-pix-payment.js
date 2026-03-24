var getMercadoPagoAccessToken = require("./_lib/get-mercado-pago-token").getMercadoPagoAccessToken;

function extractMercadoPagoError(data) {
  if (!data || typeof data !== "object") return "Erro desconhecido";
  if (typeof data.message === "string" && data.message.trim()) return data.message.trim();
  if (typeof data.error_description === "string" && data.error_description.trim()) return data.error_description.trim();
  if (typeof data.error === "string" && data.error.trim()) return data.error.trim();
  if (Array.isArray(data.cause) && data.cause.length > 0) {
    var cause = data.cause[0];
    if (cause && typeof cause.description === "string" && cause.description.trim()) {
      return cause.description.trim();
    }
  }

  return "Erro desconhecido";
}

exports.handler = async function (event) {
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: {
        "Content-Type": "application/json",
        Allow: "GET",
      },
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  var accessToken = getMercadoPagoAccessToken();
  if (!accessToken) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Configuracao incompleta: defina MERCADO_PAGO_ACCESS_TOKEN (aceita tambem MERCADO_PAGO_ACESS_TOKEN, MERCADOPAGO_ACCESS_TOKEN ou MP_ACCESS_TOKEN).",
      }),
    };
  }

  var paymentId = event.queryStringParameters && event.queryStringParameters.paymentId
    ? String(event.queryStringParameters.paymentId).trim()
    : "";

  if (!paymentId) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "paymentId obrigatorio." }),
    };
  }

  try {
    var mpResponse = await fetch("https://api.mercadopago.com/v1/payments/" + encodeURIComponent(paymentId), {
      method: "GET",
      headers: {
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json",
      },
    });

    var data = await mpResponse.json();

    if (!mpResponse.ok) {
      return {
        statusCode: mpResponse.status,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Falha ao consultar status do pagamento.",
          details: extractMercadoPagoError(data),
        }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "mercado_pago",
        paymentId: data.id,
        status: data.status,
        statusDetail: data.status_detail || "",
        approved: data.status === "approved",
        paidAt: data.date_approved || "",
      }),
    };
  } catch (_fetchError) {
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Erro de comunicacao com o provedor." }),
    };
  }
};
