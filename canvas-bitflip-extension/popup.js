document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("toggle");

  chrome.storage.local.get("bitflipEnabled", (data) => {
    toggle.checked = !!data.bitflipEnabled;
  });

  toggle.addEventListener("change", () => {
    chrome.storage.local.set({ bitflipEnabled: toggle.checked });
  });
});
