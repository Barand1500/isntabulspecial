import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {DatabaseSync} from 'node:sqlite';
import {stageRelease,publishDist,initEnv,readConfig,backupDatabase,pm2Config,activate,prune,validatePaths,writeRecovery} from './deploy-helper.mjs';
const workspace=path.resolve('.');
const tools=path.join(workspace,'tools');
async function fixture(){await fs.mkdir(tools,{recursive:true});const root=await fs.mkdtemp(path.join(tools,'deploy-test-'));const repo=path.join(root,'repo'),site=path.join(root,'site'),runtime=path.join(root,'runtime'),shared=path.join(root,'shared');await validatePaths(repo,site,runtime,shared);return{root,repo,site,runtime,shared};}
async function cleanup(root){const absolute=path.resolve(root);assert.equal(path.dirname(absolute),tools);assert(path.basename(absolute).startsWith('deploy-test-'));await fs.rm(absolute,{recursive:true,force:true});}
async function write(file,text){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,text);}
const exists=file=>fs.access(file).then(()=>true,()=>false);
test('Only runtime files are staged; protected live files survive atomic publication',async()=>{
 const c=await fixture();try{
  await write(path.join(c.repo,'dist/index.html'),'new html');await write(path.join(c.repo,'dist/assets/new.js'),'console.log(1)');await write(path.join(c.repo,'dist/images/hero-food.png'),'unused source');await write(path.join(c.repo,'dist/images/hero-food.webp'),'webp');await write(path.join(c.repo,'server/index.mjs'),'export {};');await write(path.join(c.repo,'server/auth.test.mjs'),'test source');await write(path.join(c.repo,'server/.env'),'not published');await write(path.join(c.repo,'package.json'),'{}');await write(path.join(c.repo,'package-lock.json'),'{}');await write(path.join(c.repo,'src/private.ts'),'source code');
  const release=path.join(c.runtime,'releases/20261124T100000-aaaaaaaaaaaa-1');await stageRelease(c.repo,release,'a'.repeat(40));
  assert(await exists(path.join(release,'server/index.mjs')));assert(!await exists(path.join(release,'server/auth.test.mjs')));assert(!await exists(path.join(release,'server/.env')));assert(!await exists(path.join(release,'src')));assert(!await exists(path.join(release,'dist/images/hero-food.png')));
  const protectedFiles=['.env','uploads/photo.jpg','.well-known/token','robots.txt','sitemap.xml'];for(const f of protectedFiles)await write(path.join(c.site,f),'keep me');
  await publishDist(path.join(release,'dist'),c.site);assert.equal(await fs.readFile(path.join(c.site,'index.html'),'utf8'),'new html');for(const f of protectedFiles)assert.equal(await fs.readFile(path.join(c.site,f),'utf8'),'keep me');
  await write(path.join(release,'dist/.env'),'blocked');await assert.rejects(()=>publishDist(path.join(release,'dist'),c.site),/gizli/);assert.equal(await fs.readFile(path.join(c.site,'.env'),'utf8'),'keep me');
 }finally{await cleanup(c.root);}
});
test('Production env is created once, stays outside web root, and is never overwritten',async()=>{
 const c=await fixture();try{const file=path.join(c.shared,'.env');assert.equal(await initEnv(file,c.shared,'3015','https://istanbulspesial.com.tr'),true);const first=await fs.readFile(file,'utf8');assert.equal(await initEnv(file,c.shared,'9999','https://other.example'),false);assert.equal(await fs.readFile(file,'utf8'),first);const config=await readConfig(file,c.shared,c.site,c.repo);assert.equal(config.origin,'https://istanbulspesial.com.tr');assert.equal(config.database,path.join(c.shared,'data/admin.sqlite'));await write(path.join(c.site,'.env'),first);await assert.rejects(()=>readConfig(path.join(c.site,'.env'),c.shared,c.site,c.repo),/dışında/);await assert.rejects(()=>validatePaths(c.repo,path.join(c.repo,'public'),c.runtime,c.shared),/ayrı/);}finally{await cleanup(c.root);}
});
test('SQLite online backup contains committed WAL data',async()=>{
 const c=await fixture();let db;try{const file=path.join(c.shared,'active.sqlite');db=new DatabaseSync(file);db.exec('PRAGMA journal_mode=WAL;CREATE TABLE records(value TEXT);INSERT INTO records VALUES (\'persisted\');');const dest=path.join(c.shared,'backups/snapshot.sqlite');assert(await backupDatabase(file,dest));const copy=new DatabaseSync(dest,{readOnly:true});assert.equal(copy.prepare('SELECT value FROM records').get().value,'persisted');copy.close();assert.equal(db.prepare('SELECT COUNT(*) n FROM records').get().n,1);await assert.rejects(()=>backupDatabase(file,dest),/zaten/);}finally{db?.close();await cleanup(c.root);}
});
test('Release retention never deletes active/previous release or unrelated directories',async()=>{
 const c=await fixture();try{const releases=[];for(let i=1;i<=6;i++){const r=path.join(c.runtime,`releases/20261124T10000${i}-${String(i).repeat(12)}-1`);await write(path.join(r,'.release.json'),JSON.stringify({revision:String(i).repeat(40)}));releases.push(r);}await activate(c.runtime,releases[1]);await activate(c.runtime,releases[2]);await write(path.join(c.runtime,'releases/manual-files/important'),'keep');await prune(c.runtime);assert(!await exists(releases[0]));assert(await exists(releases[1]));assert(await exists(releases[2]));assert(await exists(path.join(c.runtime,'releases/manual-files/important')));await assert.rejects(()=>activate(c.runtime,c.site),/Yönetilen/);const boot=path.join(c.shared,'bin/restart.sh');await writeRecovery(boot,process.execPath,'/private/pm2/bin/pm2','/private/pm2-home','/bin');assert.match(await fs.readFile(boot,'utf8'),/resurrect/);}finally{await cleanup(c.root);}
});
test('Generated PM2 runtime configuration starts the real production API on localhost',async()=>{
 const c=await fixture();let child;try{
  await fs.mkdir(path.join(c.repo,'dist'));await write(path.join(c.repo,'dist/index.html'),'<!doctype html><title>production</title>');await fs.cp(path.join(workspace,'server'),path.join(c.repo,'server'),{recursive:true});for(const f of ['package.json','package-lock.json'])await fs.copyFile(path.join(workspace,f),path.join(c.repo,f));
  const revision='a'.repeat(40),release=path.join(c.runtime,'releases/20261124T110000-aaaaaaaaaaaa-1');await stageRelease(c.repo,release,revision);await fs.symlink(path.join(workspace,'node_modules'),path.join(release,'node_modules'),process.platform==='win32'?'junction':'dir');const file=path.join(c.shared,'.env');await initEnv(file,c.shared,'3015','https://istanbulspesial.com.tr');const {database}=await readConfig(file,c.shared,c.site,c.repo);
  const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
  const spec=await pm2Config({release,envFile:file,name:'deploy-test',port,node:process.execPath,logs:path.join(c.shared,'logs'),output:path.join(c.shared,'ecosystem.config.cjs'),database,revision});const configText=await fs.readFile(path.join(c.shared,'ecosystem.config.cjs'),'utf8');assert(!configText.includes('ADMIN_PASSWORD'));assert(!configText.includes('GOOGLE_CLIENT_ID'));const app=spec.apps[0];child=spawn(app.interpreter,[...app.node_args,app.script],{cwd:app.cwd,env:{...process.env,...app.env},stdio:['ignore','pipe','pipe']});let stderr='';child.stderr.on('data',b=>stderr+=b);
  let good=false;for(let i=0;i<100;i++){try{const response=await fetch(`http://127.0.0.1:${port}/api/health`);const data=await response.json();if(response.ok&&data.release===revision){good=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert(good,stderr);
  const guarded=await fetch(`http://127.0.0.1:${port}/api/admin/devices`);assert.equal(guarded.status,401);assert(await exists(database));
 }finally{if(child&&child.exitCode===null){const exited=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await exited;}await cleanup(c.root);}
});
