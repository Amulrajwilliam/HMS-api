export type IntegrationDomain = 'lab' | 'insurance' | 'pacs';

export type VendorRequest = {
  provider: string;
  payload: Record<string, unknown>;
};

export type VendorResponse = {
  accepted: boolean;
  externalId?: string;
  raw: unknown;
};

export interface VendorClient {
  readonly provider: string;
  call(url: string, req: VendorRequest): Promise<VendorResponse>;
}
