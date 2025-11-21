(function() {
  console.log("[BitFlip] Attempting DOM injection...");

  const code = `
    console.log("[BitFlip] Canvas fingerprint protection active (DOM-injected)");
    window.__bitflip_injected__ = true;
  `;

  try {
    const s = document.createElement("script");
    s.textContent = code;
    (document.head || document.documentElement).appendChild(s);
    s.remove();
    console.log("[BitFlip] Script tag injected into page.");
  } catch (e) {
    console.error("[BitFlip] Injection failed:", e);
  }
})();
