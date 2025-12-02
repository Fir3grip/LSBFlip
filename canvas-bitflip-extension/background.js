console.log("[BitFlip] Background loaded.");

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    flipInterval: 512,
    noiseStrength: 1
  });
});

// inject script into tab
async function inject(tabId) {
  const url = chrome.runtime.getURL("bitflip-page.js");
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: false },
    world: "MAIN",
    func: (u) => {
      if (document.querySelector("script[data-bitflip]")) return;
      const s = document.createElement("script");
      s.dataset.bitflip = "1";
      s.src = u;
      document.documentElement.appendChild(s);
    },
    args: [url]
  });
}

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === "complete") inject(tabId);
});

// Listen for slider updates
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "settingsChanged") {
    chrome.tabs.query({}, (tabs) => {
      for (const t of tabs) {
        if (!t.id) continue;
        chrome.tabs.sendMessage(t.id, { type: "updateSettings" });
      }
    });
  }
});
