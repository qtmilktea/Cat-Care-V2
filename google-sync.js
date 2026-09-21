/* Cat Care V3.5.4 - PWA Google session + cross-device sync */
(() => {
  const GOOGLE_CLIENT_ID = "375632068667-q2gb4a11trirhlrgkgmd5rpdd7dc1t6s.apps.googleusercontent.com";
  const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
  const FILE_NAME = "cat-care-cloud-data.json";
  const FILE_ID_KEY = "cat-care-google-drive-file-id";
  const ACCOUNT_CONNECTED_KEY = "cat-care-google-account-connected";
  const ACCOUNT_HINT_KEY = "cat-care-google-account-hint";

  let tokenClient = null;
  let accessToken = null;
  let tokenExpiresAt = 0;
  let silentAttempted = false;

  const $ = id => document.getElementById(id);

  function status(msg) {
    const el = $("googleSyncStatus");
    if (el) el.textContent = msg;
    console.log("[Cat Care Google Sync]", msg);
  }

  function markConnected() {
    localStorage.setItem(ACCOUNT_CONNECTED_KEY, "1");
    const signIn = $("googleSignInBtn");
    const sync = $("googleSyncBtn");
    if (signIn) signIn.textContent = "Google 已連線";
    if (sync) sync.disabled = false;
  }

  function localData() {
    for (const key of ["cat-care-v2", "catCareData", "cat-care-data"]) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) return JSON.parse(raw);
      } catch {}
    }
    return {};
  }

  function saveLocal(data) {
    try {
      localStorage.setItem("cat-care-v2", JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  async function api(url, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set("Authorization", "Bearer " + accessToken);
    options.headers = headers;
    const res = await fetch(url, options);

    if (!res.ok) {
      let detail = "";
      try {
        const j = await res.json();
        detail = j?.error?.message || j?.error?.status || "";
      } catch {}
      throw new Error(`HTTP ${res.status}${detail ? "：" + detail : ""}`);
    }
    return res;
  }

  async function findCloudFile() {
    const q = encodeURIComponent(`name='${FILE_NAME}' and trashed=false`);
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&pageSize=10&fields=files(id,name,mimeType,modifiedTime)`;
    const res = await api(url);
    const data = await res.json();
    return data.files?.[0] || null;
  }

  async function createCloudFile(data) {
    const boundary = "catcare_" + Date.now();
    const metadata = { name: FILE_NAME, mimeType: "application/json" };
    const body = [
      `--${boundary}\\r\\nContent-Type: application/json; charset=UTF-8\\r\\n\\r\\n`,
      JSON.stringify(metadata),
      `\\r\\n--${boundary}\\r\\nContent-Type: application/json\\r\\n\\r\\n`,
      JSON.stringify(data),
      `\\r\\n--${boundary}--`
    ].join("");

    const res = await api("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime", {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body
    });

    const file = await res.json();
    localStorage.setItem(FILE_ID_KEY, file.id);
    return file;
  }

  async function updateCloudFile(fileId, data) {
    return api(`https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=media`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
  }

  async function downloadCloudFile(fileId) {
    const res = await api(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`);
    return res.json();
  }

  async function ensureToken() {
    if (accessToken && Date.now() < tokenExpiresAt - 30000) return true;

    if (!window.google?.accounts?.oauth2) {
      status("Google 元件尚未載入，請重新整理");
      return false;
    }

    createTokenClient();
    if (!tokenClient) return false;

    return new Promise(resolve => {
      const previous = tokenClient.callback;
      tokenClient.callback = response => {
        tokenClient.callback = previous;
        if (response.error) {
          resolve(false);
          return;
        }
        accessToken = response.access_token;
        tokenExpiresAt = Date.now() + ((response.expires_in || 3600) * 1000);
        markConnected();
        resolve(true);
      };
      try {
        // Empty prompt asks Google to reuse existing authorization silently.
        tokenClient.requestAccessToken({ prompt: "" });
      } catch {
        resolve(false);
      }
    });
  }

  async function syncNow() {
    status("正在連線 Google Drive…");
    if (!await ensureToken()) {
      status("Google 連線已失效，請按「Google 登入」重新授權一次");
      return;
    }

    try {
      const local = localData();
      const savedId = localStorage.getItem(FILE_ID_KEY);

      // A device that already knows the cloud file can update it.
      if (savedId) {
        await updateCloudFile(savedId, local);
        status("已同步到 Google Drive");
        return;
      }

      // New device: ALWAYS download existing cloud data first.
      const file = await findCloudFile();
      if (file) {
        localStorage.setItem(FILE_ID_KEY, file.id);
        const cloud = await downloadCloudFile(file.id);
        saveLocal(cloud);
        status("已從 Google Drive 載入資料");
        setTimeout(() => location.reload(), 600);
        return;
      }

      // First-ever device: create cloud data.
      await createCloudFile(local);
      status("已建立雲端資料");
    } catch (e) {
      console.error("[Cat Care Google Sync]", e);
      status("同步失敗：" + (e.message || "未知錯誤"));
    }
  }

  function createTokenClient() {
    if (tokenClient || !window.google?.accounts?.oauth2) return;

    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: response => {
        if (response.error) {
          status("Google 尚未自動連線，請按「Google 登入」");
          return;
        }

        accessToken = response.access_token;
        tokenExpiresAt = Date.now() + ((response.expires_in || 3600) * 1000);
        markConnected();
        status("Google 已連線");
      }
    });
  }

  function manualLogin() {
    if (!window.google?.accounts?.oauth2) {
      status("Google 登入元件尚未載入，請重新整理");
      return;
    }

    createTokenClient();
    if (!tokenClient) return;

    status("正在開啟 Google 登入…");
    try {
      tokenClient.requestAccessToken({ prompt: "consent" });
    } catch (e) {
      status("Google 登入啟動失敗：" + (e.message || "未知錯誤"));
    }
  }

  function init() {
    const signIn = $("googleSignInBtn");
    const sync = $("googleSyncBtn");
    if (!signIn || !sync) return;

    signIn.disabled = false;
    sync.disabled = true;

    signIn.onclick = manualLogin;
    sync.onclick = syncNow;

    createTokenClient();

    // On PWA launch, only try silent authorization if this device
    // previously connected. Do not pop up a login dialog every launch.
    const previouslyConnected =
      localStorage.getItem(ACCOUNT_CONNECTED_KEY) === "1";

    if (previouslyConnected) {
      status("正在自動連線 Google…");
      ensureToken().then(ok => {
        if (!ok) status("Google 尚未自動連線，按「Google 登入」即可");
      });
    } else {
      status("尚未連線 Google");
    }
  }

  function boot(attempt = 0) {
    if (document.getElementById("googleSignInBtn")) {
      init();
      return;
    }
    if (attempt < 100) setTimeout(() => boot(attempt + 1), 100);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => boot());
  } else {
    boot();
  }
})();
