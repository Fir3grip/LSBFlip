(function () {
  console.log("[BitFlip] Canvas patch active.");

  // Runtime settings (updated by background/options UI)
  let enabled = true;         // Master toggle for protection
  let flipInterval = 512;     // How often bytes are modified
  let noiseStrength = 1;      // Bitwise noise XOR value

  /**
   * Load initial settings from chrome.storage.
   * These values can be changed by the user via the UI.
   */
  function loadSettings() {
    chrome.storage.local.get(
      ["enabled", "flipInterval", "noiseStrength"],
      (d) => {
        // Fallbacks ensure stability even if storage is empty
        enabled = d.enabled ?? true;
        flipInterval = d.flipInterval ?? 512;
        noiseStrength = d.noiseStrength ?? 1;
      }
    );
  }

  loadSettings();

  /**
   * Listen for live settings updates coming from the extension UI.
   * These messages are injected into the page via content scripts.
   */
  window.addEventListener("message", (e) => {
    if (e.data?.type === "bitflipUpdate") {
      enabled = e.data.enabled;
      flipInterval = e.data.flipInterval;
      noiseStrength = e.data.noiseStrength;
    }
  });

  /**
   * mutate() applies controlled, deterministic noise
   * to a buffer of PNG byte data. This disrupts canvas
   * fingerprinting by slightly modifying pixel bytes.
   */
  function mutate(buffer) {
    if (!enabled) return;  // Toggle disables protection instantly

    const bytes = new Uint8Array(buffer);

    // Flip one byte every `flipInterval` bytes using XOR
    for (let i = 0; i < bytes.length; i += flipInterval) {
      bytes[i] ^= noiseStrength;
    }
  }

  /**
   * Patch HTMLCanvasElement.toDataURL().
   * When a website tries to read canvas pixel data,
   * this hook intercepts the PNG output and randomizes bytes.
   *
   * This is where the anti-fingerprinting effect happens.
   */
  const origDataURL = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = function (...args) {
    // Get the original PNG
    let url = origDataURL.apply(this, args);

    // Only mutate PNG output; leave JPEG etc. unchanged
    if (!url.startsWith("data:image/png")) return url;

    // Decode Base64 → binary → ArrayBuffer
    const b64 = url.split(",")[1];
    const bin = atob(b64);
    const buf = new ArrayBuffer(bin.length);
    const view = new Uint8Array(buf);

    for (let i = 0; i < bin.length; i++)
      view[i] = bin.charCodeAt(i);

    // Apply noise
    mutate(buf);

    // Encode modified bytes back to Base64
    let out = "";
    const view2 = new Uint8Array(buf);

    for (let i = 0; i < view2.length; i++)
      out += String.fromCharCode(view2[i]);

    return "data:image/png;base64," + btoa(out);
  };

})();
