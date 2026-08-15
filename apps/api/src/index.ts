import {app} from './app.js';import {config} from './config.js';import {migrate} from './db/index.js';
async function main(){await migrate();const server=app.listen(config.PORT,()=>console.log(`Traefik Pilot API listening on ${config.PORT}`));const stop=()=>server.close(()=>process.exit(0));process.on('SIGTERM',stop);process.on('SIGINT',stop)}main().catch(e=>{console.error(e);process.exit(1)});
