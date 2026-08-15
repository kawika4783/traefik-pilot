export type Role = 'administrator' | 'operator' | 'viewer';
export type UserPrincipal = { id: string; email: string; name: string; role: Role };
export type RouteInput = {
  id?: string; name: string; hostnames: string[]; path?: string; containerId: string;
  serviceName?: string; targetPort: number; network: string; entrypoints: string[];
  tls: boolean; certificateResolver?: string; priority?: number; middlewares: string[];
  enabled?: boolean;
};
declare global { namespace Express { interface Request { user?: UserPrincipal } } }
