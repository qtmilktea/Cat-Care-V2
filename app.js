const KEY="cat-care-v2";
const DEFAULT=["餵食","換水","清理貓砂","餵藥","梳毛","陪伴／活動","其他"];
let S=JSON.parse(localStorage.getItem(KEY)||"null")||{cats:[],options:DEFAULT,water:[],reminder:true,lastReset:""};
let selectedPhoto="";
let waterFilter="all";
let waterCatFilter="all";
const $=x=>document.querySelector(x), $$=x=>document.querySelectorAll(x);
const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Taipei"}).format(new Date());
const timeNow=()=>new Intl.DateTimeFormat("zh-TW",{timeZone:"Asia/Taipei",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date());
const uid=()=>crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random();
function save(){localStorage.setItem(KEY,JSON.stringify(S));render()}
function reset(){if(S.lastReset!==today()&&timeNow()>="06:00"){S.cats.forEach(c=>c.tasks.forEach(t=>t.done=false));S.lastReset=today();localStorage.setItem(KEY,JSON.stringify(S))}}
function esc(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function avatar(photo){return photo?`<img src="${photo}" alt="">`:"🐱"}
function resizePhoto(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>{const img=new Image();img.onload=()=>{const max=480,scale=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement("canvas");c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);c.getContext("2d").drawImage(img,0,0,c.width,c.height);resolve(c.toDataURL("image/jpeg",.78))};img.onerror=reject;img.src=r.result};r.onerror=reject;r.readAsDataURL(file)})}
function render(){
 reset();
 $("#dateText").textContent=`${today()} · 每日 06:00 更新`;
 let all=S.cats.flatMap(c=>c.tasks),done=all.filter(t=>t.done).length,p=all.length?Math.round(done/all.length*100):0;
 $("#pct").textContent=p+"%";$("#ring").style.background=`conic-gradient(var(--accent) ${p*3.6}deg,#eee7e1 ${p*3.6}deg)`;
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
 $("#waterCatFilter").value=waterCatFilter;
 $$(".filter").forEach(b=>b.classList.toggle("active",b.dataset.filter===waterFilter));
 $("#waterRecords").innerHTML=filtered.length?filtered.map(r=>{const c=S.cats.find(x=>x.id===r.catId);return `<article class="card water-card"><div class="water-card-head"><div class="water-record-meta"><div class="water-cat-avatar">${c&&c.photo?`<img src="${c.photo}" alt="">`:"🐱"}</div><div><div class="water-record-cat">${esc(r.catName)}</div><div class="water-record-time">${esc(r.date)} · ${esc(r.time)}</div></div></div><div class="water-amount-box"><div class="water-amount">${Number(r.total).toFixed(1)} g</div></div></div><div class="water-record-values"><div class="water-value"><small>初始</small><b>${Number(r.start).toFixed(1)} g</b></div><div class="water-value"><small>最終</small><b>${Number(r.end).toFixed(1)} g</b></div><div class="water-value"><small>喝水</small><b>${Number(r.total).toFixed(1)} g</b></div></div><div class="water-actions"><button type="button" class="mini edit-water editWater" data-id="${r.id}">✎ 修改紀錄</button><button type="button" class="mini delete-water delWater" data-id="${r.id}">🗑 刪除</button></div></article>`}).join(""):`<div class="empty water-empty-filter">${count?"這個篩選條件沒有喝水紀錄":"尚無喝水紀錄，按右上角「＋ 記錄」開始吧 💧"}</div>`;
 $("#reminder").checked=S.reminder;
 $("#options").innerHTML=S.options.map((o,i)=>`<div class="option"><span>${esc(o)}</span><button class="mini delOpt" data-i="${i}">刪除</button></div>`).join("");
}
function showPage(name){$$('.page').forEach(x=>x.classList.remove('active'));$("#page-"+name).classList.add('active');$$('.nav').forEach(x=>x.classList.toggle('active',x.dataset.page===name))}
$$('.nav').forEach(b=>b.onclick=()=>showPage(b.dataset.page));
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
function calc(){let a=+$("#waterStart").value||0,b=+$("#waterEnd").value||0;$("#waterTotal").textContent=Math.max(0,a-b).toFixed(1)+" g"}
$("#waterStart").oninput=calc;$("#waterEnd").oninput=calc;
$$('.filter').forEach(b=>b.onclick=()=>{waterFilter=b.dataset.filter;render()});
$("#waterCatFilter").onchange=e=>{waterCatFilter=e.target.value;render()};
$("#waterForm").onsubmit=e=>{e.preventDefault();let a=+$("#waterStart").value,b=+$("#waterEnd").value;if(b>a){alert("最終水量不能大於初始水量。");return}let c=S.cats.find(c=>c.id===$("#waterCat").value);if(!c)return;let editId=$("#waterForm").dataset.editId;if(editId){let r=S.water.find(r=>r.id===editId);if(r){r.catId=c.id;r.catName=c.name;r.date=$("#waterDate").value;r.time=$("#waterTime").value;r.start=a;r.end=b;r.total=a-b}}else{S.water.push({id:uid(),catId:c.id,catName:c.name,date:$("#waterDate").value,time:$("#waterTime").value,start:a,end:b,total:a-b})}save();$("#waterDlg").close()};
$("#waterRecords").addEventListener("click",e=>{let id=e.target.dataset.id;if(e.target.classList.contains("editWater")){let r=S.water.find(r=>r.id===id);if(r)openWaterDialog(r)}if(e.target.classList.contains("delWater")){let r=S.water.find(r=>r.id===id);if(r&&confirm(`確定刪除 ${r.date} ${r.time} 的喝水紀錄？`)){S.water=S.water.filter(x=>x.id!==id);save()}}});
$("#reminder").onchange=e=>{S.reminder=e.target.checked;save()};
$("#addOption").onclick=()=>{let v=$("#newOption").value.trim();if(v&&!S.options.includes(v)){S.options.push(v);$("#newOption").value="";save()}};
$("#options").onclick=e=>{if(e.target.classList.contains("delOpt")){S.options.splice(+e.target.dataset.i,1);save()}};
$$('.closeDlg').forEach(b=>b.onclick=()=>b.closest('dialog').close());
$("#notifyBtn").onclick=async()=>{if(!("Notification"in window)){alert("瀏覽器不支援通知");return}let p=await Notification.requestPermission();alert(p==="granted"?"通知權限已開啟。":"通知權限未開啟。")};
$("#exportData").onclick=()=>{let blob=new Blob([JSON.stringify(S,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="cat-care-backup-"+today()+".json";a.click();URL.revokeObjectURL(a.href)};
$("#importData").onchange=e=>{let f=e.target.files[0];if(!f)return;let r=new FileReader();r.onload=()=>{try{let x=JSON.parse(r.result);if(!x.cats||!x.water||!x.options)throw 0;S=x;save();alert("備份匯入成功。") }catch{alert("這不是有效的貓咪照護備份檔。")}};r.readAsText(f)};
function reminder(){if(S.reminder&&timeNow()>="09:00"&&localStorage.getItem("cat-care-reminder")!==today()){localStorage.setItem("cat-care-reminder",today());if("Notification"in window&&Notification.permission==="granted")new Notification("貓咪照護提醒",{body:"09:00 了，記得更新今天的照護紀錄 🐱"})}}
setInterval(()=>{reset();reminder();render()},30000);

// V2.4：避免 PWA 長時間使用舊快取，並在有新版時提示更新。
function showUpdate(reg){
  const banner=$("#updateBanner");
  if(!banner)return;
  banner.hidden=false;
  $("#updateBtn").onclick=()=>{
    if(reg.waiting)reg.waiting.postMessage({type:"SKIP_WAITING"});
    else reg.update();
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
render();reminder();
