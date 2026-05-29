import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as os from 'node:os';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { seedDatabase } from './database/seed';

function logLanAccessUrls(port: number, logger: Logger) {
  if (process.env.NODE_ENV === 'production') return;
  const urls: string[] = [];
  for (const nets of Object.values(os.networkInterfaces())) {
    if (!nets) continue;
    for (const n of nets) {
      if (!n || n.internal) continue;
      const fam = n.family as string | number;
      if (fam !== 'IPv4' && fam !== 4) continue;
      const { address } = n;
      if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address)) {
        urls.push(`http://${address}:${port}/api/v1`);
      }
    }
  }
  const unique = [...new Set(urls)];
  if (unique.length) {
    logger.log(`Phone / LAN (same Wi‑Fi): ${unique.join('  |  ')}`);
    logger.log(
      'Tip: x.x.x.1 is often your router, not this PC — use the IPv4 from ipconfig on the machine running the API.',
    );
  }
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');

  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    const defaultOrigins = [
      process.env.WEB_URL || 'http://localhost:3001',
      'http://localhost:3001',
      'http://localhost:3000',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:3000',
    ];
    const extra = (process.env.CORS_EXTRA_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    app.enableCors({
      origin: [...new Set([...defaultOrigins, ...extra])],
      credentials: true,
    });
  } else {
    // Dev: allow any origin so Expo Go / Vite on --host / LAN IPs are not blocked by CORS.
    app.enableCors({ origin: true, credentials: true });
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  const port = Number(process.env.PORT) || 8000;
  const listenHost = process.env.LISTEN_HOST ?? '0.0.0.0';
  await app.listen(port, listenHost);

  // Run seeder in dev — get DataSource via class token (not string)
  if (process.env.NODE_ENV !== 'production') {
    try {
      const dataSource = app.get(DataSource);
      if (dataSource?.isInitialized) {
        logger.log('Running database seeder...');
        await seedDatabase(dataSource);
      }
    } catch (e) {
      logger.warn('Seeder skipped: ' + (e as Error).message);
    }
  }

  logger.log(
    `🏥 HMS API listening on http://${listenHost}:${port}/api/v1 (reachable from LAN when host is 0.0.0.0)`,
  );
  logLanAccessUrls(port, logger);
}
bootstrap();
