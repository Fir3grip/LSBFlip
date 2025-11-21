"""
visualize_bitflip_heatmaps.py

Reads bitflip_results/matrix_results.csv (produced by canitrack_bitflip_matrix_test.js)
and creates heatmaps for:
  - avg_hamming_percent
  - mean_pixel_diff_percent
  - ssim_vs_baseline

Usage:
    python visualize_bitflip_heatmaps.py

Output:
    bitflip_results/heatmaps/*.png
"""

import os
import pandas as pd
import matplotlib.pyplot as plt
import numpy as np

# --- config ---
RESULTS_DIR = "bitflip_results"
CSV_FILE = os.path.join(RESULTS_DIR, "matrix_results.csv")
OUT_DIR = os.path.join(RESULTS_DIR, "heatmaps")
os.makedirs(OUT_DIR, exist_ok=True)

# --- load data ---
df = pd.read_csv(CSV_FILE)

# ensure sorted order
df = df.sort_values(by=["bits", "percent"])

# pivot for heatmap (percent = x, bits = y)
def make_matrix(df, value_col):
    pivot = df.pivot(index="bits", columns="percent", values=value_col)
    # ensure all percent columns 1..100 exist
    for p in range(1, 101):
        if p not in pivot.columns:
            pivot[p] = np.nan
    pivot = pivot[sorted(pivot.columns)]
    pivot = pivot.sort_index(ascending=False)  # bits descending for heatmap
    return pivot

metrics = {
    "avg_hamming_percent": "Average Hamming Distance (%)",
    "mean_pixel_diff_percent": "Mean Pixel Difference (%)",
    "ssim_vs_baseline": "SSIM vs Baseline"
}

for col, title in metrics.items():
    matrix = make_matrix(df, col)
    fig, ax = plt.subplots(figsize=(12, 4.5))
    im = ax.imshow(matrix, cmap="viridis", aspect="auto", interpolation="nearest")
    cbar = plt.colorbar(im, ax=ax)
    cbar.set_label(title)

    ax.set_xlabel("Flip Percentage (%)")
    ax.set_ylabel("Bits Flipped")
    ax.set_title(title)
    ax.set_xticks(np.arange(0, 100, 10))
    ax.set_xticklabels([str(i) for i in range(1, 101, 10)])
    ax.set_yticks(np.arange(len(matrix.index)))
    ax.set_yticklabels(matrix.index)

    plt.tight_layout()
    out_path = os.path.join(OUT_DIR, f"heatmap_{col}.png")
    plt.savefig(out_path, dpi=200)
    plt.close(fig)

    print(f"✅ Saved {out_path}")

print("All heatmaps generated in:", OUT_DIR)
