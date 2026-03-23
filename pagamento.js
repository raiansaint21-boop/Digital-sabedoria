(function () {
  var form = document.getElementById("checkout-form");
  var message = document.getElementById("form-message");
  var scrollButton = document.getElementById("scroll-checkout");
  var timer = document.getElementById("timer");
  var OFFER_KEY = "lowticket_offer_end";
  var PIX_CPF_KEY = "105.242.435-06";
  var PIX_RECEIVER_NAME = "DIGITAL BLACKS";
  var PIX_RECEIVER_CITY = "SALVADOR";
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
    return value.replace(/\D/g, "");
  }

  function padField(id, value) {
    var stringValue = String(value);
    return id + String(stringValue.length).padStart(2, "0") + stringValue;
  }

  function sanitizePixText(value) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9 ]/g, "")
      .trim()
      .toUpperCase();
  }

  function normalizePixKey(rawKey) {
    var key = String(rawKey || "").trim();
    var digits = key.replace(/\D/g, "");

    if (digits.length === 11 || digits.length === 14) return digits;
    if (key.indexOf("@") !== -1) return key.toLowerCase();
    if (key.charAt(0) === "+") return "+" + digits;
    return key.replace(/[^\w\-./:@+]/g, "");
  }

  function crc16(payload) {
    var polinomio = 0x1021;
    var resultado = 0xffff;
    for (var i = 0; i < payload.length; i++) {
      resultado ^= payload.charCodeAt(i) << 8;
      for (var j = 0; j < 8; j++) {
        if ((resultado & 0x8000) !== 0) {
          resultado = (resultado << 1) ^ polinomio;
        } else {
          resultado = resultado << 1;
        }
        resultado &= 0xffff;
      }
    }
    return resultado.toString(16).toUpperCase().padStart(4, "0");
  }

  function buildPixPayload(options) {
    var pixKey = normalizePixKey(options.pixKey);
    var merchantName = sanitizePixText(options.merchantName).slice(0, 25) || "RECEBEDOR";
    var merchantCity = sanitizePixText(options.merchantCity).slice(0, 15) || "SAO PAULO";
    var txid = sanitizePixText(options.txid || "***").replace(/\s/g, "").slice(0, 25) || "***";
    var amount = Number(options.amount).toFixed(2);

    var gui = padField("00", "BR.GOV.BCB.PIX");
    var keyField = padField("01", pixKey);
    var merchantAccountInfo = padField("26", gui + keyField);
    var additionalData = padField("62", padField("05", txid));

    var payloadSemCrc =
      padField("00", "01") +
      padField("01", "11") +
      merchantAccountInfo +
      padField("52", "0000") +
      padField("53", "986") +
      padField("54", amount) +
      padField("58", "BR") +
      padField("59", merchantName) +
      padField("60", merchantCity) +
      additionalData +
      "6304";

    return payloadSemCrc + crc16(payloadSemCrc);
  }

  function paymentData(method, orderId) {
    var pixPayload = buildPixPayload({
      pixKey: PIX_CPF_KEY,
      merchantName: PIX_RECEIVER_NAME,
      merchantCity: PIX_RECEIVER_CITY,
      txid: orderId,
      amount: OFFER_PRICE,
    });

    var converted = method === "card" || method === "boleto";
    var methodLabel = converted ? "Pix (confirmacao imediata)" : "Pix";
    var baseInstruction = "Escaneie o QR Code no aplicativo do seu banco ou use o Pix Copia e Cola abaixo.";

    return {
      label: methodLabel,
      originalMethod: method,
      amount: "R$ 27,00",
      instruction: converted
        ? "Para evitar indisponibilidade de instituicao em compensacao, o pagamento foi convertido para Pix. " + baseInstruction
        : baseInstruction,
      code: pixPayload,
      pixKey: PIX_CPF_KEY,
      pixQrUrl: "https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=" + encodeURIComponent(pixPayload),
    };
  }

  function validate(data) {
    if (!data.name || data.name.trim().length < 3) return "Informe um nome valido.";
    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return "Informe um e-mail valido.";
    if (cleanPhone(data.phone).length < 10) return "Informe um WhatsApp valido com DDD.";
    if (!data.method) return "Escolha uma forma de pagamento.";
    if (!data.terms) return "E necessario aceitar os termos para continuar.";
    return "";
  }

  function handleSubmit(event) {
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

    var orderId = "LT-" + Date.now().toString().slice(-8);
    var payment = paymentData(data.method, orderId);
    var order = {
      id: orderId,
      buyerName: data.name,
      buyerEmail: data.email,
      buyerPhone: data.phone,
      selectedMethod: data.method,
      method: payment.label,
      amount: payment.amount,
      instruction: payment.instruction,
      code: payment.code,
      pixQrUrl: payment.pixQrUrl || "",
      createdAt: new Date().toISOString(),
    };

    localStorage.setItem("lowticket_last_order", JSON.stringify(order));
    message.textContent = "Pedido criado com sucesso. Redirecionando para confirmacao...";
    message.className = "form-message success";

    setTimeout(function () {
      window.location.href = "obrigado.html";
    }, 700);
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
