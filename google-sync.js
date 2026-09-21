/* Cat Care V3.5.2 - Google Drive sync fix */
(() => {
  const GOOGLE_CLIENT_ID = "375632068667-q2gb4a11trirhlrgkgmd5rpdd7dc1t6s.apps.googleusercontent.com";
  const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
  const FILE_NAME = "cat-care-cloud-data.json";
  const FILE_ID_KEY = "cat-care-google-drive-file-id";
  let tokenClient = null, accessToken = null;

  const $ = id => document.getElementById(id);
  const status = msg => {
    const el = $("googleSyncStatus");
    if (el) el.textContent = msg;
    console.log("[Cat Care Google Sync]", msg);
  };

  function localData() {
    for (const key of ["cat-care-v2","catCareData","cat-care-data"]) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) return JSON.parse(raw);
      } catch {}
    }
    return {};
  }

  function saveLocal(data) {
    try { localStorage.setItem("cat-care-v2", JSON.stringify(data)); return true; }
    catch { return false; }
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
    const metadata = {name: FILE_NAME, mimeType: "application/json"};
    const body = [
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
      JSON.stringify(metadata),
      `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n`,
      JSON.stringify(data),
      `\r\n--${boundary}--`
    ].join("");
    const res = await api("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime", {
      method:"POST",
      headers:{"Content-Type":`multipart/related; boundary=${boundary}`},
      body
    });
    const file = await res.json();
    localStorage.setItem(FILE_ID_KEY, file.id);
    return file;
  }

  async function updateCloudFile(fileId, data) {
    const res = await api(`https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=media`, {
      method:"PATCH",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(data)
    });
    return res.json();
  }

  async function downloadCloudFile(fileId) {
    const res = await api(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`);
    return res.json();
  }

  async function syncNow() {
    if (!accessToken) { status("請先登入 Google"); return; }
    status("正在檢查 Google Drive…");
    try {
      const local = localData();
      const savedId = localStorage.getItem(FILE_ID_KEY);

      if (savedId) {
        await updateCloudFile(savedId, local);
        status("已同步到 Google Drive");
        return;
      }

      const file = await findCloudFile();

      if (!file) {
        await createCloudFile(local);
        status("已建立雲端資料");
        return;
      }

      localStorage.setItem(FILE_ID_KEY, file.id);

      if (!local || Object.keys(local).length === 0) {
        const cloud = await downloadCloudFile(file.id);
        saveLocal(cloud);
        status("已從 Google Drive 還原資料");
        setTimeout(() => location.reload(), 500);
        return;
      }

      await updateCloudFile(file.id, local);
      status("已同步到 Google Drive");
    } catch (e) {
      console.error("[Cat Care Google Sync]", e);
      status("同步失敗：" + (e.message || "未知錯誤"));
    }
  }

  function createTokenClient() {
    if (tokenClient || !window.google?.accounts?.oauth2) return;
    if (GOOGLE_CLIENT_ID.includes("PASTE_YOUR")) {
      status("尚未填入 Google Client ID");
      return;
    }
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: response => {
        if (response.error) {
          status("Google 登入失敗：" + response.error);
          return;
        }
        accessToken = response.access_token;
        $("googleSignInBtn").textContent = "Google 已連線";
        $("googleSyncBtn").disabled = false;
        status("Google 已連線，可以開始同步");
      }
    });
  }

  function init() {
    const signIn = $("googleSignInBtn"), sync = $("googleSyncBtn");
    if (!signIn || !sync) return;
    signIn.disabled = false;
    sync.disabled = true;

    signIn.onclick = () => {
      if (!window.google?.accounts?.oauth2) {
        status("Google 登入元件尚未載入，請重新整理");
        return;
      }
      createTokenClient();
      if (!tokenClient) return;
      status("正在開啟 Google 登入…");
      tokenClient.requestAccessToken({prompt:"consent"});
    };
    sync.onclick = syncNow;
    status("Google 雲端同步已準備完成");
    createTokenClient();
  }

  function boot(n=0) {
    if (document.getElementById("googleSignInBtn")) init();
    if (n < 100 && !window.google?.accounts?.oauth2) setTimeout(() => boot(n+1), 100);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => boot());
  else boot();
})();
