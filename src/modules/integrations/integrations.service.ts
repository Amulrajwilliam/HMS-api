import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  InsuranceNovaClient,
  LabAcmeClient,
  PacsOrionClient,
} from './clients/vendor-clients';
import { IntegrationDomain, VendorClient } from './clients/types';

type CircuitState = { failures: number; openedUntil?: number };
type Telemetry = {
  calls: number;
  success: number;
  failures: number;
  lastError?: string;
  lastProvider?: string;
};

@Injectable()
export class IntegrationsService {
  private readonly circuit = new Map<string, CircuitState>();
  private readonly telemetry = new Map<string, Telemetry>();

  constructor(private readonly cfg: ConfigService) {}

  private domainProvider(domain: IntegrationDomain): string {
    const key = `INTEGRATION_${domain.toUpperCase()}_PROVIDER`;
    return (this.cfg.get<string>(key) || 'stub').toLowerCase();
  }

  private telemetryKey(domain: IntegrationDomain) {
    return `integration:${domain}`;
  }

  private bump(domain: IntegrationDomain, kind: 'calls' | 'success' | 'failures', err?: string, provider?: string) {
    const key = this.telemetryKey(domain);
    const t = this.telemetry.get(key) ?? { calls: 0, success: 0, failures: 0 };
    t[kind] += 1;
    if (err) t.lastError = err;
    if (provider) t.lastProvider = provider;
    this.telemetry.set(key, t);
  }

  private provider(name: string, envKey: string, fallback: string) {
    return this.cfg.get<string>(envKey) || `${name}:${fallback}`;
  }

  getTelemetry() {
    const out: Record<string, any> = {};
    for (const [k, v] of this.telemetry.entries()) out[k] = v;
    for (const [k, v] of this.circuit.entries()) out[`circuit:${k}`] = v;
    return out;
  }

  pingLab() {
    return {
      provider: this.provider('lab', 'INTEGRATION_LAB_PROVIDER', 'stub'),
      status: 'ok',
      endpointConfigured: Boolean(this.cfg.get<string>('INTEGRATION_LAB_BASE_URL')),
      baseUrl: this.cfg.get<string>('INTEGRATION_LAB_BASE_URL') || null,
    };
  }

  pingInsurance() {
    return {
      provider: this.provider('insurance', 'INTEGRATION_INSURANCE_PROVIDER', 'stub'),
      status: 'ok',
      endpointConfigured: Boolean(this.cfg.get<string>('INTEGRATION_INSURANCE_BASE_URL')),
      baseUrl: this.cfg.get<string>('INTEGRATION_INSURANCE_BASE_URL') || null,
    };
  }

  pingPacs() {
    return {
      provider: this.provider('pacs', 'INTEGRATION_PACS_PROVIDER', 'stub'),
      status: 'ok',
      endpointConfigured: Boolean(this.cfg.get<string>('INTEGRATION_PACS_BASE_URL')),
      baseUrl: this.cfg.get<string>('INTEGRATION_PACS_BASE_URL') || null,
    };
  }

  submitLabOrder(orderId: string, provider?: string) {
    const baseUrl = this.cfg.get<string>('INTEGRATION_LAB_BASE_URL');
    return this.dispatch('lab', provider, baseUrl, '/orders', { orderId });
  }

  submitInsuranceClaim(claimId: string, provider?: string) {
    const baseUrl = this.cfg.get<string>('INTEGRATION_INSURANCE_BASE_URL');
    return this.dispatch('insurance', provider, baseUrl, '/claims', { claimId });
  }

  lookupPacsStudy(studyUid: string, patientMrn?: string) {
    const baseUrl = this.cfg.get<string>('INTEGRATION_PACS_BASE_URL');
    return this.dispatch('pacs', undefined, baseUrl, '/studies/lookup', { studyUid, patientMrn });
  }

  private async dispatch(
    domain: IntegrationDomain,
    overrideProvider: string | undefined,
    baseUrl: string | undefined,
    path: string,
    payload: Record<string, unknown>,
  ) {
    const selected = (overrideProvider || this.domainProvider(domain)).toLowerCase();
    this.bump(domain, 'calls', undefined, selected);

    if (!baseUrl || selected === 'stub') {
      this.bump(domain, 'success', undefined, selected);
      return {
        queued: true,
        provider: selected,
        externalRequestId: `${domain.toUpperCase()}-${Date.now()}`,
        payload,
        mode: 'stub',
      };
    }

    return this.callExternal(domain, selected, `${baseUrl}${path}`, payload);
  }

  private buildClient(domain: IntegrationDomain, selectedProvider: string): VendorClient {
    if (domain === 'lab') {
      if (selectedProvider === 'acme-lab' || selectedProvider === 'acme') return new LabAcmeClient(this.cfg);
    }
    if (domain === 'insurance') {
      if (selectedProvider === 'nova-insurance' || selectedProvider === 'nova') return new InsuranceNovaClient(this.cfg);
    }
    if (domain === 'pacs') {
      if (selectedProvider === 'orion-pacs' || selectedProvider === 'orion') return new PacsOrionClient(this.cfg);
    }
    throw new ServiceUnavailableException(`Unsupported provider ${selectedProvider} for ${domain}`);
  }

  private getCircuit(provider: string): CircuitState {
    const state = this.circuit.get(provider) ?? { failures: 0 };
    this.circuit.set(provider, state);
    return state;
  }

  private guardCircuit(provider: string) {
    const state = this.getCircuit(provider);
    if (state.openedUntil && Date.now() < state.openedUntil) {
      throw new ServiceUnavailableException(`Integration circuit open for ${provider}`);
    }
  }

  private markSuccess(provider: string) {
    this.circuit.set(provider, { failures: 0 });
  }

  private markFailure(provider: string) {
    const state = this.getCircuit(provider);
    state.failures += 1;
    const threshold = Number(this.cfg.get<string>('INTEGRATION_CB_THRESHOLD') || 3);
    if (state.failures >= threshold) {
      const cooldownMs = Number(this.cfg.get<string>('INTEGRATION_CB_COOLDOWN_MS') || 30000);
      state.openedUntil = Date.now() + cooldownMs;
      state.failures = 0;
    }
    this.circuit.set(provider, state);
  }

  private async callExternal(
    domain: IntegrationDomain,
    selectedProvider: string,
    url: string,
    payload: Record<string, unknown>,
  ) {
    const client = this.buildClient(domain, selectedProvider);
    this.guardCircuit(client.provider);

    const retries = Number(this.cfg.get<string>('INTEGRATION_RETRY_COUNT') || 2);
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const out = await client.call(url, { provider: selectedProvider, payload });
        this.markSuccess(client.provider);
        this.bump(domain, 'success', undefined, selectedProvider);
        return {
          queued: true,
          provider: selectedProvider,
          vendor: client.provider,
          externalResponse: out.raw,
          externalId: out.externalId,
          accepted: out.accepted,
          attempt: attempt + 1,
        };
      } catch (e) {
        lastError = e;
        if (attempt < retries) await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
      }
    }

    this.markFailure(client.provider);
    const err = lastError instanceof Error ? lastError.message : 'unknown';
    this.bump(domain, 'failures', err, selectedProvider);
    throw new ServiceUnavailableException(`Integration call failed for ${domain}: ${err}`);
  }
}
