import fs from 'node:fs/promises';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {parseEnv} from 'node:util';
import {pathToFileURL} from 'node:url';

const inside=(parent,child)=>{const rel=path.relative(parent,child);return !!rel&&!rel.startsWith(`..${path.sep}`)&&rel!=='..'&&!path.isAbsolute(rel);};
const exists=async file=>fs.access(file).then(()=>true,()=>false);
async function atomic(file,content,mode=0o600){await fs.mkdir(path.dirname(file),{recursive:true});const temp=`${file}.deploy-${process.pid}-${randomBytes(4).toString('hex')}`;try{await fs.writeFile(temp,content,{mode,flag:'wx'});await fs.rename(temp,file);}finally{await fs.unlink(temp).catch(()=>{});}}
export async function validatePaths(repo,site,runtime,shared){
 const paths=await Promise.all([repo,site,runtime,shared].map(async p=>{const absolute=path.resolve(p);await fs.mkdir(absolute,{recursive:true});return fs.realpath(absolute);}));
 for(const p of paths)if(p===path.parse(p).root||/[\r\n%]/.test(p))throw Error('Güvenli olmayan deploy yolu.');
 for(let i=0;i<paths.length;i++)for(let j=i+1;j<paths.length;j++)if(paths[i]===paths[j]||inside(paths[i],paths[j])||inside(paths[j],paths[i]))throw Error('Repo, site, runtime ve shared dizinleri ayrı olmalıdır.');
 return paths;
}
export async function initEnv(file,shared,port,origin){
 if(await exists(file))return false;
 const password=randomBytes(24).toString('base64url');
 const content=`NODE_ENV=production\nAPP_ORIGIN=${origin}\nHOST=127.0.0.1\nPORT=${port}\nADMIN_EMAIL=admin@guzelteknoloji.com\nADMIN_PASSWORD=${password}\nDATABASE_PATH=${path.join(shared,'data','admin.sqlite')}\nTRUST_PROXY=1\n# GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com\n`;
 await fs.mkdir(path.dirname(file),{recursive:true,mode:0o700});await fs.writeFile(file,content,{flag:'wx',mode:0o600});return true;
}
export async function readConfig(file,shared,site,repo){
 const siteReal=await fs.realpath(site),repoReal=await fs.realpath(repo);const envPath=await fs.realpath(file);if(inside(siteReal,envPath)||inside(repoReal,envPath))throw Error('.env repo ve web kökünün dışında tutulmalıdır.');
 const env=parseEnv(await fs.readFile(file,'utf8'));const url=new URL(env.APP_ORIGIN||'');
 if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('.env APP_ORIGIN tam HTTPS site adresi olmalıdır.');
 if(!env.ADMIN_EMAIL||!env.ADMIN_EMAIL.includes('@'))throw Error('.env ADMIN_EMAIL eksik.');
 if(env.ADMIN_PASSWORD&&env.ADMIN_PASSWORD.length<12)throw Error('Üretim yönetici parolası en az 12 karakter olmalıdır.');
 let database=path.resolve(env.DATABASE_PATH||path.join(shared,'data','admin.sqlite'));
 if(!path.isAbsolute(env.DATABASE_PATH||database)||inside(path.resolve(site),database)||inside(path.resolve(repo),database))throw Error('DATABASE_PATH repo ve web kökü dışında mutlak bir yol olmalıdır.');
 if(!await exists(database)&&(!env.ADMIN_PASSWORD||env.ADMIN_PASSWORD.length<12))throw Error('İlk kurulum için .env ADMIN_PASSWORD gereklidir.');
 await fs.mkdir(path.dirname(database),{recursive:true,mode:0o700});database=await exists(database)?await fs.realpath(database):path.join(await fs.realpath(path.dirname(database)),path.basename(database));if(inside(siteReal,database)||inside(repoReal,database))throw Error('DATABASE_PATH bağlantı üzerinden web köküne veya repoya yönlenemez.');await fs.chmod(file,0o600);return {database,origin:url.origin};
}
const excluded=new Set(['images/hero-food.png','images/ingredients.png','images/service-food.png']);
export async function publicFiles(dist){
 const result=[];
 async function walk(dir,relative=''){
  for(const entry of await fs.readdir(dir,{withFileTypes:true})){
   const rel=relative?`${relative}/${entry.name}`:entry.name;
   if(entry.name.startsWith('.')||entry.isSymbolicLink())throw Error(`Yayın çıktısında gizli dosya/bağlantı var: ${rel}`);
   if(entry.isDirectory()){
    if(!relative&&!['assets','images','logos'].includes(entry.name))throw Error(`Beklenmeyen yayın dizini: ${rel}`);
    await walk(path.join(dir,entry.name),rel);
   }else if(entry.isFile()&&!excluded.has(rel)){
    if(!/\.(?:html|js|css|png|webp|jpg|jpeg|svg|ico|avif|woff2?|ttf|txt|xml|webmanifest|json)$/i.test(rel))throw Error(`Beklenmeyen yayın dosyası: ${rel}`);
    if(!relative&&!['index.html','robots.txt','sitemap.xml','favicon.ico','favicon.svg','manifest.webmanifest'].includes(rel))throw Error(`Beklenmeyen kök dosyası: ${rel}`);
    result.push(rel);
   }
  }
 }
 await walk(dist);if(!result.includes('index.html'))throw Error('dist/index.html yok.');return result.sort((a,b)=>a==='index.html'?1:b==='index.html'?-1:a.localeCompare(b));
}
export async function stageRelease(repo,release,revision){
 if(await exists(release))throw Error('Sürüm dizini zaten mevcut.');
 const dist=path.join(repo,'dist');const files=await publicFiles(dist);await fs.mkdir(release,{recursive:true});
 for(const rel of files){const dest=path.join(release,'dist',rel);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.copyFile(path.join(dist,rel),dest);}
 await fs.mkdir(path.join(release,'server'));
 for(const entry of await fs.readdir(path.join(repo,'server'),{withFileTypes:true})){if(entry.isFile()&&entry.name.endsWith('.mjs')&&!entry.name.endsWith('.test.mjs'))await fs.copyFile(path.join(repo,'server',entry.name),path.join(release,'server',entry.name));}
 for(const file of ['package.json','package-lock.json'])await fs.copyFile(path.join(repo,file),path.join(release,file));
 await atomic(path.join(release,'.release.json'),JSON.stringify({revision,created:new Date().toISOString()})+'\n');
}
export async function publishDist(dist,site){
 const root=await fs.realpath(site);const files=await publicFiles(dist);
 for(const rel of files){
  const destination=path.join(root,...rel.split('/'));const parts=rel.split('/').slice(0,-1);let current=root;
  for(const part of parts){current=path.join(current,part);await fs.mkdir(current,{recursive:true,mode:0o755});const actual=await fs.realpath(current);if(!inside(root,actual))throw Error('Yayın dizini web kökünün dışına yönleniyor.');await fs.chmod(current,0o755);}
  const prior=await fs.lstat(destination).catch(()=>null);if(prior?.isSymbolicLink())throw Error('Mevcut yayın dosyası sembolik bağlantı olamaz.');
  await atomic(destination,await fs.readFile(path.join(dist,rel)),0o644);
 }
 return files.length;
}
export async function backupDatabase(source,destination){
 if(!await exists(source))return false;
 const {DatabaseSync,backup}=await import('node:sqlite');if(typeof backup!=='function')throw Error('Güvenli SQLite yedeği için Node.js 22.16+ gerekir.');
 if(await exists(destination))throw Error('Yedek dosyası zaten var.');await fs.mkdir(path.dirname(destination),{recursive:true,mode:0o700});
 const db=new DatabaseSync(source,{readOnly:true});try{await backup(db,destination);}finally{db.close();}
 await fs.chmod(destination,0o600);return true;
}
export async function pm2Config({release,envFile,name,port,node,logs,output,database,revision}){
 const productionEnv=parseEnv(await fs.readFile(envFile,'utf8'));
 const spec={apps:[{name,script:path.join(release,'server/index.mjs'),cwd:release,interpreter:node,node_args:[`--env-file=${envFile}`],env:{NODE_ENV:'production',APP_ORIGIN:productionEnv.APP_ORIGIN,HOST:'127.0.0.1',PORT:String(port),DATABASE_PATH:database,RELEASE_ID:revision},instances:1,exec_mode:'fork',autorestart:true,watch:false,min_uptime:'10s',max_restarts:10,exp_backoff_restart_delay:100,max_memory_restart:'400M',kill_timeout:10000,out_file:path.join(logs,'app.log'),error_file:path.join(logs,'error.log'),log_date_format:'YYYY-MM-DD HH:mm:ss Z',merge_logs:true}]};
 await atomic(output,`module.exports = ${JSON.stringify(spec,null,2)};\n`);return spec;
}
async function state(runtime){return JSON.parse(await fs.readFile(path.join(runtime,'state.json'),'utf8').catch(()=>'{}'));}
function managed(runtime,release){const base=path.resolve(runtime,'releases');const resolved=path.resolve(release);if(!inside(base,resolved)||path.dirname(resolved)!==base||!/^\d{8}T\d{6}-[a-f0-9]{12}-\d+$/.test(path.basename(resolved)))throw Error('Yönetilen bir sürüm yolu değil.');return resolved;}
export async function activate(runtime,release){managed(runtime,release);const old=await state(runtime);await atomic(path.join(runtime,'state.json'),JSON.stringify({current:release,previous:old.current===release?old.previous:old.current||null},null,2)+'\n');}
export async function prune(runtime){
 const data=await state(runtime),dir=path.resolve(runtime,'releases');const keep=new Set([data.current,data.previous].filter(Boolean));
 const entries=await fs.readdir(dir,{withFileTypes:true});const candidates=[];
 for(const e of entries){if(!e.isDirectory()||e.isSymbolicLink()||!/^\d{8}T\d{6}-[a-f0-9]{12}-\d+$/.test(e.name))continue;const p=managed(runtime,path.join(dir,e.name));if(await exists(path.join(p,'.release.json')))candidates.push(p);}
 for(const p of candidates.sort().slice(-3))keep.add(p);
 for(const p of candidates)if(!keep.has(p)){const actual=await fs.realpath(p);if(actual!==p)throw Error('Sürüm yolunda beklenmeyen bağlantı var.');await fs.rm(p,{recursive:true});}
}
function shellQuote(text){return `'${String(text).replaceAll("'", "'\\''")}'`;}
export async function writeRecovery(file,node,pm2,pm2Home,bin){
 const script=`#!/usr/bin/env bash\nset -euo pipefail\nexport PATH=${shellQuote(path.dirname(node)+':'+bin)}:\"$PATH\"\nexport PM2_HOME=${shellQuote(pm2Home)}\nexec ${shellQuote(node)} ${shellQuote(pm2)} resurrect\n`;
 await atomic(file,script,0o700);
}
async function cli(){
 const [command,...a]=process.argv.slice(2);
 switch(command){
  case 'paths':await validatePaths(...a);break;
  case 'init-env':if(await initEnv(...a))console.log('Üretim .env dosyası oluşturuldu; parola yalnızca bu özel dosyada tutuluyor.');break;
  case 'config-db':console.log((await readConfig(...a)).database);break;
  case 'config-origin':console.log((await readConfig(...a)).origin);break;
  case 'stage':await stageRelease(...a);break;
  case 'publish':console.log(`${await publishDist(...a)} yayın dosyası güncellendi.`);break;
  case 'backup':console.log(await backupDatabase(...a)?'SQLite yedeği alındı.':'İlk kurulum; mevcut veritabanı yok.');break;
  case 'pm2':await pm2Config(Object.fromEntries(['release','envFile','name','port','node','logs','output','database','revision'].map((k,i)=>[k,a[i]])));break;
  case 'activate':await activate(...a);break;
  case 'current':case 'previous':{const value=(await state(a[0]))[command];if(value)console.log(managed(a[0],value));break;}
  case 'revision':console.log(JSON.parse(await fs.readFile(path.join(a[0],'.release.json'),'utf8')).revision);break;
  case 'prune':await prune(...a);break;
  case 'recovery':await writeRecovery(...a);break;
  case 'port':{const [port,revision,owned]=a;const {createServer}=await import('node:net');const probe=createServer();const available=await new Promise((resolve,reject)=>{probe.once('error',e=>e.code==='EADDRINUSE'?resolve(false):reject(e));probe.listen(Number(port),'127.0.0.1',()=>probe.close(()=>resolve(true)));});if(!available){let ours=false;if(owned==='1'&&revision){try{const r=await fetch(`http://127.0.0.1:${port}/api/health`,{signal:AbortSignal.timeout(3000)});const d=await r.json();ours=r.ok&&d.app==='istanbul-spesial'&&d.release===revision;}catch{}}if(!ours)throw Error('Port başka veya yönetilmeyen bir uygulamada kullanılıyor. Hiçbir süreç sonlandırılmadı.');}break;}
  case 'health':{const [port,revision]=a;let good=false;for(let i=0;i<30;i++){try{const r=await fetch(`http://127.0.0.1:${port}/api/health`,{signal:AbortSignal.timeout(2000)});const d=await r.json();if(r.ok&&d.ok===true&&d.release===revision){good=true;break;}}catch{}await new Promise(r=>setTimeout(r,1000));}if(!good)throw Error('Yeni sürüm sağlık kontrolünden geçemedi.');break;}
  default:throw Error('Bilinmeyen deploy yardımcı komutu.');
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)cli().catch(error=>{console.error(error.message);process.exitCode=1;});
