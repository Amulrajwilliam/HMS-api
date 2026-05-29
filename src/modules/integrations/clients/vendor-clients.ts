import { createHmac } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { VendorClient, VendorRequest, VendorResponse } from './types';

function assertObject(raw: unknown, provider: string): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') {
    throw new ServiceUnavailableException(`${provider} invalid response payload`);
  }
  return raw as Record<string, unknown>;
}

export class LabAcmeClient implements VendorClient {
  readonly provider = 'acme-lab';
  constructor(private readonly cfg: ConfigService) {}

  async call(url: string, req: VendorRequest): Promise<VendorResponse> {
    const apiKey = this.cfg.get<string>('INTEGRATION_LAB_API_KEY');
    const secret = this.cfg.get<string>('INTEGRATION_LAB_HMAC_SECRET');
    const body = JSON.stringify({ orderId: req.payload.orderId, source: 'hms' });

    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (apiKey) headers['x-acme-key'] = apiKey;
    if (secret) headers['x-acme-signature'] = createHmac('sha256', secret).update(body).digest('hex');

    const res = await fetch(url, { method: 'POST', headers, body });
    if (!res.ok) throw new ServiceUnavailableException(`acme-lab HTTP ${res.status}`);
    const raw = assertObject(await res.json().catch(() => (null)), this.provider);
    const accepted = Boolean(raw.accepted ?? raw.ok ?? (raw.status === 'accepted'));
    const externalId = (raw.id as string) ?? (raw.externalId as string | undefined);
    if (!accepted || !externalId) {
      throw new ServiceUnavailableException(
        `${this.provider} contract mismatch: expected accepted=true with external id`,
      );
    }
    return { accepted, externalId, raw };
  }
}

export class InsuranceNovaClient implements VendorClient {
  readonly provider = 'nova-insurance';
  constructor(private readonly cfg: ConfigService) {}

  async call(url: string, req: VendorRequest): Promise<VendorResponse> {
    const token = this.cfg.get<string>('INTEGRATION_INSURANCE_API_KEY');
    const body = JSON.stringify({ claimRef: req.payload.claimId, meta: { source: 'hms' } });
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;

    const res = await fetch(url, { method: 'POST', headers, body });
    if (!res.ok) throw new ServiceUnavailableException(`nova-insurance HTTP ${res.status}`);
    const raw = assertObject(await res.json().catch(() => (null)), this.provider);
    const accepted = Boolean(raw.accepted || raw.result === 'queued' || raw.result === 'ok');
    const externalId =
      (raw.id as string) ?? (raw.claimId as string | undefined) ?? (raw.externalId as string | undefined);
    if (!accepted || !externalId) {
      throw new ServiceUnavailableException(
        `${this.provider} contract mismatch: expected accepted result with claim id`,
      );
    }
    return { accepted, externalId, raw };
  }
}

export class PacsOrionClient implements VendorClient {
  readonly provider = 'orion-pacs';
  constructor(private readonly cfg: ConfigService) {}

  async call(url: string, req: VendorRequest): Promise<VendorResponse> {
    const apiKey = this.cfg.get<string>('INTEGRATION_PACS_API_KEY');
    const body = JSON.stringify({ studyUid: req.payload.studyUid, patientMrn: req.payload.patientMrn });
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (apiKey) headers['x-pacs-token'] = apiKey;

    const res = await fetch(url, { method: 'POST', headers, body });
    if (!res.ok) throw new ServiceUnavailableException(`orion-pacs HTTP ${res.status}`);
    const raw = assertObject(await res.json().catch(() => (null)), this.provider);
    const accepted = Boolean(raw.found ?? raw.accepted ?? raw.ok);
    const externalId = (raw.studyUid as string) ?? (raw.id as string | undefined);
    if (!accepted || !externalId) {
      throw new ServiceUnavailableException(
        `${this.provider} contract mismatch: expected found/accepted study identifier`,
      );
    }
    return { accepted, externalId, raw };
  }
}
