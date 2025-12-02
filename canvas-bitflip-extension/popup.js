// Get references to UI controls in the extension options page
const enabledToggle = document.getElementById("enabledToggle");   // Master on/off switch
const flipSlider = document.getElementById("flipInterval");       // Byte interval slider
const noiseSlider = document.getElementById("noiseStrength");     // XOR noise intensity slider

// Load previously saved settings from chrome.storage
chrome.storage.local.get(
  ["enabled", "flipInterval", "noiseStrength"],
  (d) => {
    // Use stored values or fall back to defaults
    enabledToggle.checked = d.enabled ?? true;
    flipSlider.value = d.flipInterval ?? 512;
    noiseSlider.value = d.noiseStrength ?? 1;
  }
);

/**
 * Saves the current UI values into chrome.storage
 * and notifies all extension scripts that settings changed.
 */
function save() {
  chrome.storage.local.set({
    enabled: enabledToggle.checked,
    flipInterval: Number(flipSlider.value),     // Ensure numeric values
    noiseStrength: Number(noiseSlider.value)
  }, () => {
    // Tell all tabs + background scripts to update their settings
    chrome.runtime.sendMessage({ type: "settingsChanged" });
  });
}

// Whenever the user interacts with any UI control, save and propagate changes
enabledToggle.addEventListener("change", save);  // toggle switch
flipSlider.addEventListener("input", save);      // slider for interval
noiseSlider.addEventListener("input", save);     // slider for noise amount
