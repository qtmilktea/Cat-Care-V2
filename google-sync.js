/* Cat Care V3.5 - Google Drive sync
 * The OAuth Client ID is intentionally left as a placeholder.
 * Replace GOOGLE_CLIENT_ID with the Web application Client ID from Google Cloud.
 */
(() => {
  const GOOGLE_CLIENT_ID = "375632068667-o49uunr890qdvg8qtcncj3ek8qu7e9fo.apps.googleusercontent.com";
  const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
  const FILE_NAME = "cat-care-cloud-data.json";
  let tokenClient = null;
  let accessToken = null;

  const $ = id => document.getElementById(id);
  const status = msg => { const el = $("googleSyncStatus"); if (el) el.textContent = msg; };

  function localData() {
    try {
      const raw = localStorage.getItem("cat-care-v2");
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }

  function saveLocal(data) {
    try {
      localStorage.setItem("cat-care-v2", JSON.stringify(data));
      return true;
    } catch { return false; }
  }

  async function driveFetch(url, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set("Authorization", "Bearer " + accessToken);
    options.headers = headers;
    return fetch(url, options);
  }

  async function findFile() {
    const q = encodeURIComponent(`name='${FILE_NAME}' and trashed=false`);
    const res = await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id,name,modifiedTime)&pageSize=10`);
    if (!res.ok) throw new Error("無法查詢 Google Drive");
    const data = await res.json();
    return data.files?.[0] || null;
  }

  async function uploadNew(data) {
    const boundary = "catcare_boundary";
    const metadata = { name: FILE_NAME, mimeType: "application/json" };
    const body = [
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
      JSON.stringify(metadata),
      `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n`,
      JSON.stringify(data),
      `\r\n--${boundary}--`
    ].join("");
    const res = await driveFetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
      method: "POST",
      headers: {"Content-Type": `multipart/related; boundary=${boundary}`},
      body
    });
    if (!res.ok) throw new Error("無法建立雲端資料");
    return res.json();
  }

  async function updateFile(fileId, data) {
    const res = await driveFetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: "PATCH",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("無法更新雲端資料");
    return res.json();
  }

  async function downloadFile(fileId) {
    const res = await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
    if (!res.ok) throw new Error("無法下載雲端資料");
    return res.json();
  }

  async function syncNow() {
    if (!accessToken) throw new Error("尚未登入 Google");
    status("同步中…");
    const local = localData();
    const file = await findFile();

    // Safe first-sync rule: if no cloud file exists, upload current device data.
    if (!file) {
      await uploadNew(local);
      status("已建立雲端資料");
      return;
    }

    // Conservative rule for this first version:
    // cloud data is downloaded only when local storage is empty; otherwise
    // local data is uploaded to avoid silently overwriting the user's device.
    const hasLocal = local && Object.keys(local).length > 0;
    if (!hasLocal) {
      const cloud = await downloadFile(file.id);
      saveLocal(cloud);
      status("已從雲端還原資料");
      location.reload();
    } else {
      await updateFile(file.id, local);
      status("已同步到 Google Drive");
    }
  }

  function init() {
    const signIn = $("googleSignInBtn");
    const sync = $("googleSyncBtn");
    if (!signIn || !sync) return;

    if (!window.google?.accounts?.oauth2) {
      signIn.disabled = true;
      status("Google 登入元件尚未載入，請重新整理");
      return;
    }

    if (GOOGLE_CLIENT_ID.includes("PASTE_YOUR")) {
      status("請先在 google-sync.js 填入 Google Client ID");
      return;
    }

    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: (resp) => {
        if (resp.error) { status("Google 登入失敗"); return; }
        accessToken = resp.access_token;
        sync.disabled = false;
        signIn.textContent = "Google 已連線";
        status("Google 已連線");
      }
    });

    signIn.addEventListener("click", () => tokenClient.requestAccessToken({prompt:"consent"}));
    sync.addEventListener("click", async () => {
      sync.disabled = true;
      try { await syncNow(); }
      catch (e) { console.error(e); status(e.message || "同步失敗"); }
      finally { sync.disabled = false; }
    });
  }

  window.addEventListener("load", init);
})();
