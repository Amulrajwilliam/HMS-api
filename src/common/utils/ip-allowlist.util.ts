import type { Request } from 'express';

export function normalizeClientIp(ip: string): string {
  const t = ip.trim();
  const m = t.match(/^::ffff:(.+)$/i);
  return m ? m[1] : t;
}

export function clientIpFromRequest(req: Request): string {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length) {
    return normalizeClientIp(xf.split(',')[0] ?? '');
  }
  const raw = (req.socket?.remoteAddress ?? req.ip ?? '') as string;
  return normalizeClientIp(raw);
}

/** IPv4 exact match, trailing `10.0.*` wildcard, or CIDR `a.b.c.d/nn` (8–32). */
export function ipMatchesRule(client: string, rule: string): boolean {
  const r = rule.trim();
  if (!r || !client) return false;
  if (r === '*') return true;
  if (r === client) return true;
  if (r.endsWith('*') && !r.includes('/')) {
    const prefix = r.slice(0, -1);
    return client.startsWith(prefix);
  }
  if (r.includes('/')) {
    return ipv4CidrContains(client, r);
  }
  return false;
}

export function ipMatchesAny(client: string, rules: string[]): boolean {
  return rules.some((rule) => ipMatchesRule(client, rule));
}

function ipv4CidrContains(ip: string, cidr: string): boolean {
  const [base, bitsStr] = cidr.split('/');
  const bits = parseInt(bitsStr ?? '', 10);
  if (!Number.isFinite(bits) || bits < 0 || bits > 32) return false;
  const ipNum = ipv4ToInt(ip);
  const baseNum = ipv4ToInt(base);
  if (ipNum === null || baseNum === null) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipNum & mask) === (baseNum & mask);
}

function ipv4ToInt(s: string): number | null {
  const parts = s.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const v = parseInt(p, 10);
    if (!Number.isFinite(v) || v < 0 || v > 255) return null;
    n = (n << 8) + v;
  }
  return n >>> 0;
}
