"""
summarize_ssim_with_minmax.py

Reads bitflip_results/matrix_results.csv and computes:
 - Average SSIM, min SSIM, max SSIM grouped by flip percentage (1–100)
 - Average SSIM, min SSIM, max SSIM grouped by bits flipped (0–6)

Also outputs two plots:
 - SSIM vs Percentage (with min/max shading)
 - SSIM vs Bits (with min/max shading)

Output:
    bitflip_results/
        ssim_stats_by_percentage.csv
        ssim_stats_by_bits.csv
        ssim_stats_plots/
            ssim_vs_percentage.png
            ssim_vs_bits.png

Usage:
    python summarize_ssim_with_minmax.py
"""

import os
import pandas as pd
import matplotlib.pyplot as plt

# Configuration
RESULTS_DIR = "canitrack_test/bitflip_results"
CSV_FILE = os.path.join(RESULTS_DIR, "matrix_results.csv")
OUT_PLOT_DIR = os.path.join(RESULTS_DIR, "ssim_stats_plots")
os.makedirs(OUT_PLOT_DIR, exist_ok=True)

# Load CSV
df = pd.read_csv(CSV_FILE)

df["percent"] = pd.to_numeric(df["percent"], errors="coerce")
df["bits"] = pd.to_numeric(df["bits"], errors="coerce")

# Group by percentage
by_percent = df.groupby("percent")["ssim_vs_baseline"].agg(
    avg_ssim="mean",
    min_ssim="min",
    max_ssim="max"
).reset_index()

# Group by bits flipped
by_bits = df.groupby("bits")["ssim_vs_baseline"].agg(
    avg_ssim="mean",
    min_ssim="min",
    max_ssim="max"
).reset_index()

# Save individual summary CSVs
by_percent.to_csv(os.path.join(RESULTS_DIR, "ssim_stats_by_percentage.csv"), index=False)
by_bits.to_csv(os.path.join(RESULTS_DIR, "ssim_stats_by_bits.csv"), index=False)

print("Saved ssim_stats_by_percentage.csv and ssim_stats_by_bits.csv")

# Plot helper
def plot_with_minmax(df, x, title, xlabel, filename):
    plt.figure(figsize=(10, 5))

    plt.plot(df[x], df["avg_ssim"], label="Average SSIM", linewidth=2)
    plt.fill_between(df[x], df["min_ssim"], df["max_ssim"], alpha=0.25, label="Min–Max Range")

    plt.xlabel(xlabel)
    plt.ylabel("SSIM")
    plt.title(title)
    plt.grid(True, alpha=0.3)
    plt.legend()

    outpath = os.path.join(OUT_PLOT_DIR, filename)
    plt.tight_layout()
    plt.savefig(outpath, dpi=200)
    plt.close()

    print("Saved", outpath)

# Generate plots
plot_with_minmax(
    by_percent,
    x="percent",
    title="SSIM vs Flip Percentage (Average, Min, Max)",
    xlabel="Flip Percentage (%)",
    filename="ssim_vs_percentage.png"
)

plot_with_minmax(
    by_bits,
    x="bits",
    title="SSIM vs Bits Flipped (Average, Min, Max)",
    xlabel="Bits Flipped",
    filename="ssim_vs_bits.png"
)

print("All plots written to:", OUT_PLOT_DIR)
