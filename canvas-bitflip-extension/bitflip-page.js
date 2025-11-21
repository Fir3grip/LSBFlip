// bitflip-page.js
/* Runs in real page context. No wrapping <script> tags when stored as a file. */
console.log('[BitFlip-page] running in page context — patching canvas');

// Example patch (replace with your robust bitflip code)
(function() {
  const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
  const origToBlob = HTMLCanvasElement.prototype.toBlob;
  const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;

  function mutateBufferBuffer(buf) {
    try {
      const bytes = new Uint8Array(buf);
      // simple deterministic-ish change for demo: flip LSB of every 512th byte
      for (let i = 0; i < bytes.length; i += 512) {
        bytes[i] ^= 1;
      }
    } catch (e) {
      // ignore
    }
  }

  HTMLCanvasElement.prototype.toDataURL = function(...args) {
    // call original to get dataURL, then modify bytes if PNG data
    try {
      const dataURL = origToDataURL.apply(this, args);
      if (typeof dataURL === 'string' && dataURL.startsWith('data:image/png;base64,')) {
        const b64 = dataURL.split(',')[1];
        const bin = atob(b64);
        const buf = new ArrayBuffer(bin.length);
        const view = new Uint8Array(buf);
        for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
        mutateBufferBuffer(buf);
        // re-encode
        let out = '';
        const mutated = new Uint8Array(buf);
        for (let i = 0; i < mutated.length; i++) out += String.fromCharCode(mutated[i]);
        return 'data:image/png;base64,' + btoa(out);
      }
      return dataURL;
    } catch (e) {
      return origToDataURL.apply(this, args);
    }
  };

  HTMLCanvasElement.prototype.toBlob = function(callback, ...args) {
    try {
      return origToBlob.call(this, blob => {
        const reader = new FileReader();
        reader.onload = e => {
          const buf = e.target.result;
          mutateBufferBuffer(buf);
          const newBlob = new Blob([buf], { type: blob.type });
          callback(newBlob);
        };
        reader.readAsArrayBuffer(blob);
      }, ...args);
    } catch (e) {
      return origToBlob.call(this, callback, ...args);
    }
  };

  CanvasRenderingContext2D.prototype.getImageData = function(...args) {
    const data = origGetImageData.apply(this, args);
    try {
      mutateBufferBuffer(data.data.buffer);
    } catch (e) {}
    return data;
  };

  // marker for diagnostics
  try { window.__bitflip_injected__ = true; } catch(e){}
  console.log('[BitFlip-page] patch installed');
})();

