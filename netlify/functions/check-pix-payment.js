var getMercadoPagoAccessToken = require("./_lib/get-mercado-pago-token").getMercadoPagoAccessToken;

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
        error: "Configuracao incompleta: defina MERCADO_PAGO_ACCESS_TOKEN (ou MERCADO_PAGO_ACESS_TOKEN).",
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
          details: data && data.message ? data.message : "Erro desconhecido",
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
