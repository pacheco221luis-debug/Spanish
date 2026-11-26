var PRIVACY_VERSION = "1.1"; // keep in sync with the "Last updated" version in privacy.html

window.turnstileToken = "";
function onTurnstileSuccess(token) {
  window.turnstileToken = token;
  var err = document.getElementById("e-ts");
  if (err) { err.classList.remove("show"); err.textContent = ""; }
}
function onTurnstileExpired() { window.turnstileToken = ""; }

(function () {
  // Mobile menu
  var bb = document.getElementById("bb"), menu = document.getElementById("menu");
  function setMenu(open) {
    menu.classList.toggle("open", open);
    bb.setAttribute("aria-expanded", String(open));
    bb.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }
  if (bb && menu) {
    bb.addEventListener("click", function () { setMenu(!menu.classList.contains("open")); });
    menu.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menu.classList.contains("open")) { setMenu(false); bb.focus(); }
    });
  }

  // Conversation bubbles: Spanish is always visible, English appears on tap.
  // Without JavaScript the translations simply stay visible.
  document.querySelectorAll(".say").forEach(function (b) {
    var target = document.getElementById(b.getAttribute("aria-controls"));
    if (!target) return;
    target.hidden = true;
    b.setAttribute("aria-expanded", "false");
    b.addEventListener("click", function () {
      var open = b.getAttribute("aria-expanded") !== "true";
      b.setAttribute("aria-expanded", String(open));
      target.hidden = !open;
    });
  });

  // Inquiry form
  var f = document.getElementById("f"), st = document.getElementById("status");
  if (!f) return;
  var sb = document.getElementById("sb");
  var sbLabel = sb ? sb.textContent : "";

  function bad(id, msg, control) {
    var e = document.getElementById("e-" + id);
    if (e) { e.textContent = msg; e.classList.add("show"); }
    if (control) { control.setAttribute("aria-invalid", "true"); }
    return control;
  }

  f.addEventListener("submit", function (ev) {
    ev.preventDefault();
    st.className = "";
    f.querySelectorAll(".err").forEach(function (e) { e.classList.remove("show"); e.textContent = ""; });
    f.querySelectorAll("[aria-invalid]").forEach(function (c) { c.removeAttribute("aria-invalid"); });

    var v = function (n) { return f.elements[n]; }, first = null;
    function add(x) { if (!first) first = x; }

    if (!v("name").value.trim()) add(bad("name", "Please tell us your name.", v("name")));
    var phRaw = v("phone").value.trim(), ph = phRaw.replace(/\D/g, "");
    if (!/^\+?[\d\s().-]{7,40}$/.test(phRaw) || ph.length < 7 || ph.length > 15) {
      add(bad("phone", "Please enter a valid phone number including country code.", v("phone")));
    }
    var em = v("email").value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) add(bad("email", em ? "Check your email address." : "Please enter your email address.", v("email")));
    if (!v("level").value) add(bad("level", "Please choose a level.", v("level")));
    if (!f.querySelector("input[name=int]:checked")) add(bad("int", "Please choose at least one topic.", f.querySelector("input[name=int]")));
    if (!f.querySelector("input[name=days]:checked")) add(bad("days", "Please choose at least one day.", f.querySelector("input[name=days]")));
    if (!v("time").value) add(bad("time", "Please choose a time range.", v("time")));
    if (!v("priv").checked) add(bad("priv", "Please accept the Privacy Policy to continue.", v("priv")));

    if (first) { st.textContent = "Please check the highlighted fields."; st.className = "show"; first.focus(); return; }
    if (v("website").value) return;

    var token = window.turnstileToken || "";
    if (!token) {
      bad("ts", "Please complete the security check.", document.getElementById("ts"));
      st.textContent = "Please complete the security check before sending.";
      st.className = "show";
      return;
    }

    if (sb.disabled) return;
    sb.disabled = true;
    sb.textContent = "Sending…";

    var pick = function (n) {
      return Array.prototype.map.call(f.querySelectorAll("input[name=" + n + "]:checked"), function (x) { return x.value; });
    };

    var body = {
      name: v("name").value.trim(),
      phone: phRaw,
      email: em,
      level: v("level").value,
      interests: pick("int"),
      days: pick("days"),
      time: v("time").value,
      comments: v("msg").value.trim(),
      privacyConsent: true,
      consentTimestamp: new Date().toISOString(),
      privacyVersion: PRIVACY_VERSION,
      token: token
    };

    var controller = new AbortController();
    var timeoutId = setTimeout(function () { controller.abort(); }, 12000);

    fetch(f.action, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal
    })
      .then(function (r) {
        clearTimeout(timeoutId);
        return r.json().catch(function () { return {}; }).then(function (data) {
          if (!r.ok || data.success !== true) throw new Error(data.error || "server_error");
          return data;
        });
      })
      .then(function () {
        var ok = document.getElementById("ok");
        f.hidden = true;
        ok.hidden = false;
        ok.focus();
        ok.scrollIntoView({ block: "center" });
      })
      .catch(function (err) {
        clearTimeout(timeoutId);
        if (err.name === "AbortError") {
          st.textContent = "The request took too long. Please check your connection and try again.";
        } else if (err.message && err.message.indexOf("not configured") !== -1) {
          st.textContent = "The online form is being prepared. Please try again later.";
        } else {
          st.textContent = "We couldn’t confirm that your details were saved. Please try again in a few minutes.";
        }
        st.className = "show";
        if (window.turnstile) { try { turnstile.reset(); } catch (e) {} }
        window.turnstileToken = "";
      })
      .finally(function () {
        sb.disabled = false;
        sb.textContent = sbLabel;
      });
  });
})();
