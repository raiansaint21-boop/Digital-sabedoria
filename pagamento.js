(function () {
  var form = document.getElementById("checkout-form");
  var message = document.getElementById("form-message");
  var scrollButton = document.getElementById("scroll-checkout");
  var submitButton = document.getElementById("pay-btn");
  var timer = document.getElementById("timer");

  var OFFER_KEY = "lowticket_offer_end";
  var OFFER_PRICE = 27.0;

  function formatTime(seconds) {
    var h = String(Math.floor(seconds / 3600)).padStart(2, "0");
    var m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
    var s = String(seconds % 60).padStart(2, "0");
    return h + ":" + m + ":" + s;
  }

  function initTimer() {
    if (!timer) return;

    var end = Number(localStorage.getItem(OFFER_KEY));
    if (!end || end < Date.now()) {
      end = Date.now() + 5 * 60 * 60 * 1000;
      localStorage.setItem(OFFER_KEY, String(end));
    }

    function tick() {
      var diff = Math.max(0, Math.floor((end - Date.now()) / 1000));
      timer.textContent = formatTime(diff);
      if (diff === 0) {
        end = Date.now() + 5 * 60 * 60 * 1000;
        localStorage.setItem(OFFER_KEY, String(end));
      }
    }

    tick();
    setInterval(tick, 1000);
  }

  function cleanPhone(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function validate(data) {
    if (!data.name || data.name.trim().length < 3) return "Informe um nome valido.";
    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return "Informe um e-mail valido.";
    if (cleanPhone(data.phone).length < 10) return "Informe um WhatsApp valido com DDD.";
    if (!data.method) return "Escolha uma forma de pagamento.";
    if (!data.terms) return "E necessario aceitar os termos para continuar.";
    return "";
  }

  function formatProviderError(payload) {
    if (!payload || typeof payload !== "object") {
      return "Nao foi possivel criar a cobranca Pix no momento.";
    }

    if (payload.error) {
      if (payload.details) return payload.error + " " + payload.details;
      return payload.error;
    }

    return "Nao foi possivel criar a cobranca Pix no momento.";
  }

  async function createPixPayment(orderInput) {
    var response = await fetch("/.netlify/functions/create-pix-payment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderInput),
    });

    var data;
    try {
      data = await response.json();
    } catch (_err) {
      data = null;
    }

    if (!response.ok) {
      throw new Error(formatProviderError(data));
    }

    if (!data || !data.qrCode || !data.paymentId) {
      throw new Error("A cobranca Pix foi criada de forma incompleta. Tente novamente.");
    }

    return data;
  }

  function makeQrImageUrl(charge) {
    if (charge.qrCodeBase64) {
      return "data:image/png;base64," + charge.qrCodeBase64;
    }

    return "https://quickchart.io/qr?size=280&text=" + encodeURIComponent(charge.qrCode);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form || !message) return;

    var data = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim(),
      method: form.method.value,
      terms: form.terms.checked,
    };

    var error = validate(data);
    if (error) {
      message.textContent = error;
      message.className = "form-message error";
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Gerando cobranca Pix...";
    }

    message.textContent = "Criando sua cobranca Pix segura...";
    message.className = "form-message";

    var orderId = "LT" + Date.now().toString(36).toUpperCase();

    try {
      var charge = await createPixPayment({
        orderId: orderId,
        buyerName: data.name,
        buyerEmail: data.email,
        amount: OFFER_PRICE,
        description: "Acesso Metodo 7 Dias",
      });

      var order = {
        id: orderId,
        buyerName: data.name,
        buyerEmail: data.email,
        buyerPhone: data.phone,
        selectedMethod: data.method,
        method: "Pix",
        amount: "R$ 27,00",
        instruction: "Escaneie o QR Code no aplicativo do seu banco ou use o Pix Copia e Cola abaixo.",
        code: charge.qrCode,
        pixQrUrl: makeQrImageUrl(charge),
        pixQrFallbackUrl: "https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=" + encodeURIComponent(charge.qrCode),
        provider: charge.provider || "mercado_pago",
        providerPaymentId: String(charge.paymentId),
        providerStatus: String(charge.status || "pending"),
        providerStatusDetail: String(charge.statusDetail || ""),
        expiresAt: String(charge.expiresAt || ""),
        createdAt: new Date().toISOString(),
      };

      localStorage.setItem("lowticket_last_order", JSON.stringify(order));

      message.textContent = "Pagamento Pix criado com sucesso. Redirecionando...";
      message.className = "form-message success";

      setTimeout(function () {
        window.location.href = "obrigado.html";
      }, 600);
    } catch (paymentError) {
      message.textContent = paymentError.message || "Nao foi possivel gerar o Pix.";
      message.className = "form-message error";

      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Gerar pagamento";
      }
    }
  }

  if (scrollButton) {
    scrollButton.addEventListener("click", function () {
      var checkout = document.getElementById("checkout");
      if (checkout) checkout.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  if (form) form.addEventListener("submit", handleSubmit);

  initTimer();
})();
