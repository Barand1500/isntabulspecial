import {randomBytes,createHash} from 'node:crypto';
const secret=()=>randomBytes(32).toString('base64url');
const digest=value=>createHash('sha256').update(value).digest('hex');
const DAYS=90*86400000;
export function describeDevice(ua='',model=''){
 const browser=/Edg\//.test(ua)?'Edge':/Firefox\//.test(ua)?'Firefox':/Chrome\//.test(ua)?'Chrome':/Safari\//.test(ua)?'Safari':'Tarayıcı';
 const platform=/iPhone/.test(ua)?'iPhone':/iPad/.test(ua)?'iPad':/Android/.test(ua)?'Android':/Windows/.test(ua)?'Windows':/Macintosh/.test(ua)?'Mac':/Linux/.test(ua)?'Linux':'Cihaz';
 const androidModel=ua.match(/Android[^;)]*;\s*(?:[a-z]{2}[-_][A-Z]{2};\s*)?([^;)]+?)(?:\s+Build\/[^;)]*)?[;)]/i)?.[1];
 const hardware=String(model||(/Android/.test(ua)?androidModel:'')||platform).replace(/[\x00-\x1f]/g,'').slice(0,80);
 return {name:`${hardware} · ${browser}`,type:/Mobile|Android|iPhone|iPad/.test(ua)?'mobile':'desktop',browser,platform,hardware};
}
export function createDeviceStore(db,{secure,setCookie,readCookies}){
 const cookieName=secure?'__Host-spesial_device':'spesial_device';
 db.exec(`CREATE TABLE IF NOT EXISTS devices(id INTEGER PRIMARY KEY,key_hash TEXT UNIQUE NOT NULL,name TEXT NOT NULL,detected_name TEXT NOT NULL,type TEXT NOT NULL,created INTEGER NOT NULL,last_seen INTEGER NOT NULL,ip TEXT NOT NULL,ua TEXT NOT NULL,trusted_until INTEGER NOT NULL DEFAULT 0,deleted INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS device_enrollments(id TEXT PRIMARY KEY,token_hash TEXT UNIQUE NOT NULL,creator INTEGER NOT NULL,claimed_device INTEGER,expires INTEGER NOT NULL,confirmed INTEGER NOT NULL DEFAULT 0,cancelled INTEGER NOT NULL DEFAULT 0);`);
 if(!db.prepare('PRAGMA table_info(sessions)').all().some(c=>c.name==='device_id')){
  db.exec('ALTER TABLE sessions ADD COLUMN device_id INTEGER; UPDATE sessions SET revoked=1 WHERE device_id IS NULL;');
 }
 if(!db.prepare('PRAGMA table_info(qr_challenges)').all().some(c=>c.name==='approved_device'))db.exec('ALTER TABLE qr_challenges ADD COLUMN approved_device INTEGER;');
 const fromCookie=req=>{const key=readCookies(req)[cookieName];return key?db.prepare('SELECT * FROM devices WHERE key_hash=? AND deleted=0').get(digest(key)):null;};
 function identify(req,res){
  let device=fromCookie(req);const now=Date.now();const ua=(req.headers['user-agent']||'').slice(0,500);const ip=req.ip||'';
  if(device){db.prepare('UPDATE devices SET last_seen=?,ip=?,ua=? WHERE id=?').run(now,ip,ua,device.id);setCookie(res,cookieName,readCookies(req)[cookieName],DAYS);return device;}
  const key=secret();const detected=describeDevice(ua,typeof req.body?.deviceInfo?.model==='string'?req.body.deviceInfo.model:'');
  const result=db.prepare('INSERT INTO devices(key_hash,name,detected_name,type,created,last_seen,ip,ua) VALUES (?,?,?,?,?,?,?,?)').run(digest(key),detected.name,detected.name,detected.type,now,now,ip,ua);
  setCookie(res,cookieName,key,DAYS);return db.prepare('SELECT * FROM devices WHERE id=?').get(Number(result.lastInsertRowid));
 }
 const registered=req=>{const device=fromCookie(req);return device&&device.trusted_until>Date.now()?device:null;};
 function list(current){
  const now=Date.now();return db.prepare(`SELECT d.id,d.name,d.detected_name,d.type,d.created,d.last_seen,d.ip,d.trusted_until,s.method FROM devices d
   LEFT JOIN sessions s ON s.id=(SELECT id FROM sessions WHERE device_id=d.id ORDER BY last_seen DESC,id DESC LIMIT 1)
   WHERE d.deleted=0 AND (d.trusted_until>? OR s.id IS NOT NULL)
   ORDER BY d.id=? DESC,d.last_seen DESC`).all(now,current).map(d=>({...d,method:d.method||'enrollment',current:d.id===current,trusted:d.trusted_until>now,active:!!db.prepare('SELECT id FROM sessions WHERE device_id=? AND revoked=0 AND expires>? AND last_seen>?').get(d.id,now,now-1800000)}));
 }
 return {identify,fromCookie,registered,list,cookieName};
}
const validName=value=>typeof value==='string'&&value.trim().length>=2&&value.trim().length<=60&&!/[\x00-\x1f\x7f]/.test(value);
export function installDeviceRoutes(app,{db,store,authenticated,origin,readCookies}){
 const liveEnrollment=raw=>db.prepare(`SELECT e.* FROM device_enrollments e JOIN sessions s ON s.id=e.creator WHERE e.token_hash=? AND e.expires>? AND e.cancelled=0 AND s.revoked=0 AND s.expires>? AND s.last_seen>?`).get(digest(String(raw||'')),Date.now(),Date.now(),Date.now()-1800000);
 app.post('/api/admin/device-enrollments',authenticated,(req,res)=>{
  db.prepare('DELETE FROM device_enrollments WHERE expires<?').run(Date.now());
  db.prepare('UPDATE device_enrollments SET cancelled=1 WHERE creator=? AND confirmed=0').run(req.adminSession.id);
  const id=secret(),raw=secret(),expires=Date.now()+180000;
  db.prepare('INSERT INTO device_enrollments(id,token_hash,creator,expires) VALUES (?,?,?,?)').run(id,digest(raw),req.adminSession.id,expires);
  res.json({id,url:`${origin}/admin/enroll?token=${raw}`,expires});
 });
 app.get('/api/admin/device-enrollments/:id',authenticated,(req,res)=>{
  const entry=db.prepare('SELECT * FROM device_enrollments WHERE id=? AND creator=? AND cancelled=0').get(req.params.id,req.adminSession.id);
  if(!entry||entry.expires<Date.now())return res.status(410).json({error:'Karekodun süresi doldu. Yeni bir kod oluşturun.'});
  const device=entry.claimed_device?db.prepare('SELECT id,name,detected_name,type,ip FROM devices WHERE id=? AND deleted=0').get(entry.claimed_device):null;
  res.json({status:entry.confirmed?'approved':device?'scanned':'pending',device,expires:entry.expires});
 });
 app.post('/api/admin/device-enrollments/:id/confirm',authenticated,(req,res)=>{
  const entry=db.prepare('SELECT * FROM device_enrollments WHERE id=? AND creator=? AND expires>? AND cancelled=0 AND confirmed=0').get(req.params.id,req.adminSession.id,Date.now());
  if(!entry||!entry.claimed_device)return res.status(410).json({error:'Onaylanacak cihaz bulunamadı. Karekodu yeniden okutun.'});
  db.exec('BEGIN IMMEDIATE');try{const changed=db.prepare('UPDATE devices SET trusted_until=? WHERE id=? AND deleted=0').run(Date.now()+DAYS,entry.claimed_device);if(!changed.changes)throw Error('Device removed');db.prepare('UPDATE device_enrollments SET confirmed=1 WHERE id=?').run(entry.id);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
  res.json({ok:true});
 });
 app.post('/api/admin/device-enrollments/:id/cancel',authenticated,(req,res)=>{db.prepare('UPDATE device_enrollments SET cancelled=1 WHERE id=? AND creator=? AND confirmed=0').run(req.params.id,req.adminSession.id);res.json({ok:true});});
 app.get('/api/device/enroll',(req,res)=>{
  const entry=liveEnrollment(req.query.token);if(!entry)return res.status(410).json({error:'Bu cihaz ekleme kodu artık geçerli değil.'});
  const current=store.fromCookie(req);
  if(entry.claimed_device&&entry.claimed_device!==current?.id)return res.status(409).json({error:'Bu karekod başka bir cihaz tarafından okutuldu.'});
  res.json({status:entry.confirmed?'approved':entry.claimed_device?'waiting':'ready',suggestedName:current?.name||describeDevice(req.headers['user-agent']).name,expires:entry.expires});
 });
 app.post('/api/device/enroll',(req,res)=>{
  const entry=liveEnrollment(req.body?.token);if(!entry||entry.confirmed)return res.status(410).json({error:'Bu karekod artık geçerli değil.'});
  if(!validName(req.body?.name))return res.status(400).json({error:'Cihaz adı 2–60 karakter olmalıdır.'});
  const existing=store.fromCookie(req);if(entry.claimed_device&&entry.claimed_device!==existing?.id)return res.status(409).json({error:'Bu karekod başka bir cihaz tarafından okutuldu.'});
  const device=store.identify(req,res);
  const changed=db.prepare('UPDATE device_enrollments SET claimed_device=? WHERE id=? AND (claimed_device IS NULL OR claimed_device=?) AND confirmed=0').run(device.id,entry.id,device.id);
  if(!changed.changes)return res.status(409).json({error:'Bu karekod zaten kullanıldı.'});
  db.prepare('UPDATE devices SET name=? WHERE id=?').run(req.body.name.trim(),device.id);res.json({status:'waiting'});
 });
 app.get('/api/device/qr',(req,res)=>{
  const device=store.registered(req);if(!device)return res.status(403).json({error:'Bu tarayıcı kayıtlı bir cihaz değil. Önce yönetim panelindeki Cihaz ekle bölümünden kaydedin.'});
  const challenge=db.prepare('SELECT * FROM qr_challenges WHERE token_hash=? AND consumed=0 AND expires>?').get(digest(String(req.query.token||'')),Date.now());
  if(!challenge)return res.status(410).json({error:'Giriş karekodunun süresi doldu.'});
  res.json({device:{...describeDevice(challenge.ua),ip:challenge.ip},registeredName:device.name,expires:challenge.expires,approved:!!challenge.approved_device});
 });
 app.post('/api/device/qr/approve',(req,res)=>{
  const device=store.registered(req);if(!device)return res.status(403).json({error:'Bu cihazın QR giriş yetkisi yok veya kaldırılmış.'});
  if(typeof req.body?.token!=='string')return res.status(400).json({error:'Geçersiz karekod.'});
  const changed=db.prepare('UPDATE qr_challenges SET approved_device=? WHERE token_hash=? AND consumed=0 AND approved_device IS NULL AND expires>?').run(device.id,digest(req.body.token),Date.now());
  if(!changed.changes)return res.status(410).json({error:'Karekodun süresi doldu veya zaten onaylandı.'});res.json({ok:true});
 });
 app.post('/api/admin/devices/:id/rename',authenticated,(req,res)=>{
  if(!validName(req.body?.name))return res.status(400).json({error:'Cihaz adı 2–60 karakter olmalıdır.'});
  const changed=db.prepare('UPDATE devices SET name=? WHERE id=? AND deleted=0').run(req.body.name.trim(),Number(req.params.id));
  if(!changed.changes)return res.status(404).json({error:'Cihaz bulunamadı.'});res.json({ok:true});
 });
 app.post('/api/admin/devices/:id/remove',authenticated,(req,res)=>{
  const id=Number(req.params.id);if(!Number.isSafeInteger(id))return res.status(400).json({error:'Geçersiz cihaz.'});
  db.prepare('UPDATE devices SET deleted=1,trusted_until=0 WHERE id=?').run(id);db.prepare('UPDATE sessions SET revoked=1 WHERE device_id=?').run(id);res.json({ok:true,current:id===req.adminSession.device_id});
 });
}
