import assert from 'node:assert/strict';
import {createApp} from './app.mjs';
const origin='http://localhost:5173';
const {app,db}=await createApp({production:false,dbPath:':memory:',origin,password:'123456',email:'admin@guzelteknoloji.com'});const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
const jar=(ua='Mozilla/5.0 (Windows NT 10.0) Chrome/130.0.0.0 Safari/537.36')=>({cookie:'',ua});
async function req(route,{user,body,from=origin}={}){const r=await fetch(base+route,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json',Origin:from}),...(user?{Cookie:user.cookie,'User-Agent':user.ua}:{})},body:body===undefined?undefined:JSON.stringify(body)});if(user){const cookies=new Map(user.cookie.split('; ').filter(Boolean).map(c=>c.split('=')));for(const c of r.headers.getSetCookie()){const[k,v]=c.split(';')[0].split('=');cookies.set(k,v);}user.cookie=[...cookies].map(([k,v])=>`${k}=${v}`).join('; ');}return{status:r.status,data:await r.json(),headers:r.headers};}
const login=user=>req('/api/auth/login',{user,body:{email:'admin@guzelteknoloji.com',password:'123456',email:'admin@guzelteknoloji.com'}});
try{
 assert.equal((await req('/api/admin/devices')).status,401);assert.equal((await req('/api/auth/login',{body:{email:'admin@guzelteknoloji.com',password:'123456',email:'admin@guzelteknoloji.com'},from:'https://evil.example'})).status,403);
 const desktop=jar();for(let i=0;i<30;i++)assert.equal((await login(desktop)).status,200);
 let list=(await req('/api/admin/devices',{user:desktop})).data.devices;assert.equal(list.length,1);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE revoked=0').get().n,1);
 const other=jar();await login(other);assert.equal((await req('/api/admin/devices',{user:desktop})).data.devices.length,2,'Different cookie must remain a distinct device even with same UA/IP');
 const entry=(await req('/api/admin/device-enrollments',{user:desktop,body:{}})).data;const secret=new URL(entry.url).searchParams.get('token');const phone=jar('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/604.1');
 assert.equal((await req(`/api/device/enroll?token=${secret}`,{user:phone})).data.status,'ready');
 assert.equal((await req('/api/device/enroll',{user:phone,body:{token:secret,name:'Baran’ın telefonu'}})).status,200);
 const state=(await req(`/api/admin/device-enrollments/${entry.id}`,{user:desktop})).data;assert.equal(state.status,'scanned');assert.equal(state.device.name,'Baran’ın telefonu');
 assert.equal((await req(`/api/admin/device-enrollments/${entry.id}/confirm`,{user:other,body:{}})).status,410);
 assert.equal((await req(`/api/admin/device-enrollments/${entry.id}/confirm`,{user:desktop,body:{}})).status,200);
 assert.equal((await req(`/api/device/enroll?token=${secret}`,{user:phone})).data.status,'approved');assert.equal((await req('/api/auth/session',{user:phone})).status,401,'Phone approval must not require an admin session');
 const target=jar();const qr=(await req('/api/auth/qr',{user:target,body:{}})).data;const qrToken=new URL(qr.url).searchParams.get('token');
 assert.equal((await req(`/api/device/qr?token=${qrToken}`,{user:other})).status,403);assert.equal((await req(`/api/device/qr?token=${qrToken}`,{user:phone})).status,200);
 assert.equal((await req(`/api/auth/qr/${qr.id}`)).status,410);assert.equal((await req(`/api/auth/qr/${qr.id}`,{user:target})).data.status,'pending');
 assert.equal((await req('/api/device/qr/approve',{user:phone,body:{token:qrToken}})).status,200);assert.equal((await req('/api/device/qr/approve',{user:phone,body:{token:qrToken}})).status,410);
 assert.equal((await req(`/api/auth/qr/${qr.id}`,{user:target})).data.status,'approved');assert.equal((await req('/api/auth/session',{user:target})).status,200);assert.equal((await req(`/api/auth/qr/${qr.id}`,{user:target})).status,410);
 assert.equal((await req(`/api/admin/devices/${state.device.id}/rename`,{user:desktop,body:{name:'Baran’ın iPhone’u'}})).status,200);
 const repeated=(await req('/api/admin/device-enrollments',{user:desktop,body:{}})).data;const repeatToken=new URL(repeated.url).searchParams.get('token');await req('/api/device/enroll',{user:phone,body:{token:repeatToken,name:'Baran’ın iPhone’u'}});await req(`/api/admin/device-enrollments/${repeated.id}/confirm`,{user:desktop,body:{}});
 list=(await req('/api/admin/devices',{user:desktop})).data.devices;assert.equal(list.length,4);assert.equal(list.filter(d=>d.type==='mobile').length,1);assert(list.some(d=>d.name==='Baran’ın iPhone’u'&&d.trusted));assert(!JSON.stringify(list).includes('key_hash'));
 const pending=(await req('/api/auth/qr',{user:target,body:{}})).data;const pendingToken=new URL(pending.url).searchParams.get('token');await req('/api/device/qr/approve',{user:phone,body:{token:pendingToken}});await req(`/api/admin/devices/${state.device.id}/remove`,{user:desktop,body:{}});assert.equal((await req(`/api/auth/qr/${pending.id}`,{user:target})).status,410);assert.equal((await req(`/api/device/qr?token=${pendingToken}`,{user:phone})).status,403);
 const expired=(await req('/api/auth/qr',{user:target,body:{}})).data;db.prepare('UPDATE qr_challenges SET expires=? WHERE id=?').run(Date.now()-1,expired.id);assert.equal((await req(`/api/auth/qr/${expired.id}`,{user:target})).status,410);
 await req('/api/admin/devices/revoke-others',{user:desktop,body:{}});assert.equal((await req('/api/auth/session',{user:other})).status,401);assert.equal((await req('/api/auth/session',{user:desktop})).status,200);
 for(let i=0;i<5;i++)assert.equal((await req('/api/auth/login',{body:{email:'no@example.com',password:'bad'}})).status,401);assert.equal((await req('/api/auth/login',{body:{email:'no@example.com',password:'bad'}})).status,429);
 console.log('PASS: 30 logins => 1 device; separate browser identities; QR enrollment + owner confirmation; editable names; duplicate enrollment; registered phone approves without session; QR single use/cookie binding/expiry; removed device denied; CSRF/auth/rate limit.');
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));db.close();}
