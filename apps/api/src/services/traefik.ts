import { config } from '../config.js';
async function get(path:string){const r=await fetch(`${config.TRAEFIK_API_URL}${path}`,{signal:AbortSignal.timeout(4000)});if(!r.ok)throw new Error(`Traefik API ${r.status}`);return r.json();}
export async function traefikSnapshot(){try{const [version,routers,services,middlewares]=await Promise.all([get('/api/version'),get('/api/http/routers'),get('/api/http/services'),get('/api/http/middlewares')]);return{connected:true,version:version.Version||version.version,routers,services,middlewares};}catch(e){return{connected:false,version:'Unavailable',routers:[],services:[],middlewares:[],error:e instanceof Error?e.message:'Traefik unavailable'};}}
export async function verifyTraefik(expectedRouter?:string){const snapshot=await traefikSnapshot();if(!snapshot.connected)return{ok:false,reason:snapshot.error||'Traefik API unreachable'};if(expectedRouter&&!snapshot.routers.some((r:any)=>String(r.name).startsWith(expectedRouter)))return{ok:false,reason:`Router ${expectedRouter} did not load`};return{ok:true};}
export async function testRoute(hostname:string,port:number){
  const results:any={hostname};
  try{const dns=await import('node:dns/promises');results.dns={ok:true,addresses:await dns.resolve4(hostname)};}catch(e){results.dns={ok:false,detail:e instanceof Error?e.message:String(e)}}
  for(const protocol of ['http','https'] as const){
    try{const r=await fetch(`${protocol}://${hostname}`,{redirect:'manual',signal:AbortSignal.timeout(7000)});results[protocol]={ok:r.status<500,status:r.status,location:r.headers.get('location')};}
    catch(e){results[protocol]={ok:false,detail:e instanceof Error?e.message:String(e)}}
  }
  try{const net=await import('node:net');await new Promise<void>((resolve,reject)=>{const s=net.createConnection({host:hostname,port},()=>{s.destroy();resolve()});s.setTimeout(4000,()=>{s.destroy();reject(new Error('timeout'))});s.on('error',reject)});results.backend={ok:true};}
  catch(e){results.backend={ok:false,detail:e instanceof Error?e.message:String(e)}}
  return results;
}
