import {defineConfig,loadEnv} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({mode})=>{
 const env=loadEnv(mode,process.cwd(),'');
 return {plugins:[react(),{
  name:'spesial-local-api',
  async configureServer(server){
   // The local API shares Vite's process, so dev/start.ps1 cannot start the UI alone.
   const {createApp}=await import('./server/app.mjs');
   const {app,db}=await createApp({serveStatic:false,origin:env.APP_ORIGIN||'http://localhost:5173',password:env.ADMIN_PASSWORD,email:env.ADMIN_EMAIL,googleClientId:env.GOOGLE_CLIENT_ID,trustProxy:env.TRUST_PROXY==='1',dbPath:env.DATABASE_PATH});
   server.middlewares.use((req,res,next)=>{if(req.url?.startsWith('/api/'))app(req,res,next);else next();});
   server.httpServer?.once('close',()=>{try{db.close();}catch{}});
  }
 }],server:{port:5173,strictPort:true}};
});
