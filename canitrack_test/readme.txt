This is the html file and test harness for LSBFlip.

The html file is "bitflipped.html".
All you have to do to use it is download it and load it into your favorite browser.

The test harness is "canitrack_fingerprint_test.js" which is run through Node.js.
To run the test harness you need to have puppeteer, fs-extra, canvas, and ssim.js.
When ready make sure the test harness and bitflipped.html file are in the same folder.

The two python files are used to summarize the results and create heatmaps and plots.
To run these you need to make sure to have pandas, numpy, and pyplot installed.
Once the test harness has finished running you can run the two python scripts and it will
generate the plots and heatmaps in "canitrack_test\bitflip_results\summary_plots" and
"canitrack_test\bitflip_results\heatmaps" respectively.