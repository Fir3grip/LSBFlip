"""
summarize_bitflip_metrics.py

Reads bitflip_results/matrix_results.csv and computes:
 - Average SSIM by flip percentage
 - Average SSIM by bits flipped
 - Average Hamming distance by flip percentage
 - Average Hamming distance by bits flipped

Also saves:
 - summary_percentages.csv
 - summary_bits.csv
And generates line charts in bitflip_results/summary_plots/.

Usage:
    python summarize_bitflip_metrics.py
"""

import os
import pandas as pd
import matplotlib.pyplot as plt

# === CONFIG ===
RESULTS_DIR = "bitflip_results"
CSV_FILE = os.path.join(RESULTS_DIR, "matrix_results.csv")
OUT_DIR = os.path.join(RESULTS_DIR, "summary_plots")
os.makedirs(OUT_DIR, exist_ok=True)

# === LOAD DATA ===
df = pd.read_csv(CSV_FILE)

# Ensure numeric
df["percent"] = pd.to_numeric(df["percent"], errors="coerce")
df["bits"] = pd.to_numeric(df["bits"], errors="coerce")

# === AVERAGE BY FLIP PERCENT ===
by_percent = df.groupby("percent").agg({
    "ssim_vs_baseline": "mean",
    "avg_hamming_percent": "mean"
}).reset_index()

# === AVERAGE BY BITS FLIPPED ===
by_bits = df.groupby("bits").agg({
    "ssim_vs_baseline": "mean",
    "avg_hamming_percent": "mean"
}).reset_index()

# === SAVE CSV SUMMARIES ===
by_percent.to_csv(os.path.join(RESULTS_DIR, "summary_percentages.csv"), index=False)
by_bits.to_csv(os.path.join(RESULTS_DIR, "summary_bits.csv"), index=False)

print("✅ Saved:")
print("  summary_percentages.csv — averages per flip percentage")
print("  summary_bits.csv — averages per bits flipped")

# === PLOT HELPERS ===
def plot_line(df, x, y, ylabel, title, filename):
    plt.figure(figsize=(8,4))
    plt.plot(df[x], df[y], marker="o")
    plt.xlabel(x.replace("_", " ").title())
    plt.ylabel(ylabel)
    plt.title(title)
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    path = os.path.join(OUT_DIR, filename)
    plt.savefig(path, dpi=200)
    plt.close()
    print(f"  📈 Saved {path}")

# === PLOTS ===
plot_line(by_percent, "percent", "ssim_vs_baseline",
          "Average SSIM", "Average SSIM vs Flip Percentage",
          "ssim_vs_percent.png")

plot_line(by_percent, "percent", "avg_hamming_percent",
          "Average Hamming Distance (%)", "Average Hamming Distance vs Flip Percentage",
          "hamming_vs_percent.png")

plot_line(by_bits, "bits", "ssim_vs_baseline",
          "Average SSIM", "Average SSIM vs Bits Flipped",
          "ssim_vs_bits.png")

plot_line(by_bits, "bits", "avg_hamming_percent",
          "Average Hamming Distance (%)", "Average Hamming Distance vs Bits Flipped",
          "hamming_vs_bits.png")

print("\nAll summary plots and CSVs written to:", OUT_DIR)
