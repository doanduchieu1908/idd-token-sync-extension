/* ─────────────────────────────────────────────────────────
   Background service-worker
   Handles all Chrome-API work so it survives popup close
   ───────────────────────────────────────────────────────── */

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'setTokens') {
    handleSetTokens(msg.column, msg.mainUrl, msg.targets, msg.reloadFirst, msg.autoOpenTab)
      .then(result => sendResponse({ success: true, ...result }))
      .catch(err  => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

/* ── core logic ── */

async function handleSetTokens(column, mainUrl, targets, reloadFirst, autoOpenTab) {
  const normalizedMain = normalizeUrl(mainUrl);
  const tab = await findOrOpenTab(normalizedMain);

  if (reloadFirst) {
    await reloadAndWait(tab.id);
  }

  const [{ result: token }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => localStorage.getItem('iddToken'),
  });

  if (!token) throw new Error(`Không tìm thấy iddToken trong localStorage của ${column.toUpperCase()} (sau khi reload)`);

  let successCount = 0;
  let skippedCount = 0;
  const errors = [];

  for (const targetUrl of targets) {
    try {
      const targetTab = autoOpenTab
        ? await findOrOpenTab(normalizeUrl(targetUrl))
        : await findTabOnly(normalizeUrl(targetUrl));

      if (!targetTab) {
        skippedCount++;
        continue;
      }

      await chrome.scripting.executeScript({
        target: { tabId: targetTab.id },
        func: (tkn) => localStorage.setItem('iddToken', tkn),
        args: [token],
      });
      successCount++;
    } catch (err) {
      errors.push({ url: targetUrl, error: err.message });
    }
  }

  return { successCount, skippedCount, total: targets.length, errors };
}

async function setTokenInUrl(url, token) {
  const tab = await findOrOpenTab(normalizeUrl(url));
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (tkn) => localStorage.setItem('iddToken', tkn),
    args: [token],
  });
}

/* findTabOnly – trả null nếu không tìm thấy, không mở tab mới */
async function findTabOnly(url) {
  const origin = getOrigin(url);
  const tabs   = await chrome.tabs.query({});
  return tabs.find(t => {
    try { return new URL(t.url).origin === origin; } catch { return false; }
  }) ?? null;
}

/* ── helpers ── */

function normalizeUrl(url) {
  if (!url.startsWith('http://') && !url.startsWith('https://')) return 'https://' + url;
  return url;
}

function getOrigin(url) {
  try { return new URL(url).origin; } catch { return url; }
}

async function findOrOpenTab(url) {
  const origin = getOrigin(url);
  const tabs   = await chrome.tabs.query({});
  const found  = tabs.find(t => {
    try { return new URL(t.url).origin === origin; } catch { return false; }
  });
  if (found) return found;

  const newTab = await chrome.tabs.create({ url, active: false });
  await waitForLoad(newTab.id);
  return newTab;
}

/* waitForLoad – chờ tab load xong (dùng khi mở tab mới) */
function waitForLoad(tabId) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(fn);
      reject(new Error('Tab load timeout (15s)'));
    }, 15_000);
    function fn(id, info) {
      if (id === tabId && info.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(fn);
        setTimeout(resolve, 600);
      }
    }
    chrome.tabs.onUpdated.addListener(fn);
  });
}

/* reloadAndWait – reload tab đang mở rồi chờ tải xong */
function reloadAndWait(tabId) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(fn);
      reject(new Error('Reload timeout (20s)'));
    }, 20_000);

    let seenLoading = false;
    function fn(id, info) {
      if (id !== tabId) return;
      if (info.status === 'loading') seenLoading = true;
      if (info.status === 'complete' && seenLoading) {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(fn);
        setTimeout(resolve, 800); // chờ app init localStorage
      }
    }
    chrome.tabs.onUpdated.addListener(fn);
    chrome.tabs.reload(tabId);
  });
}
