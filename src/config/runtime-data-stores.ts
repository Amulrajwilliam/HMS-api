import { ConfigService } from '@nestjs/config';

/** Neon / cloud Postgres require SSL; local dev does not. */
export function postgresSslOption(
  cfg: ConfigService | NodeJS.ProcessEnv,
): false | { rejectUnauthorized: boolean } {
  const get = (key: string, fallback = '') =>
    cfg instanceof ConfigService
      ? (cfg.get<string>(key) ?? fallback)
      : (cfg[key] ?? fallback);

  const explicit = get('DB_SSL');
  if (explicit === 'true') return { rejectUnauthorized: false };
  if (explicit === 'false') return false;

  const host = get('DB_HOST', 'localhost') ?? 'localhost';
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  return isLocal ? false : { rejectUnauthorized: false };
}

export function redisConnectionFromConfig(cfg: ConfigService) {
  const host = cfg.get<string>('REDIS_HOST', '127.0.0.1');
  const port = cfg.get<number>('REDIS_PORT', 6379);
  const password = cfg.get<string>('REDIS_PASSWORD') || undefined;
  const tlsExplicit = cfg.get<string>('REDIS_TLS');
  const useTls =
    tlsExplicit === 'true' ||
    (tlsExplicit !== 'false' &&
      (host.includes('upstash.io') || host.endsWith('.upstash.io')));

  return {
    host,
    port,
    password,
    ...(useTls ? { tls: {} as const } : {}),
  };
}
