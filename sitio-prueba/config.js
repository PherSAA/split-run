// ÚNICA configuración de contacto. Vacío = botón deshabilitado con "número pendiente".
// Christopher: escribe tu número real con código de país, solo dígitos (ej. formato "1718XXXXXXX"). No inventar.
window.PHENOM_CONFIG = {
  WHATSAPP: "",
  MENSAJE: "Hola Phenom, quiero cotizar una gotera. Te envío fotos."
};
(function () {
  var n = (window.PHENOM_CONFIG.WHATSAPP || "").replace(/\D/g, "");
  document.querySelectorAll("[data-ws]").forEach(function (a) {
    if (n.length >= 8) {
      a.href = "https://wa.me/" + n + "?text=" + encodeURIComponent(window.PHENOM_CONFIG.MENSAJE);
      a.removeAttribute("aria-disabled"); a.textContent = a.dataset.ws;
    } else {
      a.removeAttribute("href"); a.setAttribute("aria-disabled", "true"); a.setAttribute("role", "link");
      a.textContent = "WhatsApp · número pendiente";
    }
  });
})();
