const WATCH_TICK_MS = 1000;
const URL_POLL_MS = 500;
const BANNER_ID = "shorts-watch-blocker-banner";

let lastUrl = location.href;
let isOnShorts = location.pathname.startsWith("/shorts/");
let bannerTimer = null;

function sendMessage(payload) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(payload, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(response || { ok: false, error: "No response." });
      });
    } catch (error) {
      resolve({ ok: false, error: String(error) });
    }
  });
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function removeBanner() {
  if (bannerTimer !== null) {
    clearInterval(bannerTimer);
    bannerTimer = null;
  }

  const existing = document.getElementById(BANNER_ID);
  if (existing) {
    existing.remove();
  }
}

function ensureBannerElement() {
  if (!document.body) {
    return null;
  }

  let banner = document.getElementById(BANNER_ID);
  if (banner) {
    return banner;
  }

  banner = document.createElement("div");
  banner.id = BANNER_ID;
  banner.style.position = "fixed";
  banner.style.top = "12px";
  banner.style.left = "50%";
  banner.style.transform = "translateX(-50%)";
  banner.style.zIndex = "2147483647";
  banner.style.padding = "10px 14px";
  banner.style.borderRadius = "10px";
  banner.style.background = "rgba(20, 20, 20, 0.92)";
  banner.style.color = "#ffffff";
  banner.style.fontSize = "14px";
  banner.style.fontFamily = "Arial, sans-serif";
  banner.style.boxShadow = "0 6px 20px rgba(0, 0, 0, 0.35)";
  banner.style.pointerEvents = "none";

  document.body.appendChild(banner);
  return banner;
}

function startBannerCountdown(initialRemainingMs) {
  removeBanner();

  let remainingMs = Math.max(0, Number(initialRemainingMs) || 0);
  const banner = ensureBannerElement();
  if (!banner) {
    return;
  }

  banner.textContent = `Shorts are blocked. Time left: ${formatDuration(remainingMs)}`;

  bannerTimer = window.setInterval(() => {
    remainingMs = Math.max(0, remainingMs - 1000);
    const current = document.getElementById(BANNER_ID);
    if (!current) {
      removeBanner();
      return;
    }

    current.textContent = `Shorts are blocked. Time left: ${formatDuration(remainingMs)}`;

    if (remainingMs <= 0) {
      removeBanner();
      clearBlockedQueryParams();
    }
  }, 1000);
}

function clearBlockedQueryParams() {
  const url = new URL(location.href);
  if (url.searchParams.get("shorts_blocked") !== "1") {
    return;
  }

  url.searchParams.delete("shorts_blocked");
  url.searchParams.delete("remaining");
  history.replaceState(history.state, "", url.toString());
}

function redirectFromShorts(remainingMs) {
  const redirect = new URL("https://www.youtube.com/");
  redirect.searchParams.set("shorts_blocked", "1");
  redirect.searchParams.set("remaining", String(Math.ceil(Math.max(0, remainingMs) / 1000)));
  location.replace(redirect.toString());
}

function isActivelyWatchingShorts() {
  return isOnShorts && document.visibilityState === "visible" && document.hasFocus();
}

async function enforceBlockIfNeeded() {
  const status = await sendMessage({ type: "check_block_status" });
  if (!status || !status.ok) {
    return;
  }

  if (status.blocked && isOnShorts) {
    redirectFromShorts(status.remainingMs);
    return;
  }

  if (!status.blocked) {
    removeBanner();
    clearBlockedQueryParams();
  }
}

async function maybeShowBlockedBanner() {
  const url = new URL(location.href);
  if (url.searchParams.get("shorts_blocked") !== "1") {
    removeBanner();
    return;
  }

  const status = await sendMessage({ type: "check_block_status" });
  if (!status || !status.ok || !status.blocked) {
    removeBanner();
    clearBlockedQueryParams();
    return;
  }

  startBannerCountdown(status.remainingMs);
}

async function sendWatchTick() {
  if (!isActivelyWatchingShorts()) {
    return;
  }

  const status = await sendMessage({
    type: "shorts_watch_tick",
    deltaMs: WATCH_TICK_MS
  });

  if (!status || !status.ok) {
    return;
  }

  if (status.blocked) {
    redirectFromShorts(status.remainingMs);
  }
}

async function handleUrlChange() {
  const nextUrl = location.href;
  if (nextUrl === lastUrl) {
    return;
  }

  lastUrl = nextUrl;
  isOnShorts = location.pathname.startsWith("/shorts/");

  if (isOnShorts) {
    await enforceBlockIfNeeded();
  } else {
    await maybeShowBlockedBanner();
  }
}

void enforceBlockIfNeeded();
void maybeShowBlockedBanner();

setInterval(() => {
  void sendWatchTick();
}, WATCH_TICK_MS);

setInterval(() => {
  void handleUrlChange();
}, URL_POLL_MS);

document.addEventListener("visibilitychange", () => {
  if (isOnShorts) {
    void enforceBlockIfNeeded();
  }
});

window.addEventListener("focus", () => {
  if (isOnShorts) {
    void enforceBlockIfNeeded();
  }
});

document.addEventListener("DOMContentLoaded", () => {
  void maybeShowBlockedBanner();
});
