// Background script for the BitFlip anti-fingerprinting extension
console.log("[BitFlip] Background loaded.");

// Runs when the extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  // Set default settings
  chrome.storage.local.set({
    enabled: true,       // Toggle: bitflip protection enabled by default
    flipInterval: 512,   // How often bits are flipped (canvas repaint cycles)
    noiseStrength: 1     // Strength of injected noise
  });
});

/**
 * Injects bitflip-page.js into a tab.
 * This script modifies the page’s JavaScript environment to protect against
 * canvas fingerprinting by randomizing pixel data.
 */
async function inject(tabId) {
  chrome.storage.local.get("enabled", (d) => {
    // Do nothing if the toggle is off
    if (!d.enabled) return;

    // Get URL for the page script that will be injected
    const url = chrome.runtime.getURL("bitflip-page.js");

    // Inject script directly into the page's main world
    chrome.scripting.executeScript({
      target: { tabId, allFrames: false },
      world: "MAIN",

      // This function runs *inside the page*
      func: (u) => {
        // Prevent injecting the script more than once
        if (document.querySelector("script[data-bitflip]")) return;

        const s = document.createElement("script");
        s.dataset.bitflip = "1"; // Mark script as injected
        s.src = u;
        document.documentElement.appendChild(s);
      },

      args: [url]
    });
  });
}

/**
 * Inject protection script once a tab finishes loading.
 */
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === "complete") inject(tabId);
});

/**
 * Listen for UI updates (slider/toggle changes).
 * Whenever the user adjusts settings, propagate the new values
 * to all open tabs so the injected page script updates live.
 */
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "settingsChanged") {
    chrome.tabs.query({}, (tabs) => {
      for (const t of tabs) {
        if (!t.id) continue;

        // Notify content script inside each tab
        chrome.tabs.sendMessage(t.id, { type: "settingsChanged" });
      }
    });
  }
});
