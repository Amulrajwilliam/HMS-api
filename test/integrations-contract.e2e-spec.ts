import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { createServer, Server } from 'http';
import { IntegrationsService } from '../src/modules/integrations/integrations.service';

describe('Integrations adapters contract (sandbox)', () => {
  let appServer: Server;
  let port = 0;
  let svc: IntegrationsService;
  let orderCalls = 0;

  beforeAll(async () => {
    appServer = createServer((req, res) => {
      if (req.url === '/orders' && req.method === 'POST') {
        orderCalls += 1;
        // first call fails to validate retry path, second succeeds
        if (orderCalls === 1) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'temporary' }));
          return;
        }
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ accepted: true, id: 'LAB-SBX-1', apiKey: req.headers['x-api-key'] || null }));
        return;
      }
      if (req.url === '/claims' && req.method === 'POST') {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ accepted: true, id: 'INS-SBX-1' }));
        return;
      }
      if (req.url === '/studies/lookup' && req.method === 'POST') {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ found: true, studyUid: '1.2.3' }));
        return;
      }
      res.statusCode = 404;
      res.end();
    });
    await new Promise<void>((resolve) => appServer.listen(0, resolve));
    port = Number((appServer.address() as any).port);

    process.env.INTEGRATION_LAB_BASE_URL = `http://127.0.0.1:${port}`;
    process.env.INTEGRATION_INSURANCE_BASE_URL = `http://127.0.0.1:${port}`;
    process.env.INTEGRATION_PACS_BASE_URL = `http://127.0.0.1:${port}`;
    process.env.INTEGRATION_LAB_PROVIDER = 'acme-lab';
    process.env.INTEGRATION_INSURANCE_PROVIDER = 'nova-insurance';
    process.env.INTEGRATION_PACS_PROVIDER = 'orion-pacs';
    process.env.INTEGRATION_LAB_API_KEY = 'lab-key';
    process.env.INTEGRATION_RETRY_COUNT = '1';
    process.env.INTEGRATION_TIMEOUT_MS = '2000';

    const mod: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [IntegrationsService],
    }).compile();

    svc = mod.get(IntegrationsService);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => appServer.close(() => resolve()));
  });

  it('retries lab submission and succeeds against sandbox', async () => {
    const out: any = await svc.submitLabOrder('order-1');
    expect(out.queued).toBe(true);
    expect(out.provider).toBe('acme-lab');
    expect(out.vendor).toBe('acme-lab');
    expect(out.externalResponse?.accepted).toBe(true);
    expect(orderCalls).toBe(2);
  });

  it('submits insurance claim and returns sandbox response', async () => {
    const out: any = await svc.submitInsuranceClaim('claim-1');
    expect(out.externalResponse?.accepted).toBe(true);
  });

  it('looks up pacs study with configured endpoint', async () => {
    const out: any = await svc.lookupPacsStudy('1.2.3');
    expect(out.externalResponse?.found).toBe(true);
  });
});
