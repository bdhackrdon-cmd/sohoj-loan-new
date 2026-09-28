const $=s=>document.querySelector(s);
const esc=v=>String(v??"").replace(/[&<>\"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));

$("#amount").addEventListener("change",e=>{
  $("#fee").textContent=e.target.value
    ?Number(e.target.value*.10).toLocaleString("bn-BD")+" টাকা (১০%)"
    :"পরিমাণ নির্বাচন করুন";
});

$("#applyForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const o=Object.fromEntries(new FormData(e.target));

  const r=await fetch("/api/applications",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(o)
  });

  const d=await r.json();

  if(!r.ok)return alert(d.error||"সমস্যা হয়েছে");

  alert("আবেদন জমা হয়েছে। আপনার Application ID: "+d.publicId);

  $("#statusId").value=d.publicId;
  e.target.reset();
  $("#fee").textContent="পরিমাণ নির্বাচন করুন";
  location.hash="status";
});

async function checkStatus(){
  const id=$("#statusId").value.trim();
  if(!id)return;

  const r=await fetch("/api/applications/"+encodeURIComponent(id)+"/status");
  const d=await r.json();

  $("#statusResult").innerHTML=r.ok
    ?`<div class="card">
      <b>${esc(d.public_id)}</b>
      <p>পরিমাণ: ${Number(d.amount).toLocaleString("bn-BD")} টাকা</p>
      <p>ফি: ${Number(d.fee).toLocaleString("bn-BD")} টাকা</p>
      <span class="status ${d.status}">${esc(d.status)}</span>
    </div>`
    :`<div class="card">${esc(d.error)}</div>`;
}

$("#loginForm").addEventListener("submit",async e=>{
  e.preventDefault();

  const r=await fetch("/api/admin/login",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(Object.fromEntries(new FormData(e.target)))
  });

  const d=await r.json();

  if(!r.ok)return alert(d.error);

  $("#loginBox").classList.add("hidden");
  $("#adminBox").classList.remove("hidden");

  loadApps();
});

async function loadApps(status=""){
  const r=await fetch(
    "/api/admin/applications"+
    (status?"?status="+status:"")
  );

  if(r.status===401)return;

  const a=await r.json();

  $("#rows").innerHTML=a.map(x=>`
    <tr>
      <td>${esc(x.public_id)}</td>
      <td>${esc(x.name)}<br><small>${esc(x.phone)}</small></td>
      <td>${Number(x.amount).toLocaleString("bn-BD")} টাকা</td>
      <td>
        <span class="status ${x.status}">
          ${esc(x.status)}
        </span>
      </td>
      <td>
        <button class="btn secondary" onclick="openApp(${x.id})">
          দেখুন
        </button>
      </td>
    </tr>
  `).join("")||"<tr><td colspan=5>কোনো আবেদন নেই</td></tr>";
}

async function openApp(id){
  const r=await fetch("/api/admin/applications/"+id);

  if(!r.ok)return;

  const x=await r.json();

  $("#detail").innerHTML=`
    <h2>${esc(x.name)}</h2>

    <p>
      <b>ID:</b> ${esc(x.public_id)}<br>
      <b>Phone:</b> ${esc(x.phone)}<br>
      <b>Email:</b> ${esc(x.email||"-")}<br>
      <b>NID:</b> ${esc(x.nid)}<br>
      <b>Address:</b> ${esc(x.address)}
    </p>

    <p>
      <b>Loan:</b> ${Number(x.amount).toLocaleString("bn-BD")} টাকা<br>
      <b>বিকাশ Transaction ID:</b> ${esc(x.payment_txn||"-")}<br>
      <b>Fee:</b> ${Number(x.fee).toLocaleString("bn-BD")} টাকা<br>
      <b>Purpose:</b> ${esc(x.purpose)}<br>
      <b>Income:</b> ${esc(x.income||"-")}<br>
      <b>Work:</b> ${esc(x.work||"-")}
    </p>

    <hr>

    <h3>Verification</h3>

    <div class="verify">
      ${check("nid","NID যাচাই",x.nid_verified)}
      ${check("phone","মোবাইল যাচাই",x.phone_verified)}
      ${check("address","ঠিকানা যাচাই",x.address_verified)}
      ${check("income","আয় যাচাই",x.income_verified)}
    </div>

    <textarea id="adminNote"
      class="note"
      placeholder="Admin note">${esc(x.admin_note||"")}</textarea>

    <button class="btn" onclick="updateApp(${x.id},'approved')">
      Approve
    </button>

    <button class="btn secondary" onclick="updateApp(${x.id},'rejected')">
      Reject
    </button>

    <h3>Audit log</h3>

    <div>
      ${x.logs.map(l=>`
        <p class="small">
          ${esc(l.created_at)} — 
          ${esc(l.action)} — 
          ${esc(l.actor)}
        </p>
      `).join("")}
    </div>
  `;

  $("#drawer").classList.remove("hidden");
}

function check(k,t,v){
  return `
    <label>
      <input type="checkbox" data-v="${k}" ${v?"checked":""}>
      ${t}
    </label>
  `;
}

async function updateApp(id,status){
  const verification={};

  document.querySelectorAll("[data-v]").forEach(x=>{
    verification[x.dataset.v]=x.checked;
  });

  const r=await fetch("/api/admin/applications/"+id,{
    method:"PATCH",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      status,
      verification,
      admin_note:$("#adminNote").value
    })
  });

  const d=await r.json();

  if(!r.ok)return alert(d.error);

  closeDrawer();
  loadApps();
}

async function logout(){
  await fetch("/api/admin/logout",{method:"POST"});

  $("#adminBox").classList.add("hidden");
  $("#loginBox").classList.remove("hidden");
}

function closeDrawer(){
  $("#drawer").classList.add("hidden");
}

fetch("/api/admin/me").then(r=>{
  if(r.ok){
    $("#loginBox").classList.add("hidden");
    $("#adminBox").classList.remove("hidden");
    loadApps();
  }
});
