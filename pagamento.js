(function () {
  var form = document.getElementById("checkout-form");
  var message = document.getElementById("form-message");
  var scrollButton = document.getElementById("scroll-checkout");
  var timer = document.getElementById("timer");
  var OFFER_KEY = "lowticket_offer_end";
  var PIX_DEFAULT_KEYS = ["105.242.435-06"];
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

  function onlyDigits(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function isRepeatedDigits(value) {
    return /^(\d)\1+$/.test(value);
  }

  function isValidCpf(value) {
    var cpf = onlyDigits(value);
    if (cpf.length !== 11 || isRepeatedDigits(cpf)) return false;

    var sum = 0;
    for (var i = 0; i < 9; i++) sum += Number(cpf.charAt(i)) * (10 - i);
    var firstDigit = (sum * 10) % 11;
    if (firstDigit === 10) firstDigit = 0;
    if (firstDigit !== Number(cpf.charAt(9))) return false;

    sum = 0;
    for (var j = 0; j < 10; j++) sum += Number(cpf.charAt(j)) * (11 - j);
    var secondDigit = (sum * 10) % 11;
    if (secondDigit === 10) secondDigit = 0;
    return secondDigit === Number(cpf.charAt(10));
  }

  function isValidCnpj(value) {
    var cnpj = onlyDigits(value);
    if (cnpj.length !== 14 || isRepeatedDigits(cnpj)) return false;

    var calc = function (size) {
      var sum = 0;
      var pos = size - 7;
      for (var i = size; i >= 1; i--) {
        sum += Number(cnpj.charAt(size - i)) * pos--;
        if (pos < 2) pos = 9;
      }
      var result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
      return result;
    };

    return calc(12) === Number(cnpj.charAt(12)) && calc(13) === Number(cnpj.charAt(13));
  }

  function detectPixKeyType(value) {
    var key = normalizePixKey(value);
    var digits = onlyDigits(key);

    if (isValidCpf(digits)) return "cpf";
    if (isValidCnpj(digits)) return "cnpj";
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key)) return "email";
    if (/^\+\d{10,15}$/.test(key)) return "phone";
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) return "evp";
    return "";
  }

  function getConfiguredPixKeys() {
    var queryParams = new URLSearchParams(window.location.search);
    var queryKey = queryParams.get("pixKey");
    var localKeysRaw = localStorage.getItem("lowticket_pix_keys");
    var localKeys = localKeysRaw ? localKeysRaw.split(",") : [];
    var candidateKeys = [];

    if (queryKey) candidateKeys.push(queryKey);
    for (var i = 0; i < localKeys.length; i++) candidateKeys.push(localKeys[i]);
    for (var j = 0; j < PIX_DEFAULT_KEYS.length; j++) candidateKeys.push(PIX_DEFAULT_KEYS[j]);

    var uniqueKeys = [];
    for (var k = 0; k < candidateKeys.length; k++) {
      var normalized = normalizePixKey(candidateKeys[k]);
      if (!normalized || uniqueKeys.indexOf(normalized) !== -1) continue;
      uniqueKeys.push(normalized);
    }
    return uniqueKeys;
  }

  function getValidPixDestination() {
    var keys = getConfiguredPixKeys();
    for (var i = 0; i < keys.length; i++) {
      var keyType = detectPixKeyType(keys[i]);
      if (keyType) {
        return {
          key: keys[i],
          type: keyType,
        };
      }
    }
    return null;
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
    var destination = getValidPixDestination();
    if (!destination) {
      throw new Error("Chave Pix invalida. Configure uma chave Pix real no checkout.");
    }

    var pixPayload = buildPixPayload({
      pixKey: destination.key,
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
        ? "Para evitar falhas de confirmacao, o pagamento foi processado em Pix. " + baseInstruction
        : baseInstruction,
      code: pixPayload,
      pixKey: destination.key,
      pixKeyType: destination.type,
      pixQrUrls: [
        "https://quickchart.io/qr?size=280&text=" + encodeURIComponent(pixPayload),
        "https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=" + encodeURIComponent(pixPayload),
      ],
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

    var orderId = "LT" + Date.now().toString(36).toUpperCase();
    var payment;
    try {
      payment = paymentData(data.method, orderId);
    } catch (pixError) {
      message.textContent = pixError.message || "Nao foi possivel gerar o Pix.";
      message.className = "form-message error";
      return;
    }

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
      pixKey: payment.pixKey || "",
      pixKeyType: payment.pixKeyType || "",
      pixQrUrl: payment.pixQrUrls && payment.pixQrUrls[0] ? payment.pixQrUrls[0] : "",
      pixQrFallbackUrl: payment.pixQrUrls && payment.pixQrUrls[1] ? payment.pixQrUrls[1] : "",
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
