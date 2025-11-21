// background.js (corrected)
// Put this file at the extension root and reload the extension in chrome://extensions

console.log('[BitFlip] Background service worker loaded.');

// Ensure a default stored state on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get('bitflipEnabled', (data) => {
    if (typeof data.bitflipEnabled === 'undefined') {
      chrome.storage.local.set({ bitflipEnabled: true }, () => {
        console.log('[BitFlip] Default enabled state set to true');
      });
    }
  });
});

// Helper: append <script src="chrome-extension://.../bitflip-page.js"> in page MAIN world
async function injectIntoTabByAppendingScript(tabId) {
  try {
    // Get proper extension URL in extension context
    const extUrl = chrome.runtime.getURL('bitflip-page.js');

    await chrome.scripting.executeScript({
      target: { tabId, allFrames: false },
      world: 'MAIN',
      // This function runs in the page. It receives extUrl as arg[0].
      func: (url) => {
        try {
          // avoid double-injecting
          if (document.querySelector('script[data-bitflip-extension]')) return;
          const s = document.createElement('script');
          s.setAttribute('data-bitflip-extension', '1');
          s.src = url;
          s.onload = () => {
            // note: this log shows in the page console, not service worker
            console.log('[BitFlip] bitflip-page.js loaded (page)');
          };
          s.onerror = (ev) => {
            console.error('[BitFlip] failed to load bitflip-page.js (page)', ev);
          };
          (document.head || document.documentElement).appendChild(s);
        } catch (e) {
          console.error('[BitFlip] injector func error (page)', e);
        }
      },
      args: [extUrl]
    });

    console.log('[BitFlip] requested page to append bitflip-page.js into tab', tabId);
  } catch (err) {
    console.error('[BitFlip] injectIntoTabByAppendingScript failed (background)', err);
  }
}

// Inject on top-level navigations when enabled
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // only when the page has finished loading
  if (changeInfo.status === 'complete' && tabId) {
    chrome.storage.local.get('bitflipEnabled', (data) => {
      if (data.bitflipEnabled) {
        injectIntoTabByAppendingScript(tabId);
      } else {
        console.log('[BitFlip] Off — not injecting on update.');
      }
    });
  }
});

// Optionally inject into all currently open tabs (useful when toggling on)
async function injectIntoAllTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    for (const t of tabs) {
      // skip extension / chrome internals
      if (!t.id || !t.url) continue;
      if (t.url.startsWith('chrome://') || t.url.startsWith('chrome-extension://')) continue;
      injectIntoTabByAppendingScript(t.id);
    }
  } catch (e) {
    console.error('[BitFlip] injectIntoAllTabs error', e);
  }
}

// Toggle via extension icon: flip stored state and optionally inject into current tab
chrome.action.onClicked.addListener((tab) => {
  chrome.storage.local.get('bitflipEnabled', async (data) => {
    const newState = !data.bitflipEnabled;
    await new Promise(res => chrome.storage.local.set({ bitflipEnabled: newState }, res));
    console.log(`[BitFlip] Toggled ${newState ? 'ON' : 'OFF'}`);

    if (newState) {
      // inject into the current tab immediately
      if (tab?.id) injectIntoTabByAppendingScript(tab.id);
      // also inject into other open tabs
      injectIntoAllTabs();
    } else {
      // when turning off, reload tabs so native prototypes restore
      try {
        const tabs = await chrome.tabs.query({});
        for (const t of tabs) {
          if (!t.id || !t.url) continue;
          if (t.url.startsWith('http://') || t.url.startsWith('https://') || t.url.startsWith('file://')) {
            try { chrome.tabs.reload(t.id); } catch(e) {}
          }
        }
      } catch (e) {
        console.error('[BitFlip] reloadAllTabs error', e);
      }
    }
  });
});

// Respond to popup messages (optional)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg === 'getState') {
      const data = await chrome.storage.local.get('bitflipEnabled');
      // chrome.storage.local.get returns object, but some older runtimes use callback form; safe guard:
      const enabled = typeof data === 'object' && ('bitflipEnabled' in data) ? data.bitflipEnabled : !!(await new Promise(r => chrome.storage.local.get('bitflipEnabled', d => r(d.bitflipEnabled))));
      sendResponse(enabled);
      return;
    }
    if (msg?.type === 'setState') {
      await new Promise(res => chrome.storage.local.set({ bitflipEnabled: !!msg.value }, res));
      if (msg.value) {
        injectIntoAllTabs();
      } else {
        // reload to restore native functions
        const tabs = await chrome.tabs.query({});
        for (const t of tabs) {
          if (!t.id || !t.url) continue;
          if (t.url.startsWith('http://') || t.url.startsWith('https://') || t.url.startsWith('file://')) {
            try { chrome.tabs.reload(t.id); } catch(e) {}
          }
        }
      }
      sendResponse({ ok: true });
      return;
    }
  })();
  // keep channel open for async sendResponse
  return true;
});
