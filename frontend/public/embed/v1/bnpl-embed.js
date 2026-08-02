(function () {
  // Derive the BNPL frontend origin from this script's own URL,
  // so hosts never hardcode it.
  var FRONTEND_ORIGIN = "";
  try {
    var s = document.currentScript && document.currentScript.src;
    if (s) FRONTEND_ORIGIN = new URL(s).origin;
  } catch (e) {}

  function el(tag, style) {
    var e = document.createElement(tag);
    if (style) e.setAttribute("style", style);
    return e;
  }

  window.BNPL = {
    open: function (opts) {
      opts = opts || {};
      if (!opts.handoffToken) {
        if (opts.onError) opts.onError(new Error("handoffToken is required"));
        return;
      }

      var overlay = el("div", "position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:2147483000;display:flex;align-items:center;justify-content:center;");
      var wrap = el("div", "position:relative;width:100%;max-width:480px;height:560px;max-height:92vh;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.35);");
      var closeBtn = el("button", "position:absolute;top:6px;right:10px;z-index:2;border:0;background:transparent;font-size:24px;line-height:1;cursor:pointer;color:#555;");
      closeBtn.innerHTML = "&times;";
      var iframe = el("iframe", "width:100%;height:100%;border:0;");
      iframe.setAttribute("allow", "payment");
      iframe.src =
        FRONTEND_ORIGIN +
        "/embed?ht=" + encodeURIComponent(opts.handoffToken) +
        "&host=" + encodeURIComponent(window.location.origin);

      wrap.appendChild(closeBtn);
      wrap.appendChild(iframe);
      overlay.appendChild(wrap);
      document.body.appendChild(overlay);
      var prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      function cleanup() {
        window.removeEventListener("message", onMsg);
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        document.body.style.overflow = prevOverflow;
      }
      function close(reason) { cleanup(); if (opts.onClose) opts.onClose(reason); }

      function onMsg(e) {
        if (e.origin !== FRONTEND_ORIGIN) return;
        var d = e.data || {};
        if (d.source !== "bnpl") return;

        if (d.type === "bnpl:resize" && d.height) {
          wrap.style.height = Math.min(d.height + 4, Math.floor(window.innerHeight * 0.92)) + "px";
        } else if (d.type === "bnpl:success") {
          if (opts.onSuccess) opts.onSuccess({ bookingId: d.bookingId, bookingCode: d.bookingCode });
        } else if (d.type === "bnpl:cancel") {
          close("user");
        } else if (d.type === "bnpl:error") {
          if (opts.onError) opts.onError(new Error(d.message || "bnpl_error"));
        }
      }

      window.addEventListener("message", onMsg);
      closeBtn.addEventListener("click", function () { close("close_button"); });
      overlay.addEventListener("click", function (e) { if (e.target === overlay) close("backdrop"); });

      return { close: function () { close("api"); } };
    }
  };
})();