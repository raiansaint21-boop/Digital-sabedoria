var getMercadoPagoAccessToken = require("./_lib/get-mercado-pago-token").getMercadoPagoAccessToken;

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: {
        "Content-Type": "application/json",
        Allow: "POST",
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

  var payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (_err) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Body JSON invalido." }),
    };
  }

  var orderId = String(payload.orderId || "").trim();
  var buyerName = String(payload.buyerName || "").trim();
  var buyerEmail = String(payload.buyerEmail || "").trim();
  var amount = Number(payload.amount);
  var description = String(payload.description || "Acesso Metodo 7 Dias").trim();

  if (!orderId) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "orderId obrigatorio." }),
    };
  }

  if (!buyerName || buyerName.length < 3) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "buyerName invalido." }),
    };
  }

  if (!buyerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail)) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "buyerEmail invalido." }),
    };
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "amount invalido." }),
    };
  }

  try {
    var mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json",
        "X-Idempotency-Key": orderId,
      },
      body: JSON.stringify({
        transaction_amount: Number(amount.toFixed(2)),
        description: description,
        payment_method_id: "pix",
        date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        payer: {
          email: buyerEmail,
          first_name: buyerName.split(" ")[0],
          last_name: buyerName.split(" ").slice(1).join(" ") || "Cliente",
        },
        external_reference: orderId,
      }),
    });

    var data = await mpResponse.json();

    if (!mpResponse.ok) {
      return {
        statusCode: mpResponse.status,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Falha ao criar cobranca Pix no provedor.",
          details: data && data.message ? data.message : "Erro desconhecido",
        }),
      };
    }

    var tx = data && data.point_of_interaction && data.point_of_interaction.transaction_data
      ? data.point_of_interaction.transaction_data
      : null;

    if (!tx || !tx.qr_code) {
      return {
        statusCode: 502,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Provedor nao retornou QR Code Pix.",
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
        qrCode: tx.qr_code,
        qrCodeBase64: tx.qr_code_base64 || "",
        ticketUrl: tx.ticket_url || "",
        amount: data.transaction_amount,
        expiresAt: data.date_of_expiration || "",
      }),
    };
  } catch (_fetchError) {
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Erro de comunicacao com o provedor de pagamento.",
      }),
    };
  }
};
