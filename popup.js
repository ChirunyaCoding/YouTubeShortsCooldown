const REFRESH_MS = 1000;

const stateLabel = document.getElementById("stateLabel");
const primaryTime = document.getElementById("primaryTime");
const detailText = document.getElementById("detailText");
const tabHint = document.getElementById("tabHint");
const progressBar = document.getElementById("progressBar");

let refreshTimer = null;

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function isShortsUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return parsed.hostname === "www.youtube.com" && parsed.pathname.startsWith("/shorts/");
  } catch {
    return false;
  }
}

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

function getActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      resolve(tabs && tabs.length > 0 ? tabs[0] : null);
    });
  });
}

function setProgress(percent, blocked) {
  const safe = Math.max(0, Math.min(100, percent));
  progressBar.style.width = `${safe}%`;
  progressBar.style.background = blocked
    ? "linear-gradient(90deg, #f97316, #ef4444)"
    : "linear-gradient(90deg, #35d399, #10b981)";
}

function renderStatus(status, onShortsPage) {
  if (!status || !status.ok) {
    stateLabel.textContent = "状態取得エラー";
    primaryTime.textContent = "--:--";
    detailText.textContent = "拡張機能のバックグラウンド処理に接続できません。";
    tabHint.textContent = "";
    setProgress(0, false);
    return;
  }

  if (status.blocked) {
    stateLabel.textContent = "Shortsは現在ブロック中";
    primaryTime.textContent = `解除まで ${formatDuration(status.remainingMs)}`;
    detailText.textContent = "ブロック解除後に、再び5分の視聴でクールダウンが発動します。";
    tabHint.textContent = onShortsPage
      ? "今はShortsページです（自動でホームへリダイレクトされます）"
      : "今はShortsページではありません";
    setProgress(100, true);
    return;
  }

  const watchMs = Number(status.watchMs || 0);
  const watchLimitMs = Number(status.watchLimitMs || 0);
  const remainingToCooldownMs = Math.max(0, watchLimitMs - watchMs);
  const progress = watchLimitMs > 0 ? (watchMs / watchLimitMs) * 100 : 0;

  stateLabel.textContent = onShortsPage ? "Shorts視聴中" : "待機中";
  primaryTime.textContent = `クールダウンまで ${formatDuration(remainingToCooldownMs)}`;
  detailText.textContent = `現在の視聴時間 ${formatDuration(watchMs)} / ${formatDuration(watchLimitMs)}`;
  tabHint.textContent = onShortsPage
    ? "Shortsを見続けるとカウントが進みます"
    : "Shortsページをアクティブ表示したときだけカウントされます";
  setProgress(progress, false);
}

async function refreshPopup() {
  const [status, tab] = await Promise.all([
    sendMessage({ type: "check_block_status" }),
    getActiveTab()
  ]);

  const onShortsPage = Boolean(tab && tab.url && isShortsUrl(tab.url));
  renderStatus(status, onShortsPage);
}

document.addEventListener("DOMContentLoaded", () => {
  void refreshPopup();
  refreshTimer = window.setInterval(() => {
    void refreshPopup();
  }, REFRESH_MS);
});

window.addEventListener("unload", () => {
  if (refreshTimer !== null) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
});
