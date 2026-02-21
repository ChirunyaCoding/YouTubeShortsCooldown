const WATCH_LIMIT_MS = 5 * 60 * 1000;
const BLOCK_DURATION_MS = 30 * 60 * 1000;
const PERSIST_INTERVAL_MS = 5 * 1000;

const STORAGE_KEYS = {
  watchMs: "shortsWatchMs",
  blockUntil: "shortsBlockUntil"
};

let cacheLoaded = false;
let lastPersistAt = 0;
let operationQueue = Promise.resolve();

const state = {
  watchMs: 0,
  blockUntil: 0
};

function isShortsUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    return parsed.hostname === "www.youtube.com" && parsed.pathname.startsWith("/shorts/");
  } catch {
    return false;
  }
}

function clampDeltaMs(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return 0;
  }
  return Math.min(n, 10 * 1000);
}

async function ensureStateLoaded() {
  if (cacheLoaded) {
    return;
  }

  const loaded = await chrome.storage.local.get([
    STORAGE_KEYS.watchMs,
    STORAGE_KEYS.blockUntil
  ]);

  state.watchMs = Number(loaded[STORAGE_KEYS.watchMs] || 0);
  state.blockUntil = Number(loaded[STORAGE_KEYS.blockUntil] || 0);
  cacheLoaded = true;
}

async function persistState(force = false) {
  const now = Date.now();
  if (!force && now - lastPersistAt < PERSIST_INTERVAL_MS) {
    return;
  }

  lastPersistAt = now;
  await chrome.storage.local.set({
    [STORAGE_KEYS.watchMs]: state.watchMs,
    [STORAGE_KEYS.blockUntil]: state.blockUntil
  });
}

function clearExpiredBlock(now = Date.now()) {
  if (state.blockUntil > 0 && now >= state.blockUntil) {
    state.blockUntil = 0;
    return true;
  }
  return false;
}

function buildStatus(now = Date.now()) {
  const remainingMs = Math.max(0, state.blockUntil - now);
  return {
    blocked: remainingMs > 0,
    remainingMs,
    blockUntil: state.blockUntil,
    watchMs: state.watchMs,
    watchLimitMs: WATCH_LIMIT_MS
  };
}

async function handleWatchTick(rawDeltaMs) {
  const now = Date.now();
  const expired = clearExpiredBlock(now);

  if (state.blockUntil > now) {
    if (expired) {
      await persistState(true);
    }
    return buildStatus(now);
  }

  state.watchMs += clampDeltaMs(rawDeltaMs);

  if (state.watchMs >= WATCH_LIMIT_MS) {
    state.watchMs = 0;
    state.blockUntil = now + BLOCK_DURATION_MS;
    await persistState(true);
    return buildStatus(now);
  }

  await persistState(expired);
  return buildStatus(now);
}

async function getCurrentStatus() {
  const expired = clearExpiredBlock(Date.now());
  if (expired) {
    await persistState(true);
  }
  return buildStatus(Date.now());
}

async function bootstrap() {
  await ensureStateLoaded();
  await getCurrentStatus();
}

chrome.runtime.onInstalled.addListener(() => {
  operationQueue = operationQueue.then(bootstrap).catch((error) => {
    console.error("Bootstrap failed on install.", error);
  });
});

chrome.runtime.onStartup.addListener(() => {
  operationQueue = operationQueue.then(bootstrap).catch((error) => {
    console.error("Bootstrap failed on startup.", error);
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  operationQueue = operationQueue
    .then(async () => {
      await ensureStateLoaded();

      if (!message || typeof message.type !== "string") {
        sendResponse({ ok: false, error: "Invalid message." });
        return;
      }

      if (message.type === "shorts_watch_tick") {
        const status = await handleWatchTick(message.deltaMs);
        sendResponse({ ok: true, ...status });
        return;
      }

      if (message.type === "check_block_status") {
        const status = await getCurrentStatus();
        sendResponse({ ok: true, ...status });
        return;
      }

      sendResponse({ ok: false, error: "Unknown message type." });
    })
    .catch((error) => {
      console.error("Message handling failed.", error);
      sendResponse({ ok: false, error: String(error) });
    });

  return true;
});

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId !== 0) {
    return;
  }

  if (!isShortsUrl(details.url) || details.tabId < 0) {
    return;
  }

  operationQueue = operationQueue
    .then(async () => {
      await ensureStateLoaded();
      const status = await getCurrentStatus();

      if (!status.blocked) {
        return;
      }

      const redirect = new URL("https://www.youtube.com/");
      redirect.searchParams.set("shorts_blocked", "1");
      redirect.searchParams.set("remaining", String(Math.ceil(status.remainingMs / 1000)));

      try {
        await chrome.tabs.update(details.tabId, { url: redirect.toString() });
      } catch (error) {
        console.error("Failed to redirect blocked Shorts navigation.", error);
      }
    })
    .catch((error) => {
      console.error("Navigation handling failed.", error);
    });
});
