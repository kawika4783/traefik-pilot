import{describe,expect,it,vi}from'vitest';
vi.mock('./docker.js',()=>({dockerStatus:vi.fn(async()=>({connected:true,version:'27.1'}))}));
vi.mock('./traefik.js',()=>({traefikSnapshot:vi.fn(async()=>({connected:true,version:'3.3',routers:[],services:[],middlewares:[]}))}));
import{systemDoctor}from'./system.js';
describe('system doctor',()=>{it('returns actionable dependency checks',async()=>{const result=await systemDoctor();expect(result.checks.find(c=>c.id==='docker')?.status).toBe('pass');expect(result.checks.find(c=>c.id==='traefik')?.status).toBe('pass');expect(result.checks.every(c=>Boolean(c.label&&c.detail))).toBe(true)})});
