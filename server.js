require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || "dev-only-change-me";
const DB_FILE = process.env.DB_FILE || "./data/loan.sqlite";
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

const db = new Database(DB_FILE);
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  nid TEXT NOT NULL,
  address TEXT NOT NULL,
  amount INTEGER NOT NULL,
  purpose TEXT NOT NULL,
  income INTEGER,
  work TEXT,
  payment_txn TEXT,
  fee INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  nid_verified INTEGER NOT NULL DEFAULT 0,
  phone_verified INTEGER NOT NULL DEFAULT 0,
  address_verified INTEGER NOT NULL DEFAULT 0,
  income_verified INTEGER NOT NULL DEFAULT 0,
  admin_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL
);
`);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "200kb" }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300 }));
app.use(express.static(path.join(__dirname, "public")));

function now(){ return new Date().toISOString(); }
function publicId(){ return "LN-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2,7).toUpperCase(); }
function clean(s){ return String(s ?? "").trim(); }
function validAmount(n){ return [5000,7500,10000,12500,15000,17500,20000].includes(Number(n)); }
function adminOnly(req,res,next){
  const token=req.cookies.admin_token;
  try {
    const p=jwt.verify(token, JWT_SECRET);
    if(p.role!=="admin") throw new Error();
    req.admin=p; next();
  } catch { res.status(401).json({error:"Unauthorized"}); }
}
function log(applicationId, action, actor, details=""){
  db.prepare("INSERT INTO audit_logs(application_id,action,actor,details,created_at) VALUES(?,?,?,?,?)")
    .run(applicationId,action,actor,details,now());
}

app.post("/api/applications", (req,res)=>{
  const b=req.body;
  const name=clean(b.name), phone=clean(b.phone), email=clean(b.email), nid=clean(b.nid), address=clean(b.address);
  const amount=Number(b.amount), purpose=clean(b.purpose), income=b.income===""?null:Number(b.income), work=clean(b.work), payment_txn=clean(b.payment_txn);
  if(!name || !phone || !nid || !address || !purpose || !validAmount(amount))
    return res.status(400).json({error:"প্রয়োজনীয় তথ্য সঠিকভাবে পূরণ করুন।"});
  if(nid.length < 6 || phone.length < 7) return res.status(400).json({error:"NID/মোবাইল নম্বর যাচাই করুন।"});
  const fee=Math.round(amount*0.10);
  const pid=publicId(), t=now();
  const info=db.prepare(`
    INSERT INTO applications(public_id,name,phone,email,nid,address,amount,purpose,income,work,payment_txn,fee,status,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(pid,name,phone,email,nid,address,amount,purpose,Number.isFinite(income)?income:null,work,payment_txn,fee,"pending",t,t);
  log(info.lastInsertRowid,"APPLICATION_SUBMITTED","public",`public_id=${pid}`);
  res.status(201).json({publicId:pid, fee, message:"আবেদন সফলভাবে জমা হয়েছে।"});
});

app.get("/api/applications/:publicId/status",(req,res)=>{
  const x=db.prepare("SELECT public_id,status,amount,fee,created_at,updated_at FROM applications WHERE public_id=?").get(req.params.publicId);
  if(!x) return res.status(404).json({error:"আবেদন পাওয়া যায়নি।"});
  res.json(x);
});

app.post("/api/admin/login",(req,res)=>{
  const email=clean(req.body.email), password=String(req.body.password||"");
  if(email!==process.env.ADMIN_EMAIL || password!==process.env.ADMIN_PASSWORD)
    return res.status(401).json({error:"Login তথ্য সঠিক নয়।"});
  const token=jwt.sign({role:"admin",email},JWT_SECRET,{expiresIn:"8h"});
  res.cookie("admin_token",token,{httpOnly:true,sameSite:"lax",secure:process.env.COOKIE_SECURE==="true",maxAge:8*60*60*1000});
  res.json({ok:true});
});
app.post("/api/admin/logout",adminOnly,(req,res)=>{res.clearCookie("admin_token");res.json({ok:true});});
app.get("/api/admin/me",adminOnly,(req,res)=>res.json({email:req.admin.email}));

app.get("/api/admin/applications",adminOnly,(req,res)=>{
  const status=clean(req.query.status);
  let rows=status ? db.prepare("SELECT * FROM applications WHERE status=? ORDER BY id DESC").all(status)
                   : db.prepare("SELECT * FROM applications ORDER BY id DESC").all();
  // Never return more than necessary in an actual API; this admin endpoint is protected.
  res.json(rows);
});

app.get("/api/admin/applications/:id",adminOnly,(req,res)=>{
  const x=db.prepare("SELECT * FROM applications WHERE id=?").get(Number(req.params.id));
  if(!x) return res.status(404).json({error:"Not found"});
  const logs=db.prepare("SELECT action,actor,details,created_at FROM audit_logs WHERE application_id=? ORDER BY id DESC").all(x.id);
  res.json({...x,logs});
});

app.patch("/api/admin/applications/:id",adminOnly,(req,res)=>{
  const id=Number(req.params.id);
  const x=db.prepare("SELECT * FROM applications WHERE id=?").get(id);
  if(!x) return res.status(404).json({error:"Not found"});
  const allowed=["pending","approved","rejected"];
  const status=clean(req.body.status);
  const note=clean(req.body.admin_note);
  const v=req.body.verification || {};
  const fields={
    nid_verified: v.nid ? 1 : 0,
    phone_verified: v.phone ? 1 : 0,
    address_verified: v.address ? 1 : 0,
    income_verified: v.income ? 1 : 0
  };
  if(!allowed.includes(status)) return res.status(400).json({error:"Invalid status"});
  if(status==="approved" && Object.values(fields).some(x=>x!==1))
    return res.status(400).json({error:"Approve করার আগে প্রয়োজনীয় verification সম্পন্ন করুন।"});
  db.prepare(`UPDATE applications SET status=?,admin_note=?,nid_verified=?,phone_verified=?,address_verified=?,income_verified=?,updated_at=? WHERE id=?`)
    .run(status,note,fields.nid_verified,fields.phone_verified,fields.address_verified,fields.income_verified,now(),id);
  log(id,"APPLICATION_UPDATED",req.admin.email,`status=${status}; note=${note}`);
  res.json({ok:true});
});

app.get("/api/admin/applications/:id/audit",adminOnly,(req,res)=>{
  res.json(db.prepare("SELECT * FROM audit_logs WHERE application_id=? ORDER BY id DESC").all(Number(req.params.id)));
});

app.get("/{*splat}", (req,res)=>{
  if(req.path.startsWith("/api/")) return res.status(404).json({error:"Not found"});
  res.sendFile(path.join(__dirname,"public","index.html"));
});

app.listen(PORT,()=>console.log(`Sohoj Loan running on http://localhost:${PORT}`));
