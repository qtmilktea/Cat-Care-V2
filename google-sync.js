/* Cat Care V3.5.1 - Google Drive login fix */
(() => {
  // 請將這裡換成你在 Google Cloud 建立的 Web application Client ID
  const GOOGLE_CLIENT_ID = "375632068667-q2gb4a11trirhlrgkgmd5rpdd7dc1t6s.apps.googleusercontent.com";
  const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
  const FILE_NAME = "cat-care-cloud-data.json";

  let tokenClient = null;
  let accessToken = null;
  let initialized = false;

  const $ = id => document.getElementById(id);
  const status = msg => {
    const el = $("googleSyncStatus");
    if (el) el.textContent = msg;
    console.log("[Cat Care Google Sync]", msg);
  };

  function localData() {
    try {
      // Try the app's current localStorage keys first.
      const keys = ["cat-care-v2", "catCareData", "cat-care-data"];
      for (const key of keys) {
        const raw = localStorage.getItem(key);
        if (raw) return JSON.parse(raw);
      }
      return {};
    } catch (e) {
      console.error(e);
      return {};
    }
  }

  function saveLocal(data) {
    try {
      localStorage.setItem("cat-care-v2", JSON.stringify(data));
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  function initGoogle() {
    if (initialized) return true;

    const signIn = $("googleSignInBtn");
    const sync = $("googleSyncBtn");

    if (!signIn || !sync) {
      console.warn("[Cat Care Google Sync] 找不到同步按鈕");
      return false;
    }

    // Always make the button visibly respond, even if GIS has not loaded yet.
    signIn.disabled = false;
    signIn.onclick = () => {
      if (!window.google?.accounts?.oauth2) {
        status("Google 登入元件尚未載入，請重新整理頁面後再試");
        return;
      }
      if (GOOGLE_CLIENT_ID.includes("PASTE_YOUR")) {
        status("尚未填入 Google Client ID");
        return;
      }
      status("正在開啟 Google 登入…");
      try {
        tokenClient.requestAccessToken({ prompt: "consent" });
      } catch (e) {
        console.error(e);
        status("Google 登入啟動失敗：" + (e.message || "未知錯誤"));
      }
    };

    sync.disabled = true;
    sync.onclick = async () => {
      if (!accessToken) {
        status("請先登入 Google");
        return;
      }
      try {
        sync.disabled = true;
        status("同步中…");
        const local = localData();
        const q = encodeURIComponent(`name='${FILE_NAME}' and trashed=false`);
        const res = await fetch(
          `https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id,name,modifiedTime)&pageSize=10`,
          { headers: { Authorization: "Bearer " + accessToken } }
        );
        if (!res.ok) throw new Error("無法查詢 Google Drive");
        const found = (await res.json()).files || [];

        if (!found.length) {
          const boundary = "catcare_boundary";
          const metadata = { name: FILE_NAME, mimeType: "application/json" };
          const body = [
            `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
            JSON.stringify(metadata),
            `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n`,
            JSON.stringify(local),
            `\r\n--${boundary}--`
          ].join("");
          const up = await fetch(
            "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
            {
              method: "POST",
              headers: {
                Authorization: "Bearer " + accessToken,
                "Content-Type": `multipart/related; boundary=${boundary}`
              },
              body
            }
          );
          if (!up.ok) throw new Error("無法建立雲端資料");
          status("已建立雲端資料");
        } else {
          const fileId = found[0].id;
          const up = await fetch(
            `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
            {
              method: "PATCH",
              headers: {
                Authorization: "Bearer " + accessToken,
                "Content-Type": "application/json"
              },
              body: JSON.stringify(local)
            }
          );
          if (!up.ok) throw new Error("無法更新雲端資料");
          status("已同步到 Google Drive");
        }
      } catch (e) {
        console.error(e);
        status("同步失敗：" + (e.message || "未知錯誤"));
      } finally {
        sync.disabled = false;
      }
    };

    // If the GIS script has already loaded, initialize OAuth now.
    if (window.google?.accounts?.oauth2) {
      createTokenClient();
    } else {
      status("正在載入 Google 登入元件…");
    }

    initialized = true;
    return true;
  }

  function createTokenClient() {
    if (tokenClient) return;
    if (!window.google?.accounts?.oauth2) return;

    if (GOOGLE_CLIENT_ID.includes("PASTE_YOUR")) {
      status("請先在 google-sync.js 填入 Google Client ID");
      return;
    }

    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (response.error) {
          console.error(response);
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

  // The GIS script is async, so window load is NOT sufficient.
  // Poll briefly until it is available.
  function boot(attempt = 0) {
    const ready = initGoogle();
    if (!ready || !window.google?.accounts?.oauth2) {
      if (attempt < 100) {
        setTimeout(() => {
          if (window.google?.accounts?.oauth2) createTokenClient();
          boot(attempt + 1);
        }, 100);
      } else {
        status("Google 登入元件載入失敗，請重新整理");
      }
    } else {
      createTokenClient();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => boot());
  } else {
    boot();
  }
})();
