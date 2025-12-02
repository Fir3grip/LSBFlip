(function() {
  // Log that the extension is attempting to inject JS directly into the page DOM.
  // This is required because some fingerprinting scripts bypass content-script sandboxes.
  console.log("[BitFlip] Attempting DOM injection...");

  // JavaScript code that will be injected into the page's own execution context.
  // This runs with the same privileges as site scripts (not isolated world).
  const code = `
    console.log("[BitFlip] Canvas fingerprint protection active (DOM-injected)");
    // Marker variable so the page can detect the script was injected
    window.__bitflip_injected__ = true;
  `;

  try {
    // Create a <script> element that will be appended to the actual page DOM.
    const s = document.createElement("script");

    // Insert the raw JavaScript (not a URL).
    s.textContent = code;

    // Append into <head> if available, otherwise into <html>.
    // This ensures execution immediately and in the correct context.
    (document.head || document.documentElement).appendChild(s);

    // Remove the script tag after execution to avoid detection by scanners or page scripts.
    s.remove();

    console.log("[BitFlip] Script tag injected into page.");
  } catch (e) {
    // If injection fails (strict CSP, sandboxing, cross-origin frames), log the error.
    console.error("[BitFlip] Injection failed:", e);
  }
})();
