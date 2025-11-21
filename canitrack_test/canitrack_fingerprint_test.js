/**
 * canitrack_bitflip_matrix_test.js
 *
 * Runs fingerprint.html across percentage = 1..100 and bitsToFlip = 0..6.
 * Produces JSON and CSV summary and saves representative images.
 *
 * Requires:
 *   npm install puppeteer fs-extra canvas ssim.js
 *
 * Usage:
 *   node canitrack_bitflip_matrix_test.js
 */

const puppeteer = require("puppeteer");
const crypto = require("crypto");
const fs = require("fs-extra");
const { createCanvas, loadImage } = require("canvas");
const { ssim } = require("ssim.js");
const path = require("path");

// ---------- CONFIG ----------
const TEST_URL = "file://" + process.cwd() + "/bitflipped.html";
const WIDTH = 400;
const HEIGHT = 120;
const RUNS_PER_SETTING = 10;    // samples per (percent, bits) - increase for more stable stats
const RESULTS_DIR = "bitflip_results";
const USE_SEEDED = true;      // set true for deterministic changes per config
const SHOW_MODIFIED = false;  // if true, shows red overlay; usually false for pixel metrics
// ----------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function sha256Hex(bufferOrString) {
  // Accept either Buffer or string
  return crypto.createHash("sha256").update(bufferOrString).digest("hex");
}
function base64ToBuffer(dataURL) {
  return Buffer.from(dataURL.split(",")[1], "base64");
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}
function hammingPercent(hexA, hexB) {
  if (hexA.length !== hexB.length) throw new Error("hex lengths differ");
  const a = hexToBytes(hexA);
  const b = hexToBytes(hexB);
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    let x = a[i] ^ b[i];
    // popcount
    while (x) {
      dist += x & 1;
      x >>>= 1;
    }
  }
  const bits = a.length * 8;
  return (dist / bits) * 100;
}

// Average a set of PNG buffers into a Canvas (returns a node-canvas Canvas)
async function averageBuffers(buffers) {
  const imgs = await Promise.all(buffers.map((b) => loadImage(b)));
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");
  const acc = new Float64Array(WIDTH * HEIGHT * 4);

  for (const img of imgs) {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.drawImage(img, 0, 0, WIDTH, HEIGHT);
    const data = ctx.getImageData(0, 0, WIDTH, HEIGHT).data;
    for (let i = 0; i < data.length; i++) acc[i] += data[i];
  }

  const out = ctx.createImageData(WIDTH, HEIGHT);
  for (let i = 0; i < out.data.length; i++) out.data[i] = Math.round(acc[i] / buffers.length);
  ctx.putImageData(out, 0, 0);
  return canvas;
}

async function computeMeanPixelDiff(bufferA, canvasB) {
  const imgA = await loadImage(bufferA);
  const canvasA = createCanvas(WIDTH, HEIGHT);
  const ctxA = canvasA.getContext("2d");
  ctxA.drawImage(imgA, 0, 0, WIDTH, HEIGHT);
  const a = ctxA.getImageData(0, 0, WIDTH, HEIGHT).data;
  const b = canvasB.getContext("2d").getImageData(0, 0, WIDTH, HEIGHT).data;

  let diff = 0;
  for (let i = 0; i < a.length; i++) diff += Math.abs(a[i] - b[i]);
  const max = WIDTH * HEIGHT * 4 * 255;
  return (diff / max) * 100;
}

async function computeSSIM(bufferA, canvasB) {
  const imgA = await loadImage(bufferA);
  const canvasA = createCanvas(WIDTH, HEIGHT);
  const ctxA = canvasA.getContext("2d");
  ctxA.drawImage(imgA, 0, 0, WIDTH, HEIGHT);
  const idA = ctxA.getImageData(0, 0, WIDTH, HEIGHT);

  const ctxB = canvasB.getContext("2d");
  const idB = ctxB.getImageData(0, 0, WIDTH, HEIGHT);

  const lumA = new Uint8ClampedArray(WIDTH * HEIGHT);
  const lumB = new Uint8ClampedArray(WIDTH * HEIGHT);
  for (let i = 0, p = 0; i < idA.data.length; i += 4, p++) {
    lumA[p] = Math.round(0.299 * idA.data[i] + 0.587 * idA.data[i + 1] + 0.114 * idA.data[i + 2]);
    lumB[p] = Math.round(0.299 * idB.data[i] + 0.587 * idB.data[i + 1] + 0.114 * idB.data[i + 2]);
  }
  const { mssim } = ssim({ data: lumA, width: WIDTH, height: HEIGHT }, { data: lumB, width: WIDTH, height: HEIGHT });
  return mssim;
}

async function ensureResultsDir() {
  await fs.ensureDir(RESULTS_DIR);
  await fs.ensureDir(path.join(RESULTS_DIR, "images"));
}

async function setControlsOnPage(page, flipPercent, bitsToFlip, useSeeded = USE_SEEDED, showModified = SHOW_MODIFIED) {
  // sets slider values and checkbox states, then dispatches input events to trigger UI handlers
  await page.evaluate(
    (flip, bits, seeded, show) => {
      const flipEl = document.getElementById("flipPercent");
      const flipLabel = document.getElementById("flipPercentLabel");
      const bitsEl = document.getElementById("bitsToFlip");
      const bitsLabel = document.getElementById("bitsToFlipLabel");
      const seededEl = document.getElementById("useSeeded");
      const showEl = document.getElementById("showModified");

      if (flipEl) { flipEl.value = flip; if (flipLabel) flipLabel.textContent = flip + "%"; flipEl.dispatchEvent(new Event("input")); }
      if (bitsEl) { bitsEl.value = bits; if (bitsLabel) bitsLabel.textContent = bits; bitsEl.dispatchEvent(new Event("input")); }
      if (seededEl) { seededEl.checked = seeded; seededEl.dispatchEvent(new Event("change")); }
      if (showEl) { showEl.checked = show; showEl.dispatchEvent(new Event("change")); }

      // Also trigger regenerate button if present (some pages use it)
      const regen = document.getElementById("regenerate");
      if (regen) regen.click();
    },
    flipPercent,
    bitsToFlip,
    useSeeded,
    showModified
  );
}

async function captureCanvasDataURL(page) {
  return await page.evaluate(() => {
    const c = document.getElementById("fpCanvas");
    return c.toDataURL("image/png");
  });
}

async function captureSamplesForSetting(page, flipPercent, bitsToFlip, runs = RUNS_PER_SETTING) {
  const samples = [];
  for (let i = 0; i < runs; i++) {
    // navigate to reset page state
    await page.goto(TEST_URL, { waitUntil: "load" });

    // set sliders / checkboxes
    await setControlsOnPage(page, flipPercent, bitsToFlip, USE_SEEDED, SHOW_MODIFIED);

    // give rendering a bit of time
    await sleep(150);

    // capture
    const dataURL = await captureCanvasDataURL(page);
    const buf = base64ToBuffer(dataURL);
    const hash = sha256Hex(buf); // hash of pixel PNG bytes -> stable
    samples.push({ dataURL, buf, hash });
  }
  return samples;
}

(async () => {
  await ensureResultsDir();
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  const page = await browser.newPage();
  page.setViewport({ width: WIDTH, height: HEIGHT });

  console.log("Collecting baseline (0% flip, 0 bits) ...");
  const baselineSamples = await captureSamplesForSetting(page, 0, 0, RUNS_PER_SETTING);
  const baselineBuf = baselineSamples[0].buf;
  const baselineHash = baselineSamples[0].hash;
  const baselineAvgCanvas = await averageBuffers(baselineSamples.map(s => s.buf));
  await fs.writeFile(path.join(RESULTS_DIR, "baseline_sample0.png"), baselineBuf);
  await fs.writeFile(path.join(RESULTS_DIR, "baseline_avg.png"), baselineAvgCanvas.toBuffer("image/png"));

  const results = [];
  // Loop percent 1..100 and bits 0..6
  for (let percent = 1; percent <= 100; percent++) {
    for (let bits = 0; bits <= 6; bits++) {
      console.log(`Testing: ${percent}%  | bits: ${bits}  (runs=${RUNS_PER_SETTING})`);
      const samples = await captureSamplesForSetting(page, percent, bits, RUNS_PER_SETTING);

      // aggregate
      const uniqueHashes = new Set(samples.map(s => s.hash)).size;
      const repetitionRate = 1 - uniqueHashes / RUNS_PER_SETTING;

      // Hamming distances from baseline hash for each sample
      const hammingVals = samples.map(s => hammingPercent(baselineHash, s.hash));
      const avgHamming = hammingVals.reduce((a,b) => a + b, 0) / hammingVals.length;

      // average image
      const avgCanvas = await averageBuffers(samples.map(s => s.buf));
      const avgPNG = avgCanvas.toBuffer("image/png");
      const avgFilename = path.join(RESULTS_DIR, "images", `avg_pct${String(percent).padStart(3,"0")}_bits${bits}.png`);
      await fs.writeFile(avgFilename, avgPNG);

      // pixel diff and SSIM vs baseline (use baseline first sample as baseline reference)
      const meanPixelDiff = await computeMeanPixelDiff(baselineBuf, avgCanvas);
      const ssimVal = await computeSSIM(baselineBuf, avgCanvas);

      // save a sample image from this run (first sample)
      const sampleFilename = path.join(RESULTS_DIR, "images", `sample_pct${String(percent).padStart(3,"0")}_bits${bits}.png`);
      await fs.writeFile(sampleFilename, samples[0].buf);

      const entry = {
        percent,
        bits,
        runs: RUNS_PER_SETTING,
        unique_hashes: uniqueHashes,
        repetition_rate: repetitionRate,
        avg_hamming_percent: avgHamming,
        mean_pixel_diff_percent: meanPixelDiff,
        ssim_vs_baseline: ssimVal,
        sample_hash: samples[0].hash,
        avg_image: path.relative(process.cwd(), avgFilename),
        sample_image: path.relative(process.cwd(), sampleFilename)
      };

      results.push(entry);

      // light pause to avoid overwhelming
      await sleep(40);
    }
  }

  // Save JSON and CSV summaries
  await fs.writeJSON(path.join(RESULTS_DIR, "matrix_results.json"), results, { spaces: 2 });
  const csvHeader = "percent,bits,runs,unique_hashes,repetition_rate,avg_hamming_percent,mean_pixel_diff_percent,ssim_vs_baseline,sample_hash,avg_image,sample_image\n";
  const csvRows = results.map(r =>
    [
      r.percent, r.bits, r.runs, r.unique_hashes, r.repetition_rate.toFixed(6),
      r.avg_hamming_percent.toFixed(6), r.mean_pixel_diff_percent.toFixed(6), r.ssim_vs_baseline.toFixed(6),
      r.sample_hash, `"${r.avg_image}"`, `"${r.sample_image}"`
    ].join(",")
  );
  await fs.writeFile(path.join(RESULTS_DIR, "matrix_results.csv"), csvHeader + csvRows.join("\n"));

  console.log("Done. Results saved to:", RESULTS_DIR);
  await browser.close();
})();
