// ⚠️ 請確保這行引號是半形的雙引號 ""，且網址完整
const GAS_URL = "https://script.google.com/macros/s/AKfycbyYKYHVuMFKVzybi40dCLzxVdqiUAA_sGV3d9-Pq57Uqz5MgwupUGD7VM8taC3-zm9m/exec";

const KEY="cat-care-v2";
const DATA_VERSION=3;
const DB_NAME="cat-care-safe-backup";
const DB_VERSION=1;
const DEFAULT=["餵食","換水","清理貓砂","餵藥","梳毛","陪伴／活動","其他"];
const EMPTY=()=>({version:DATA_VERSION,cats:[],options:[...DEFAULT],water:[],reminder:true,lastReset:""});
let S=EMPTY();
let dbReady=false;
let saveTimer=null;
let selectedPhoto="";
let waterFilter="all";
let waterCatFilter="all";
const $=x=>document.querySelector(x),$$=x=>document.querySelectorAll(x);
const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Taipei"}).format(new Date());
const timeNow=()=>new Intl.DateTimeFormat("zh-TW",{timeZone:"Asia/Taipei",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date());
const uid=()=>crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random();

function normalize(x){
  const base=EMPTY();
  if(!x || typeof x!=="object") return base;
  const out={...base,...x,version:DATA_VERSION};
  out.cats=Array.isArray(x.cats)?x.cats:[];
  out.options=Array.isArray(x.options)&&x.options.length?x.options:base.options;
  out.water=Array.isArray(x.water)?x.water:[];
  out.reminder=x.reminder!==false;
  out.lastReset=typeof x.lastReset==="string"?x.lastReset:"";
  return out;
}

// --- 🌐 Google 雲端同步函式 ---
async function syncToCloud() {
  if (!GAS_URL || GAS_URL.includes("你的部署ID")) return;
  try {
    await fetch(GAS_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(S)
    });
    console.log("☁️ 已自動同步至 Google 雲端");
  } catch (err) {
    console.error("☁️ 雲端同步失敗:", err);
  }
}

async function syncFromCloud(showNotification = false) {
  if (!GAS_URL || GAS_URL.includes("你的部署ID")) return;
  try {
    const res = await fetch(GAS_URL);
    const data = await res.json();
    if (data && typeof data === "object") {
      S = normalize(data);
      localStorage.setItem(KEY, JSON.stringify(S));
      render();
      console.log("☁️ 已成功從 Google 雲端下載最新資料");
      if (showNotification) alert("已成功從 Google 雲端載入最新資料！");
    }
  } catch (err) {
    console.error("☁️ 雲端下載失敗:", err);
    if (showNotification) alert("雲端同步失敗，請檢查網路連線或 GAS URL。");
  }
}

function openDB(){return new Promise((resolve,reject)=>{if(!("indexedDB"in window)){resolve(null);return}const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains("snapshots")){const st=db.createObjectStore("snapshots",{keyPath:"id",autoIncrement:true});st.createIndex("created","created")}};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}

async function putSnapshot(label="自動備份"){
  if(!dbReady)return;
  try{const db=await dbReady;const tx=db.transaction("snapshots","readwrite");tx.objectStore("snapshots").add({created:Date.now(),label,data:JSON.stringify(S)});await new Promise((res,rej)=>{tx.oncomplete=res;tx.onerror=()=>rej(tx.error)});
    const tx2=db.transaction("snapshots","readwrite"),st=tx2.objectStore("snapshots"),idx=st.index("created");const all=await new Promise((res,rej)=>{const a=idx.getAll();a.onsuccess=()=>res(a.result);a.onerror=()=>rej(a.error)});
    if(all.length>5){all.sort((a,b)=>a.created-b.created);for(const item of all.slice(0,all.length-5))st.delete(item.id)}
    localStorage.setItem(KEY,JSON.stringify(S));
    localStorage.setItem(KEY+"-backup-time",String(Date.now()));
  }catch(e){try{localStorage.setItem(KEY,JSON.stringify(S))}catch{}}
}

function save(){
  localStorage.setItem(KEY,JSON.stringify(S));
  render();
  clearTimeout(saveTimer);
  saveTimer=setTimeout(()=>{
    putSnapshot("自動備份");
    syncToCloud();
  },100);
}

function reset(){if(S.lastReset!==today()&&timeNow()>="06:00"){S.cats.forEach(c=>c.tasks.forEach(t=>t.done=false));S.lastReset=today();localStorage.setItem(KEY,JSON.stringify(S));putSnapshot("06:00 重置前後備份")}}
function esc(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function avatar(photo){return photo?`<img src="${photo}" alt="">`:"🐱"}
function resizePhoto(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>{const img=new Image();img.onload=()=>{const max=480,scale=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement("canvas");c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);c.getContext("2d").drawImage(img,0,0,c.width,c.height);resolve(c.toDataURL("image/jpeg",.78))};img.onerror=reject;img.src=r.result};r.onerror=reject;r.readAsDataURL(file)})}

function render(){
 reset();
 $("#dateText").textContent=`${today()} · 每日 06:00 更新`;
 let all=S.cats.flatMap(c=>c.tasks),done=all.filter(t=>t.done).length,p=all.length?Math.round(done/all.length*100):0;
 $("#pct").textContent=p+"\%";$("#ring").style.background=`conic-gradient(var(--accent) ${p*3.6}deg,#eee7e1 ${p*3.6}deg)`;
 $("#progressTitle").textContent=all.length?`完成 ${done} / ${all.length} 項`:"還沒有照護事項";
 $("#progressText").textContent=p===100&&all.length?"今天全部完成了！":"完成狀態會自動保存。";
 $("#cats").innerHTML=S.cats.length?S.cats.map(c=>`<article class="card cat-card"><div class="cat-head"><div class="cat-ident"><div class="cat-avatar">${avatar(c.photo)}</div><div class="cat-info"><div class="cat-name">${esc(c.name)}</div>${c.note?`<div class="cat-note">${esc(c.note)}</div>`:""}</div></div><div class="cat-actions"><button class="mini addTask" data-id="${c.id}">＋事項</button><button class="mini delCat" data-id="${c.id}">刪除</button></div></div><div class="tasks">${c.tasks.map((t,i)=>`<label class="task ${t.done?"done":""}"><input class="check" data-id="${c.id}" data-i="${i}" type="checkbox" ${t.done?"checked":""}><span>${esc(t.name)}</span><button type="button" aria-label="刪除照護事項" class="mini delTask" data-id="${c.id}" data-i="${i}">×</button></label>`).join("")}</div></article>`).join(""):'<div class="empty">還沒有貓咪，先按「＋ 新增」吧 🐱</div>';
 let sum=S.water.reduce((a,r)=>a+(Number(r.total)||0),0),count=S.water.length;
 let todaySum=S.water.filter(r=>r.date===today()).reduce((a,r)=>a+(Number(r.total)||0),0);
 $("#waterSummary").innerHTML=`<div class="muted">今日喝水量</div><div class="water-total">${todaySum.toFixed(1)} g</div><div class="muted">全部 ${count} 筆 · 累計 ${sum.toFixed(1)} g</div>`;
 const now=new Date();
 const startOfRange=(days)=>{const d=new Date(now);d.setHours(0,0,0,0);d.setDate(d.getDate()-days+1);return d.toISOString().slice(0,10)};
 let filtered=S.water.slice();
 if(waterFilter==="today") filtered=filtered.filter(r=>r.date===today());
 if(waterFilter==="7") filtered=filtered.filter(r=>r.date>=startOfRange(7)&&r.date<=today());
 if(waterFilter==="30") filtered=filtered.filter(r=>r.date>=startOfRange(30)&&r.date<=today());
 if(waterCatFilter!=="all") filtered=filtered.filter(r=>r.catId===waterCatFilter);
 filtered.sort((a,b)=>(b.date+" "+b.time).localeCompare(a.date+" "+a.time));
 $("#waterCatFilter").innerHTML=`<option value="all">全部貓咪</option>`+S.cats.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("");
 $("#waterCatFilter").value=waterCatFilter;  $$(".filter").forEach(b=>b.classList.toggle("active",b.dataset.filter===waterFilter));
 $("#waterRecords").innerHTML=filtered.length?filtered.map(r=>{const c=S.cats.find(x=>x.id===r.catId);return `<article class="card water-card"><div class="water-card-head"><div class="water-record-meta"><div class="water-cat-avatar">${c&&c.photo?`<img src="${c.photo}" alt="">`:"🐱"}</div><div><div class="water-record-cat">${esc(r.catName)}</div><div class="water-record-time">${esc(r.date)} · ${esc(r.time)}</div></div></div><div class="water-amount-box"><div class="water-amount">${Number(r.total).toFixed(1)} g</div></div></div><div class="water-record-values"><div class="water-value"><small>初始</small><b>${Number(r.start).toFixed(1)} g</b></div><div class="water-value"><small>最終</small><b>${Number(r.end).toFixed(1)} g</b></div><div class="water-value"><small>喝水</small><b>${Number(r.total).toFixed(1)} g</b></div></div><div class="water-actions"><button type="button" class="mini edit-water editWater" data-id="${r.id}">✎ 修改紀錄</button><button type="button" class="mini delete-water delWater" data-id="${r.id}">🗑 刪除</button></div></article>`}).join(""):`<div class="empty water-empty-filter">${count?"這個篩選條件沒有喝水紀錄":"尚無喝水紀錄，按右上角「＋ 記錄」開始吧 💧"}</div>`;
 $("#reminder").checked=S.reminder;
 $("#options").innerHTML=S.options.map((o,i)=>`<div class="option"><span>${esc(o)}</span><button class="mini delOpt" data-i="${i}">刪除</button></div>`).join("");
}

function showPage(name){$$('.page').forEach(x=>x.classList.remove('active'));$("#page-"+name).classList.add('active');$$('.nav').forEach(x=>x.classList.toggle('active',x.dataset.page===name))}$$('.nav').forEach(b=>b.onclick=()=>showPage(b.dataset.page));
$("#manageCats").onclick=()=>{showPage("today");setTimeout(()=>$("#addCat")?.click(),50)};
$("#addCat").onclick=()=>{selectedPhoto="";$("#catName").value="";$("#catNote").value="";$("#catPhoto").value="";$("#photoPreview").innerHTML="🐱";$("#catDlg").showModal()};
$("#catPhoto").onchange=async e=>{const f=e.target.files[0];if(!f)return;try{selectedPhoto=await resizePhoto(f);$("#photoPreview").innerHTML=`<img src="${selectedPhoto}" alt="">`}catch{alert("照片讀取失敗。")}};
$("#removePhoto").onclick=()=>{selectedPhoto="";$("#catPhoto").value="";$("#photoPreview").innerHTML="🐱"};
$("#catForm").onsubmit=e=>{e.preventDefault();S.cats.push({id:uid(),name:$("#catName").value.trim(),note:$("#catNote").value.trim(),photo:selectedPhoto,tasks:S.options.map(name=>({name,done:false}))});S.lastReset=today();save();$("#catDlg").close()};
$("#cats").addEventListener("change",e=>{if(!e.target.classList.contains("check"))return;let c=S.cats.find(c=>c.id===e.target.dataset.id);if(!c)return;c.tasks[+e.target.dataset.i].done=e.target.checked;save()});
$("#cats").addEventListener("click",e=>{let id=e.target.dataset.id;if(e.target.classList.contains("delCat")){if(confirm("確定刪除這隻貓咪？")){S.cats=S.cats.filter(c=>c.id!==id);save()}}if(e.target.classList.contains("delTask")){let c=S.cats.find(c=>c.id===id);if(c){c.tasks.splice(+e.target.dataset.i,1);save()}}if(e.target.classList.contains("addTask")){let c=S.cats.find(c=>c.id===id);if(!c)return;$("#taskSelect").innerHTML=S.options.map(o=>`<option>${esc(o)}</option>`).join("");$("#customTask").value="";$("#taskDlg").dataset.cat=id;$("#taskDlg").showModal()}});
$("#taskForm").onsubmit=e=>{e.preventDefault();let c=S.cats.find(c=>c.id===$("#taskDlg").dataset.cat),v=$("#customTask").value.trim()||$("#taskSelect").value;if(v&&c){c.tasks.push({name:v,done:false});if(!S.options.includes(v))S.options.push(v);save();$("#taskDlg").close()}};

function openWaterDialog(record){
 if(!S.cats.length){alert("請先新增貓咪。");return}
 const editing=!!record;
 $("#waterDlgTitle").textContent=editing?"修改喝水紀錄":"新增喝水紀錄";
 $("#waterCat").innerHTML=S.cats.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("");
 $("#waterDate").value=editing?record.date:today();
 $("#waterTime").value=editing?record.time:new Date().toTimeString().slice(0,5);
 $("#waterStart").value=editing?record.start:"";
 $("#waterEnd").value=editing?record.end:"";
 if(editing){$("#waterCat").value=S.cats.some(c=>c.id===record.catId)?record.catId:S.cats[0].id;$("#waterForm").dataset.editId=record.id}else delete $("#waterForm").dataset.editId;
 calc();$("#waterDlg").showModal();
}
$("#addWater").onclick=()=>openWaterDialog();
function calc(){let a=+$("#waterStart").value||0,b=+$("#waterEnd").value\vert{}\vert{}0;$("#waterTotal").textContent=Math.max(0,a-b).toFixed(1)+" g"}
$("#waterStart").oninput=calc;$("#waterEnd").oninput=calc; $$('.filter').forEach(b=>b.onclick=()=>{waterFilter=b.dataset.filter;render()});$("#waterCatFilter").onchange=e=>{waterCatFilter=e.target.value;render()};
$("#waterForm").onsubmit=e=>{e.preventDefault();let a=+$("#waterStart").value,b=+$("#waterEnd").value;if(b>a){alert("最終水量不能大於初始水量。");return}let c=S.cats.find(c=>c.id===$("#waterCat").value);if(!c)return;let editId=$("#waterForm").dataset.editId;if(editId){let r=S.water.find(r=>r.id===editId);if(r){r.catId=c.id;r.catName=c.name;r.date=$("#waterDate").value;r.time=$("#waterTime").value;r.start=a;r.end=b;r.total=a-b}}else{S.water.push({id:uid(),catId:c.id,catName:c.name,date:$("#waterDate").value,time:$("#waterTime").value,start:a,end:b,total:a-b})}save();$("#waterDlg").close()};
$("#waterRecords").addEventListener("click",e=>{let id=e.target.dataset.id;if(e.target.classList.contains("editWater")){let r=S.water.find(r=>r.id===id);if(r)openWaterDialog(r)}if(e.target.classList.contains("delWater")){let r=S.water.find(r=>r.id===id);if(r&&confirm(`確定刪除 ${r.date} ${r.time} 的喝水紀錄？`)){S.water=S.water.filter(x=>x.id!==id);save()}}});
$("#reminder").onchange=e=>{S.reminder=e.target.checked;save()};
$("#addOption").onclick=()=>{let v=$("#newOption").value.trim();if(v&&!S.options.includes(v)){S.options.push(v);$("#newOption").value="";save()}};
$("#options").onclick=e=>{if(e.target.classList.contains("delOpt")){S.options.splice(+e.target.dataset.i,1);save()}}; $$('.closeDlg').forEach(b=>b.onclick=()=>b.closest('dialog').close());$("#notifyBtn").onclick=async()=>{if(!("Notification"in window)){alert("瀏覽器不支援通知");return}let p=await Notification.requestPermission();alert(p==="granted"?"通知權限已開啟。":"通知權限未開啟。")};

async function exportBackup(){
  const blob=new Blob([JSON.stringify({...S,version:DATA_VERSION,exportedAt:new Date().toISOString()},null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="cat-care-backup-"+today()+".json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  localStorage.setItem(KEY+"-manual-backup-time",String(Date.now()));
  updateBackupStatus();
}
$("#exportData").onclick=exportBackup;
$("#makeDeviceBackup").onclick=async()=>{await putSnapshot("手動裝置備份");updateBackupStatus();alert("裝置備份已建立。\n\n建議再按「匯出 JSON」，把檔案存到 iCloud Drive／檔案 App，這樣即使換裝置也能還原。")};
$("#importData").onchange=e=>{let f=e.target.files[0];if(!f)return;let r=new FileReader();r.onload=async()=>{try{let x=normalize(JSON.parse(r.result));if(!Array.isArray(x.cats)||!Array.isArray(x.water)||!Array.isArray(x.options))throw 0;if(!confirm("匯入會以備份內容取代目前資料。要先保留目前資料並繼續嗎？"))return;await putSnapshot("匯入前自動備份");S=x;save();alert("備份匯入成功。") }catch{alert("這不是有效的貓咪照護備份檔。")}};r.readAsText(f);e.target.value=""};

function updateBackupStatus(){
  const a=localStorage.getItem(KEY+"-manual-backup-time"),b=localStorage.getItem(KEY+"-backup-time");
  const t=Math.max(Number(a)||0,Number(b)||0);
  $("#backupStatus").textContent=t?`最近備份：${new Date(t).toLocaleString("zh-TW")}`:"尚未建立備份";
}

async function restoreLatestSnapshot(){
  if(!dbReady){alert("此瀏覽器不支援裝置備份。請使用「匯出 JSON」。");return}
  try{const db=await dbReady,tx=db.transaction("snapshots","readonly"),idx=tx.objectStore("snapshots").index("created"),all=await new Promise((res,rej)=>{const a=idx.getAll();a.onsuccess=()=>res(a.result);a.onerror=()=>rej(a.error)});
    if(!all.length){alert("目前沒有裝置備份。");return} all.sort((a,b)=>b.created-a.created);
    if(!confirm(`要還原最近一次裝置備份（${new Date(all[0].created).toLocaleString("zh-TW")}）嗎？\n\n目前資料會先自動備份。`))return;
    await putSnapshot("還原前自動備份");S=normalize(JSON.parse(all[0].data));localStorage.setItem(KEY,JSON.stringify(S));render();alert("已還原最近一次裝置備份。");
  }catch{alert("裝置備份還原失敗，請改用 JSON 備份。")}}
$("#restoreDeviceBackup").onclick=restoreLatestSnapshot;

function reminder(){if(S.reminder&&timeNow()>="09:00"&&localStorage.getItem("cat-care-reminder")!==today()){localStorage.setItem("cat-care-reminder",today());if("Notification"in window&&Notification.permission==="granted")new Notification("貓咪照護提醒",{body:"09:00 了，記得更新今天的照護紀錄 🐱"})}}
setInterval(()=>{reset();reminder();render()},30000);

function showUpdate(reg){
  const banner=$("#updateBanner");
  if(!banner)return;
  banner.hidden=false;
  const btn=$("#updateBtn");
  if(btn.dataset.bound==="1")return;
  btn.dataset.bound="1";
  btn.onclick=async()=>{
    if(btn.dataset.busy==="1")return;
    btn.dataset.busy="1";
    btn.disabled=true;
    btn.textContent="更新中…";
    try{
      await reg.update();
      let waiting=reg.waiting;
      if(!waiting && reg.installing){
        const installing=reg.installing;
        await new Promise((resolve,reject)=>{
          const timer=setTimeout(()=>resolve(),15000);
          installing.addEventListener("statechange",()=>{
            if(installing.state==="installed"){
              clearTimeout(timer);
              resolve();
            }else if(installing.state==="redundant"){
              clearTimeout(timer);
              reject(new Error("service worker install failed"));
            }
          });
        });
        waiting=reg.waiting;
      }
      if(waiting){
        waiting.postMessage({type:"SKIP_WAITING"});
        return;
      }
      location.reload();
    }catch{
      btn.dataset.busy="";
      btn.disabled=false;
      btn.textContent="立即更新";
      alert("更新失敗，請確認網路連線後再試一次。\n\n如果 GitHub Pages 剛更新，請稍等約 1～2 分鐘。");
    }
  };
}

if("serviceWorker"in navigator){
  navigator.serviceWorker.register("sw.js",{updateViaCache:"none"}).then(reg=>{
    if(reg.waiting)showUpdate(reg);
    reg.addEventListener("updatefound",()=>{
      const worker=reg.installing;
      if(!worker)return;
      worker.addEventListener("statechange",()=>{
        if(worker.state==="installed"&&navigator.serviceWorker.controller)showUpdate(reg);
      });
    });
    setTimeout(()=>reg.update().catch(()=>{}),1200);
  }).catch(()=>{});
  let reloaded=false;
  navigator.serviceWorker.addEventListener("controllerchange",()=>{
    if(reloaded)return;
    reloaded=true;
    location.reload();
  });
}

(async()=>{
  try{dbReady=await openDB()}catch{dbReady=null}
  let local=null;try{local=JSON.parse(localStorage.getItem(KEY)||"null")}catch{}
  if(local){S=normalize(local)}
  else if(dbReady){try{const db=await dbReady,tx=db.transaction("snapshots","readonly"),idx=tx.objectStore("snapshots").index("created"),all=await new Promise((res,rej)=>{const a=idx.getAll();a.onsuccess=()=>res(a.result);a.onerror=()=>rej(a.error)});if(all.length){all.sort((a,b)=>b.created-a.created);S=normalize(JSON.parse(all[0].data));localStorage.setItem(KEY,JSON.stringify(S));alert("已從裝置備份恢復資料。")}}catch{}}
  
  reset();render();reminder();updateBackupStatus();
  if(dbReady&&!local)await putSnapshot("首次安全備份");

  await syncFromCloud();
})();
