(function () {
  var form = document.getElementById("checkout-form");
  var message = document.getElementById("form-message");
  var scrollButton = document.getElementById("scroll-checkout");
  var timer = document.getElementById("timer");
  var OFFER_KEY = "lowticket_offer_end";

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

  function paymentData(method) {
    if (method === "pix") {
      return {
        label: "Pix",
        amount: "R$ 25,65",
        instruction: "Use a chave abaixo no aplicativo do seu banco para pagar e liberar o acesso.",
        code: "pix-metodo7dias@pagamentos.com",
      };
    }
    if (method === "card") {
      return {
        label: "Cartao de credito",
        amount: "2x de R$ 14,50",
        instruction: "A compra sera aprovada em instantes. O acesso sera liberado automaticamente.",
        code: "AUTORIZACAO-IMEDIATA",
      };
    }
    return {
      label: "Boleto",
      amount: "R$ 27,00",
      instruction: "Copie o codigo e pague no app do banco. Liberacao apos compensacao.",
      code: "34191.79001 01043.510047 91020.150008 5 95280000002700",
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

    var payment = paymentData(data.method);
    var order = {
      id: "LT-" + Date.now().toString().slice(-8),
      buyerName: data.name,
      buyerEmail: data.email,
      buyerPhone: data.phone,
      method: payment.label,
      amount: payment.amount,
      instruction: payment.instruction,
      code: payment.code,
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
