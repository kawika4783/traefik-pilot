export const routes=[
{name:'webapp',rule:'Host(`app.example.com`)',entry:'websecure',service:'webapp-svc',status:'healthy',tls:true,requests:'1.2k'},
{name:'api',rule:'Host(`api.example.com`)',entry:'websecure',service:'api-svc',status:'healthy',tls:true,requests:'842'},
{name:'blog',rule:'Host(`blog.example.com`)',entry:'websecure',service:'blog-svc',status:'warning',tls:true,requests:'324'},
{name:'admin',rule:'Host(`admin.example.com`)',entry:'websecure',service:'admin-svc',status:'error',tls:true,requests:'12'},
{name:'metrics',rule:'PathPrefix(`/metrics`)',entry:'web',service:'prometheus-svc',status:'healthy',tls:false,requests:'293'},
{name:'whoami',rule:'Host(`whoami.example.com`)',entry:'web',service:'whoami-svc',status:'disabled',tls:false,requests:'0'}];
export const containers=[
{id:'a72c9132d1d4',name:'webapp',image:'ghcr.io/acme/webapp:1.4.0',state:'running',health:'healthy',ports:'3000',networks:'traefik-public',exposed:true,routes:2},
{id:'6bc402cf92a1',name:'api',image:'ghcr.io/acme/api:2.1.0',state:'running',health:'healthy',ports:'8080',networks:'traefik-public',exposed:true,routes:2},
{id:'35d8a1ff980d',name:'blog',image:'ghost:5-alpine',state:'running',health:'healthy',ports:'2368',networks:'traefik-public',exposed:true,routes:1},
{id:'4e9d08bb5a71',name:'admin',image:'ghcr.io/acme/admin:1.2.0',state:'exited',health:'unknown',ports:'4173',networks:'traefik-public',exposed:true,routes:1},
{id:'92ab044b77cc',name:'prometheus',image:'prom/prometheus:v2.52',state:'running',health:'healthy',ports:'9090',networks:'monitoring',exposed:false,routes:0},
{id:'14aabb90ce11',name:'redis',image:'redis:7.2-alpine',state:'running',health:'healthy',ports:'6379',networks:'internal',exposed:false,routes:0}];
export const logs=['INFO  Configuration reloaded from provider docker','INFO  Added route: webapp@docker','INFO  Added service: webapp-svc@docker','WARN  Certificate for blog.example.com expires in 14 days','ERROR Error forwarding request: 503 Service Unavailable','INFO  Incoming request GET /api/health from 10.0.0.12','INFO  TLS handshake completed for api.example.com'];
export const changes=[['Route created: webapp','Today at 14:28:11','admin','success'],['Middleware updated: rate-limit','Today at 14:21:03','admin','warning'],['Service deleted: legacy-svc','Today at 13:47:58','admin','error'],['Router updated: api (rule change)','Today at 13:22:14','admin','info'],['Certificate renewed: example.com','Today at 12:10:45','system','success']];
