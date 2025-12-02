const flipSlider = document.getElementById("flipInterval");
const noiseSlider = document.getElementById("noiseStrength");

chrome.storage.local.get(["flipInterval", "noiseStrength"], (d) => {
  flipSlider.value = d.flipInterval;
  noiseSlider.value = d.noiseStrength;
});

function update() {
  chrome.storage.local.set({
    flipInterval: Number(flipSlider.value),
    noiseStrength: Number(noiseSlider.value)
  }, () => {
    chrome.runtime.sendMessage({ type: "settingsChanged" });
  });
}

flipSlider.addEventListener("input", update);
noiseSlider.addEventListener("input", update);
