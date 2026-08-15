import os from 'node:os';
import fs from 'node:fs/promises';
import dns from 'node:dns/promises';
import {config} from '../config.js';
import {dockerStatus} from './docker.js';
import {traefikSnapshot} from './traefik.js';

type Check={id:string;label:string;status:'pass'|'warning'|'error';detail:string;fix?:string};

export async function systemDoctor(){
  const checks:Check[]=[];
  const [docker,traefik]=await Promise.all([dockerStatus(),traefikSnapshot()]);
  checks.push({id:'docker',label:'Docker connection',status:docker.connected?'pass':'error',detail:docker.connected?`Engine ${docker.version}`:docker.error||'Unavailable',fix:'Check docker-socket-proxy and its internal network.'});
  checks.push({id:'traefik',label:'Traefik API',status:traefik.connected?'pass':'error',detail:traefik.connected?`Traefik ${traefik.version}`:traefik.error||'Unavailable',fix:'Check the Traefik container and internal API URL.'});
  try{const disk=await fs.statfs('/data');const free=disk.bavail*disk.bsize,total=disk.blocks*disk.bsize,ratio=total?free/total:1;checks.push({id:'disk',label:'Persistent storage',status:ratio<.1?'error':ratio<.2?'warning':'pass',detail:`${Math.round(free/1073741824)} GB free`,fix:'Remove old logs/backups or expand the Hostinger VPS disk.'});}catch{checks.push({id:'disk',label:'Persistent storage',status:'warning',detail:'Disk metrics unavailable'});}
  const available=os.freemem(),total=os.totalmem(),memoryRatio=total?available/total:1;
  checks.push({id:'memory',label:'Available memory',status:memoryRatio<.08?'error':memoryRatio<.15?'warning':'pass',detail:`${Math.round(available/1048576)} MB available`,fix:'Stop unused containers or upgrade the Hostinger VPS plan.'});
  if(config.PILOT_DOMAIN){try{const addresses=await dns.resolve4(config.PILOT_DOMAIN);checks.push({id:'dns',label:'Admin domain DNS',status:'pass',detail:addresses.join(', ')});}catch{checks.push({id:'dns',label:'Admin domain DNS',status:'error',detail:`${config.PILOT_DOMAIN} does not resolve`,fix:'Set an A record to the VPS IP in Hostinger hPanel.'});}}
  checks.push({id:'provider',label:'Deployment profile',status:config.HOSTING_PROVIDER==='hostinger'?'pass':'warning',detail:config.HOSTING_PROVIDER==='hostinger'?'Hostinger VPS optimized':'Generic Docker profile',fix:'Deploy with docker-compose.hostinger.yml.'});
  const errors=checks.filter(c=>c.status==='error').length,warnings=checks.filter(c=>c.status==='warning').length;
  return{status:errors?'error':warnings?'warning':'healthy',provider:config.HOSTING_PROVIDER,checkedAt:new Date().toISOString(),checks,summary:{passed:checks.length-errors-warnings,warnings,errors}};
}
