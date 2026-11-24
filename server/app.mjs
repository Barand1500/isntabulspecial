import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, createHash, scrypt as rawScrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdirSync, chmodSync, existsSync } from 'node:fs';
import path from 'node:path';
import { OAuth2Client } from 'google-auth-library';
import {createDeviceStore,installDeviceRoutes} from './devices.mjs';

const scrypt = promisify(rawScrypt);
const hash = value => createHash('sha256').update(value).digest('hex');
const token = () => randomBytes(32).toString('base64url');
const HOUR = 3600000;
const readCookies = req => Object.fromEntries((req.headers.cookie || '').split(';').map(c => { const i=c.indexOf('='); return i<0?[]:[c.slice(0,i).trim(),c.slice(i+1)]; }).filter(p=>p.length===2));
export async function createApp(options={}) {
  const production = options.production ?? process.env.NODE_ENV==='production';
  const origin = options.origin || process.env.APP_ORIGIN || 'http://localhost:5173';
  const secure = new URL(origin).protocol==='https:';
  if(production&&!secure) throw Error('Üretimde APP_ORIGIN HTTPS adresi olmalıdır.');
  const email=(options.email || process.env.ADMIN_EMAIL || 'admin@guzelteknoloji.com').trim().toLowerCase();
  const file=options.dbPath || process.env.DATABASE_PATH || path.resolve('data/admin.sqlite');
  if(file!==':memory:')mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
  const db=new DatabaseSync(file);
  if(file!==':memory:')chmodSync(file,0o600);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS admins (email TEXT PRIMARY KEY,salt TEXT NOT NULL,password_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY,token_hash TEXT UNIQUE NOT NULL,created INTEGER NOT NULL,last_seen INTEGER NOT NULL,expires INTEGER NOT NULL,revoked INTEGER NOT NULL DEFAULT 0,ip TEXT NOT NULL,ua TEXT NOT NULL,method TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS qr_challenges (id TEXT PRIMARY KEY,token_hash TEXT UNIQUE NOT NULL,poll_hash TEXT NOT NULL,expires INTEGER NOT NULL,approved_by INTEGER,consumed INTEGER NOT NULL DEFAULT 0,ip TEXT NOT NULL,ua TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS login_failures (key TEXT PRIMARY KEY,count INTEGER NOT NULL,until INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS google_nonces (hash TEXT PRIMARY KEY,expires INTEGER NOT NULL);`);
  if(!db.prepare('SELECT email FROM admins WHERE email=?').get(email)){
    const password=options.password || process.env.ADMIN_PASSWORD || (!production?'123456':'');
    if(!password || (production&&password.length<12))throw Error('İlk üretim kurulumu için en az 12 karakter ADMIN_PASSWORD ayarlayın.');
    const salt=token();const derived=await scrypt(password,salt,64);
    db.prepare('INSERT INTO admins VALUES (?,?,?)').run(email,salt,derived.toString('hex'));
  }
  const dummySalt=token();const dummyHash=await scrypt(token(),dummySalt,64);
  const cookieName=secure?'__Host-spesial_admin':'spesial_admin';
  const pollName=secure?'__Host-spesial_qr':'spesial_qr';
  const googleName=secure?'__Host-spesial_google':'spesial_google';
  const googleClientId=options.googleClientId || process.env.GOOGLE_CLIENT_ID || '';
  const app=express();app.disable('x-powered-by');
  if(options.trustProxy ?? process.env.TRUST_PROXY==='1')app.set('trust proxy',1);
  app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'",'https://accounts.google.com'],styleSrc:["'self'","'unsafe-inline'",'https://fonts.googleapis.com','https://accounts.google.com'],imgSrc:["'self'",'data:','blob:','https://*.googleusercontent.com'],fontSrc:["'self'",'https://fonts.gstatic.com'],connectSrc:["'self'",'https://accounts.google.com'],frameSrc:['https://accounts.google.com'],objectSrc:["'none'"],upgradeInsecureRequests:secure?[]:null}},crossOriginOpenerPolicy:{policy:'same-origin-allow-popups'},strictTransportSecurity:secure?{maxAge:31536000}:false,referrerPolicy:{policy:'no-referrer'}}));
  app.use('/api',express.json({limit:'8kb'}));
  app.use('/api',(req,res,next)=>{res.set('Cache-Control','no-store');if(['POST','PUT','PATCH','DELETE'].includes(req.method)){
    if(req.headers.origin!==origin || !req.is('application/json'))return res.status(403).json({error:'Bu istek doğrulanamadı. Sayfayı yenileyip tekrar deneyin.'});
  }next();});
  const limiter=rateLimit({windowMs:15*60000,limit:200,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Çok fazla istek gönderdiniz. Lütfen biraz bekleyin.'}});
  app.use('/api/auth',limiter);app.use('/api/device',limiter);
  const setCookie=(res,name,value,maxAge)=>res.cookie(name,value,{httpOnly:true,secure,sameSite:'strict',path:'/',maxAge});
  const clearCookie=(res,name)=>res.clearCookie(name,{httpOnly:true,secure,sameSite:'strict',path:'/'});
  const deviceStore=createDeviceStore(db,{secure,setCookie,clearCookie,readCookies});
  const sessionFor=req=>{
    const raw=readCookies(req)[cookieName];if(!raw)return null;
    const now=Date.now();const session=db.prepare('SELECT * FROM sessions WHERE token_hash=? AND revoked=0 AND expires>? AND last_seen>?').get(hash(raw),now,now-30*60000);
    if(session){const device=db.prepare('SELECT id FROM devices WHERE id=? AND deleted=0').get(session.device_id);if(!device)return null;db.prepare('UPDATE sessions SET last_seen=? WHERE id=?').run(now,session.id);db.prepare('UPDATE devices SET last_seen=?,ip=? WHERE id=?').run(now,req.ip||'',session.device_id);}
    return session;
  };
  const authenticated=(req,res,next)=>{req.adminSession=sessionFor(req);if(!req.adminSession)return res.status(401).json({error:'Oturumunuz sona erdi. Lütfen yeniden giriş yapın.'});next();};
  const makeSession=(req,res,method)=>{
    const device=deviceStore.identify(req,res);const raw=token();const now=Date.now();
    db.prepare('UPDATE sessions SET revoked=1 WHERE device_id=?').run(device.id);
    const result=db.prepare('INSERT INTO sessions(token_hash,created,last_seen,expires,ip,ua,method,device_id) VALUES (?,?,?,?,?,?,?,?)').run(hash(raw),now,now,now+8*HOUR,req.ip||'',(req.headers['user-agent']||'').slice(0,500),method,device.id);
    setCookie(res,cookieName,raw,8*HOUR);return Number(result.lastInsertRowid);
  };
  const failKey=req=>hash(`${req.ip}|${String(req.body?.email || '').toLowerCase().slice(0,200)}`);
  app.get('/api/health',(_,res)=>res.json({ok:true,app:'istanbul-spesial',release:process.env.RELEASE_ID||'development'}));
  app.get('/api/auth/config',(_,res)=>res.json({googleClientId:googleClientId || null}));
  app.get('/api/auth/session',authenticated,(req,res)=>res.json({user:{email,name:'Yönetici'},sessionId:req.adminSession.id,deviceId:req.adminSession.device_id}));
  app.post('/api/auth/login',async(req,res,next)=>{try{
    const key=failKey(req);const now=Date.now();const failed=db.prepare('SELECT * FROM login_failures WHERE key=?').get(key);
    if(failed&&failed.until>now&&failed.count>=5){res.set('Retry-After',String(Math.ceil((failed.until-now)/1000)));return res.status(429).json({error:'Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin.'});}
    const supplied=typeof req.body?.password==='string'?req.body.password:'';
    const candidate=typeof req.body?.email==='string'?req.body.email.trim().toLowerCase():'';
    if(supplied.length>256||candidate.length>200)return res.status(400).json({error:'Giriş bilgilerinizi kontrol edin.'});
    const admin=candidate===email?db.prepare('SELECT * FROM admins WHERE email=?').get(candidate):null;
    const derived=await scrypt(supplied,admin?.salt || dummySalt,64);
    const valid=timingSafeEqual(derived,admin?Buffer.from(admin.password_hash,'hex'):dummyHash);
    if(!admin||!valid){db.prepare('INSERT INTO login_failures VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET count=excluded.count,until=excluded.until').run(key,failed&&failed.until>now?failed.count+1:1,failed&&failed.until>now?failed.until:now+15*60000);return res.status(401).json({error:'E-posta veya şifre hatalı.'});}
    db.prepare('DELETE FROM login_failures WHERE key=?').run(key);makeSession(req,res,'password');res.json({ok:true});
  }catch(e){next(e);}});
  app.post('/api/auth/logout',authenticated,(req,res)=>{db.prepare('UPDATE sessions SET revoked=1 WHERE id=?').run(req.adminSession.id);clearCookie(res,cookieName);res.json({ok:true});});
  app.post('/api/auth/google/nonce',(req,res)=>{if(!googleClientId)return res.status(503).json({error:'Google girişi henüz yapılandırılmadı. E-posta ve şifrenizle giriş yapabilirsiniz.'});db.prepare('DELETE FROM google_nonces WHERE expires<?').run(Date.now());const value=token();db.prepare('INSERT INTO google_nonces VALUES (?,?)').run(hash(value),Date.now()+5*60000);setCookie(res,googleName,value,5*60000);res.json({nonce:value});});
  app.post('/api/auth/google',async(req,res,next)=>{try{
    const clientId=googleClientId;if(!clientId)return res.status(503).json({error:'Google girişi henüz yapılandırılmadı.'});
    const nonce=readCookies(req)[googleName];const stored=nonce&&db.prepare('DELETE FROM google_nonces WHERE hash=? AND expires>? RETURNING hash').get(hash(nonce),Date.now());clearCookie(res,googleName);
    if(!stored||typeof req.body?.credential!=='string')return res.status(401).json({error:'Google oturumunu yeniden başlatın.'});
    let payload;try{const ticket=await new OAuth2Client(clientId).verifyIdToken({idToken:req.body.credential,audience:clientId});payload=ticket.getPayload();}catch{return res.status(401).json({error:'Google kimliği doğrulanamadı.'});}
    if(!payload?.email_verified||payload.email?.toLowerCase()!==email||payload.nonce!==nonce)return res.status(403).json({error:'Bu Google hesabının yönetim erişimi bulunmuyor.'});
    makeSession(req,res,'google');res.json({ok:true});
  }catch(e){next(e);}});
  app.post('/api/auth/qr',(req,res)=>{
    const previous=readCookies(req)[pollName];if(previous)db.prepare('DELETE FROM qr_challenges WHERE poll_hash=? AND consumed=0').run(hash(previous));
    db.prepare('DELETE FROM qr_challenges WHERE expires<?').run(Date.now());
    const id=token();const secret=token();const poll=token();const expires=Date.now()+120000;
    db.prepare('INSERT INTO qr_challenges(id,token_hash,poll_hash,expires,ip,ua) VALUES (?,?,?,?,?,?)').run(id,hash(secret),hash(poll),expires,req.ip || '',(req.headers['user-agent'] || '').slice(0,500));
    setCookie(res,pollName,poll,120000);res.json({id,url:`${origin}/admin/qr?token=${secret}`,expires});
  });
  app.get('/api/auth/qr/:id',(req,res)=>{
    const poll=readCookies(req)[pollName];const challenge=poll&&db.prepare('SELECT * FROM qr_challenges WHERE id=? AND poll_hash=?').get(req.params.id,hash(poll));
    if(!challenge||challenge.expires<Date.now()||challenge.consumed)return res.status(410).json({error:'Karekodun süresi doldu. Yeni bir kod oluşturun.',status:'expired'});
    if(!challenge.approved_device)return res.json({status:'pending'});
    const approver=db.prepare('SELECT id FROM devices WHERE id=? AND deleted=0 AND trusted_until>?').get(challenge.approved_device,Date.now());
    if(!approver)return res.status(410).json({error:'Onaylayan cihazın yetkisi kaldırılmış. Yeni karekod oluşturun.'});
    db.exec('BEGIN IMMEDIATE');try{
      const changed=db.prepare('UPDATE qr_challenges SET consumed=1 WHERE id=? AND consumed=0').run(challenge.id);
      if(!changed.changes)throw Error('QR already consumed');
      makeSession(req,res,'qr');db.exec('COMMIT');
    }catch(e){db.exec('ROLLBACK');throw e;}
    clearCookie(res,pollName);res.json({status:'approved'});
  });
  app.get('/api/admin/devices',authenticated,(req,res)=>res.json({devices:deviceStore.list(req.adminSession.device_id)}));
  app.post('/api/admin/devices/revoke-others',authenticated,(req,res)=>{db.prepare('UPDATE sessions SET revoked=1 WHERE device_id<>?').run(req.adminSession.device_id);res.json({ok:true});});
  app.post('/api/admin/devices/:id/revoke',authenticated,(req,res)=>{const id=Number(req.params.id);if(!Number.isSafeInteger(id))return res.status(400).json({error:'Geçersiz cihaz.'});db.prepare('UPDATE sessions SET revoked=1 WHERE device_id=?').run(id);if(id===req.adminSession.device_id)clearCookie(res,cookieName);res.json({ok:true});});
  installDeviceRoutes(app,{db,store:deviceStore,authenticated,origin,readCookies});
  app.use('/admin',(req,res,next)=>{res.set('X-Robots-Tag','noindex, nofollow');res.set('Cache-Control','no-store');next();});
  app.use('/api',(_,res)=>res.status(404).json({error:'İşlem bulunamadı.'}));
  const dist=path.resolve('dist');if(options.serveStatic!==false&&existsSync(path.join(dist,'index.html'))){app.use(express.static(dist,{index:false}));app.get('/{*path}',(req,res)=>res.sendFile(path.join(dist,'index.html')));}
  app.use((error,req,res,next)=>{if(res.headersSent)return next(error);if(error.type==='entity.parse.failed')return res.status(400).json({error:'Geçersiz istek.'});console.error('Request failed:',error.name);res.status(500).json({error:'İşlem tamamlanamadı. Lütfen tekrar deneyin.'});});
  return {app,db};
}
