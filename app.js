const KEY="cat-care-v2";
const DEFAULT=["餵食","喝水","餵藥","清理貓砂","梳毛","眼睛清潔","其他"];
let db=JSON.parse(localStorage.getItem(KEY)||"null")||{cats:[],options:DEFAULT,lastDay:dayKey()};
let filter="all",editCat=null,editCare=null,photoData=null;

const $=s=>document.querySelector(s);
const uid=()=>crypto.randomUUID();
function dayKey(d=new Date()){let x=new Date(d);if(x.getHours()<6)x.setDate(x.getDate()-1);return x.toISOString().slice(0,10)}
function save(){localStorage.setItem(KEY,JSON.stringify(db))}
function dailyReset(){let k=dayKey();if(db.lastDay!==k){db.cats.forEach(c=>c.cares.forEach(x=>x.done=false));db.lastDay=k;save()}}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function nowHHMM(){return new Date().toTimeString().slice(0,5)}
function render(){
 dailyReset();
 $("#dateText").textContent=new Date().toLocaleDateString("zh-TW",{year:"numeric",month:"long",day:"numeric",weekday:"long"})+" · 06:00 重置";
 let all=db.cats.flatMap(c=>c.cares), done=all.filter(x=>x.done).length,pending=all.length-done;
 $("#doneCount").textContent=done;$("#totalCount").textContent=all.length;$("#pendingCount").textContent=pending;
 $("#percent").textContent=all.length?Math.round(done/all.length*100)+"%":"0%";$("#progress").style.width=all.length?done/all.length*100+"%":"0%";
 $("#cats").innerHTML=db.cats.length?db.cats.map(renderCat).join(""):`<div class="empty">還沒有貓咪 🐾<br><small>按下方「新增貓咪」開始設定</small></div>`;
 bind();
}
function renderCat(c){
 let cares=[...c.cares].sort((a,b)=>a.time.localeCompare(b.time));
 if(filter==="pending")cares=cares.filter(x=>!x.done);
 return `<article class="cat">
 <div class="cat-head"><div class="avatar">${c.photo?`<img class="avatar" src="${c.photo}">`:"🐱"}</div><div class="cat-info"><div class="cat-name">${esc(c.name)}</div>${c.memo?`<div class="cat-memo">${esc(c.memo)}</div>`:""}</div>
 <button data-cat-edit="${c.id}">編輯</button><button data-cat-del="${c.id}">刪除</button></div>
 ${cares.length?cares.map(x=>{let late=!x.done&&x.time<nowHHMM();return `<div class="care ${x.done?"done":""} ${late?"late":""}">
 <div class="time">${esc(x.time)}</div><div class="info"><strong>${esc(x.type)} ${x.important?'<span class="important">★</span>':""}</strong>${x.memo?`<small>${esc(x.memo)}</small>`:""}</div>
 <button class="check ${x.done?"done":""}" data-toggle="${c.id}:${x.id}">${x.done?"✓":"○"}</button></div>`}).join(""):`<div class="empty">沒有符合條件的照護事項</div>`}
 <div class="care-tools">${filter==="all"?`<button data-add="${c.id}">＋ 新增照護</button>`:""}${c.cares.length?`<button data-history="${c.id}">📋 今日項目 ${c.cares.length}</button>`:""}</div>
 </article>`
}
function bind(){
 document.querySelectorAll("[data-toggle]").forEach(b=>b.onclick=()=>{let [cid,xid]=b.dataset.toggle.split(":");let x=db.cats.find(c=>c.id===cid)?.cares.find(x=>x.id===xid);if(x){x.done=!x.done;save();render()}});
 document.querySelectorAll("[data-add]").forEach(b=>b.onclick=()=>openCare(b.dataset.add));
 document.querySelectorAll("[data-cat-edit]").forEach(b=>b.onclick=()=>openCat(b.dataset.catEdit));
 document.querySelectorAll("[data-cat-del]").forEach(b=>b.onclick=()=>{if(confirm("確定刪除這隻貓咪？")){db.cats=db.cats.filter(c=>c.id!==b.dataset.catDel);save();render()}});
 document.querySelectorAll("[data-history]").forEach(b=>b.onclick=()=>alert("目前版本以今日照護為主；若要完整歷史紀錄，可在下一版加入日期查詢與統計。"));
}
function openCat(id=null){
 editCat=id;photoData=null;let c=id?db.cats.find(x=>x.id===id):null;
 $("#catTitle").textContent=id?"編輯貓咪":"新增貓咪";$("#catName").value=c?.name||"";$("#catMemo").value=c?.memo||"";
 $("#catPhoto").value="";$("#photoPreview").hidden=!c?.photo;if(c?.photo)$("#photoPreview").src=c.photo;$("#catModal").showModal();
}
function openCare(cid,xid=null){
 editCare=xid;editCat=cid;let c=db.cats.find(x=>x.id===cid),x=c?.cares.find(y=>y.id===xid);
 $("#careTitle").textContent=xid?"編輯照護":"新增照護";$("#careType").innerHTML=db.options.map(o=>`<option>${esc(o)}</option>`).join("");$("#careType").value=x?.type||db.options[0];$("#careTime").value=x?.time||"08:00";$("#careMemo").value=x?.memo||"";$("#careImportant").checked=!!x?.important;$("#careModal").showModal();
}
$("#catPhoto").onchange=e=>{let f=e.target.files[0];if(!f)return;let r=new FileReader();r.onload=()=>{photoData=r.result;$("#photoPreview").src=photoData;$("#photoPreview").hidden=false};r.readAsDataURL(f)};
$("#catForm").onsubmit=e=>{e.preventDefault();let name=$("#catName").value.trim();if(!name)return;let photo=photoData||(editCat?db.cats.find(c=>c.id===editCat)?.photo:"");if(editCat){let c=db.cats.find(x=>x.id===editCat);Object.assign(c,{name,memo:$("#catMemo").value.trim(),photo})}else db.cats.push({id:uid(),name,memo:$("#catMemo").value.trim(),photo,cares:[]});save();$("#catModal").close();render()};
$("#careForm").onsubmit=e=>{e.preventDefault();let c=db.cats.find(x=>x.id===editCat);if(!c)return;let data={type:$("#careType").value,time:$("#careTime").value,memo:$("#careMemo").value.trim(),important:$("#careImportant").checked,done:false};if(editCare){let x=c.cares.find(y=>y.id===editCare);Object.assign(x,data)}else c.cares.push({id:uid(),...data});save();$("#careModal").close();render()};
$("#addCat").onclick=()=>openCat();
$("#pendingBtn").onclick=()=>{filter="pending";$("#pendingBtn").classList.add("active");$("#allBtn").classList.remove("active");render()};
$("#allBtn").onclick=()=>{filter="all";$("#allBtn").classList.add("active");$("#pendingBtn").classList.remove("active");render()};
$("#settingsBtn").onclick=()=>{renderSettings();$("#settingsModal").showModal()};
document.querySelectorAll(".close").forEach(b=>b.onclick=()=>b.closest("dialog").close());

function renderSettings(){
 $("#options").innerHTML=db.options.map((x,i)=>`<span class="chip">${esc(x)} <button data-opt="${i}">✕</button></span>`).join("");
 document.querySelectorAll("[data-opt]").forEach(b=>b.onclick=()=>{if(db.options.length===1)return;db.options.splice(+b.dataset.opt,1);save();renderSettings()});
 $("#notifyStatus").textContent="Notification" in window?(Notification.permission==="granted"?"已允許瀏覽器通知。":"尚未授權瀏覽器通知。"):"此瀏覽器不支援通知。";
}
$("#addOption").onclick=()=>{let v=$("#newOption").value.trim();if(v&&!db.options.includes(v)){db.options.push(v);$("#newOption").value="";save();renderSettings()}};
$("#notify").onclick=async()=>{if(!("Notification"in window))return alert("瀏覽器不支援通知。");let p=await Notification.requestPermission();renderSettings();if(p==="granted")new Notification("🐱 Cat Care",{body:"提醒通知已啟用"});}
$("#export").onclick=()=>{let blob=new Blob([JSON.stringify(db,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="cat-care-backup.json";a.click();URL.revokeObjectURL(a.href)};
$("#import").onchange=e=>{let f=e.target.files[0];if(!f)return;let r=new FileReader();r.onload=()=>{try{let x=JSON.parse(r.result);if(!x.cats||!x.options)throw 0;db=x;save();renderSettings();render();alert("備份匯入成功")}catch{alert("這不是有效的 Cat Care 備份檔")}};r.readAsText(f)};
$("#clear").onclick=()=>{if(confirm("確定清除全部貓咪與照護資料？此操作無法復原。")){localStorage.removeItem(KEY);location.reload()}};

// ==========================================
// 1. 照護選項管理（保留動態選項，AM 06:00 僅重置打勾）
// ==========================================

// 讀取/儲存自訂選項與狀態
function loadCareOptions() {
  const options = JSON.parse(localStorage.getItem('care_options')) || [
    { id: '1', text: '餵食早餐', checked: false },
    { id: '2', text: '清理砂盆', checked: false }
  ];
  return options;
}

function saveCareOptions(options) {
  localStorage.setItem('care_options', JSON.stringify(options));
}

// 檢查並執行 AM 06:00 狀態重置
function checkDailyReset() {
  const lastReset = localStorage.getItem('last_care_reset_date');
  const now = new Date();
  
  // 計算今天的 AM 06:00 時間點
  const todaySixAM = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 6, 0, 0);
  
  // 如果目前時間已過今天 AM 06:00，且最後重置時間小於今天 AM 06:00，則執行打勾取消
  if (now >= todaySixAM) {
    const lastResetDate = lastReset ? new Date(lastReset) : null;
    if (!lastResetDate || lastResetDate < todaySixAM) {
      const options = loadCareOptions();
      const resetOptions = options.map(opt => ({ ...opt, checked: false }));
      
      saveCareOptions(resetOptions);
      localStorage.setItem('last_care_reset_date', now.toISOString());
      renderCareList(); // 重新渲染畫面
    }
  }
}

// 新增動態選項（永久保留）
function addCareOption(text) {
  const options = loadCareOptions();
  options.push({
    id: Date.now().toString(),
    text: text,
    checked: false
  });
  saveCareOptions(options);
  renderCareList();
}


// ==========================================
// 2. 貓咪喝水量紀錄（不受 AM 06:00 重置影響）
// ==========================================

function calculateWaterIntake() {
  const initial = parseFloat(document.getElementById('initialWater').value) || 0;
  const final = parseFloat(document.getElementById('finalWater').value) || 0;
  const total = Math.max(0, initial - final);
  
  document.getElementById('totalWater').value = total + ' g';
  return { initial, final, total };
}

function saveWaterRecord(catName) {
  const { initial, final, total } = calculateWaterIntake();
  const waterRecords = JSON.parse(localStorage.getItem('cat_water_records')) || [];
  
  const newRecord = {
    id: Date.now(),
    catName: catName || '未指定貓咪',
    initialWater: initial,
    finalWater: final,
    totalWater: total,
    timestamp: new Date().toLocaleString()
  };
  
  waterRecords.push(newRecord);
  // 獨立寫入 localStorage，不受 06:00 重置影響
  localStorage.setItem('cat_water_records', JSON.stringify(waterRecords));
  alert('喝水量紀錄已儲存！');
}

// 事件監聽與初始化
document.getElementById('initialWater')?.addEventListener('input', calculateWaterIntake);
document.getElementById('finalWater')?.addEventListener('input', calculateWaterIntake);

// 頁面載入時檢查是否需要重置照護清單打勾
document.addEventListener('DOMContentLoaded', () => {
  checkDailyReset();
  // 每分鐘定時檢查一次是否跨過 AM 06:00
  setInterval(checkDailyReset, 60000);
});

function reminders(){
 dailyReset();
 if(!("Notification"in window)||Notification.permission!=="granted")return;
 let t=nowHHMM(), key=dayKey()+"-"+t;if(localStorage.getItem("reminderKey")===key)return;
 let due=[];db.cats.forEach(c=>c.cares.forEach(x=>{if(x.time===t&&!x.done)due.push(`${c.name}：${x.type}`)}));
 if(due.length){new Notification("🐱 照護提醒",{body:due.join("\n")});localStorage.setItem("reminderKey",key)}
}
setInterval(()=>{render();reminders()},30000);
render();
if("serviceWorker"in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});
