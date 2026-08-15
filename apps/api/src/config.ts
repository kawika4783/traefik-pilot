import { z } from 'zod';
const schema = z.object({
  NODE_ENV: z.enum(['development','test','production']).default('development'),
  PORT: z.coerce.number().default(4000), DATABASE_URL: z.string().default('postgres://pilot:pilot@localhost:5432/traefik_pilot'),
  JWT_SECRET: z.string().min(32).default('development-secret-change-me-1234567890'),
  ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/).default('1'.repeat(64)),
  ADMIN_ORIGIN: z.string().default('http://localhost:5173'), TRAEFIK_API_URL: z.string().default('http://localhost:8080'),
  TRAEFIK_DYNAMIC_DIR: z.string().default('./.pilot-data/dynamic'), BACKUP_DIR: z.string().default('./.pilot-data/backups'),
  DOCKER_HOST: z.string().optional(), DEMO_MODE: z.string().transform(v=>v==='true').default(false),
  HOSTING_PROVIDER: z.string().default('generic'), PILOT_DOMAIN: z.string().optional(),
  COOKIE_SECURE: z.string().transform(v=>v==='true').optional()
});
export const config = schema.parse(process.env);
