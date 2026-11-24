import {createApp} from './app.mjs';
const {app,db}=await createApp();
const port=Number(process.env.PORT || 3001);
const server=app.listen(port,process.env.HOST || '0.0.0.0',()=>console.log(`İstanbul Spesial sunucusu: http://localhost:${port}`));
let closing=false;
function shutdown(){
 if(closing)return;closing=true;
 server.close(()=>{db.close();process.exit(0);});
 server.closeIdleConnections();
 setTimeout(()=>{server.closeAllConnections();try{db.close();}catch{}process.exit(1);},8000).unref();
}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
