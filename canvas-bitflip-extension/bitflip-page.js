(function () {
  console.log("[BitFlip] Canvas protection active.");

  let flipInterval = 512;
  let noiseStrength = 1;

  chrome.storage.local.get(["flipInterval", "noiseStrength"], (d) => {
    flipInterval = d.flipInterval || 512;
    noiseStrength = d.noiseStrength || 1;
  });

  // receive updates
  window.addEventListener("message", (e) => {
    if (e.data?.type === "bitflipUpdate") {
      flipInterval = e.data.flipInterval;
      noiseStrength = e.data.noiseStrength;
    }
  });

  function applyBitflip(buffer) {
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i += flipInterval) {
      bytes[i] ^= noiseStrength;
    }
  }

  const origDataURL = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = function (...args) {
    let url = origDataURL.apply(this, args);
    if (!url.startsWith("data:image/png")) return url;

    const b64 = url.split(",")[1];
    const bin = atob(b64);
    const buf = new ArrayBuffer(bin.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);

    applyBitflip(buf);

    let out = "";
    const view2 = new Uint8Array(buf);
    for (let i = 0; i < view2.length; i++)
      out += String.fromCharCode(view2[i]);

    return "data:image/png;base64," + btoa(out);
  };

  // signal ready
  window.__bitflip_injected__ = true;
})();
