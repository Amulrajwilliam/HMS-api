import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { redisConnectionFromConfig } from '../../config/runtime-data-stores';

/**
 * Redis-backed ephemeral key/value store with in-memory fallback when Redis is unavailable.
 * Used for login lockout, OTP rate limits, and pending TOTP setup (multi-instance safe when Redis is up).
 */
@Injectable()
export class EphemeralStoreService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EphemeralStoreService.name);
  private redis: Redis | null = null;
  private useMemory = false;
  private readonly memory = new Map<string, { value: string; expiresAt?: number }>();

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const { host, port, password, tls } = redisConnectionFromConfig(this.config);

    const client = new Redis({
      host,
      port,
      password,
      ...(tls ? { tls } : {}),
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      lazyConnect: true,
    });

    try {
      await client.connect();
      await client.ping();
      this.redis = client;
      this.logger.log(`Ephemeral store using Redis at ${host}:${port}`);
    } catch (err) {
      this.useMemory = true;
      client.disconnect();
      this.logger.warn(
        `Redis unavailable (${err instanceof Error ? err.message : err}); ephemeral auth state will use in-memory fallback`,
      );
    }
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit().catch(() => undefined);
    }
  }

  /** Sliding-window rate limit. Returns true when the request is allowed. */
  async slidingWindowAllow(key: string, windowMs: number, maxCount: number): Promise<boolean> {
    const now = Date.now();
    if (this.useMemory || !this.redis) {
      const memKey = `sw:${key}`;
      const raw = this.memoryGet(memKey);
      const prev = raw ? (JSON.parse(raw) as number[]).filter((t) => now - t < windowMs) : [];
      if (prev.length >= maxCount) return false;
      prev.push(now);
      this.memorySet(memKey, JSON.stringify(prev), windowMs);
      return true;
    }

    const redisKey = `hms:sw:${key}`;
    const member = `${now}:${Math.random()}`;
    const pipeline = this.redis.multi();
    pipeline.zadd(redisKey, now, member);
    pipeline.zremrangebyscore(redisKey, 0, now - windowMs);
    pipeline.zcard(redisKey);
    pipeline.pexpire(redisKey, windowMs);
    const results = await pipeline.exec();
    const count = Number(results?.[2]?.[1] ?? 0);
    return count <= maxCount;
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlMs?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlMs);
  }

  async get(key: string): Promise<string | null> {
    if (this.useMemory || !this.redis) {
      return this.memoryGet(key);
    }
    return this.redis.get(`hms:kv:${key}`);
  }

  async set(key: string, value: string, ttlMs?: number): Promise<void> {
    if (this.useMemory || !this.redis) {
      this.memorySet(key, value, ttlMs);
      return;
    }
    const redisKey = `hms:kv:${key}`;
    if (ttlMs && ttlMs > 0) {
      await this.redis.set(redisKey, value, 'PX', ttlMs);
    } else {
      await this.redis.set(redisKey, value);
    }
  }

  async delete(key: string): Promise<void> {
    if (this.useMemory || !this.redis) {
      this.memory.delete(key);
      this.memory.delete(`sw:${key}`);
      return;
    }
    await this.redis.del(`hms:kv:${key}`, `hms:sw:${key}`);
  }

  private memoryGet(key: string): string | null {
    const row = this.memory.get(key);
    if (!row) return null;
    if (row.expiresAt && Date.now() >= row.expiresAt) {
      this.memory.delete(key);
      return null;
    }
    return row.value;
  }

  private memorySet(key: string, value: string, ttlMs?: number) {
    this.memory.set(key, {
      value,
      expiresAt: ttlMs && ttlMs > 0 ? Date.now() + ttlMs : undefined,
    });
  }
}
