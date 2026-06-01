export const DEFAULT_SECURITY = {
  sessionTimeoutMinutes: 30,
  maxLoginAttempts: 5,
  passwordMinLength: 8,
  enforce2faAdmin: false,
  /** When true, all staff roles (non-patient) must use TOTP at login. */
  enforce2faStaff: false,
  auditLog: true,
  ipWhitelist: false,
  /** When ipWhitelist is true, only these client IPs may call non-@Public routes (IPv4 exact, `10.*` wildcard, or CIDR). Empty = allow all (avoid lockout). */
  allowedIps: [] as string[],
};

export const HOSPITAL_SETTINGS_DEFAULTS = {
  general: {
    hospitalName: 'City General Hospital',
    registrationNo: 'REG-2024-001234',
    contactPhone: '+91 80 1234 5678',
    email: 'info@cityhospital.com',
    gstin: '29ABCDE1234F1Z5',
    website: 'www.cityhospital.com',
    address: '123, Hospital Road, Bengaluru – 560001, Karnataka, India',
  },
  branding: {
    primaryColor: '#2563EB',
    secondaryColor: '#E0F2FE',
    logoUrl: '',
    faviconUrl: '',
    appTitle: '',
  },
  notifications: {
    appointmentReminders: true,
    labReportReady: true,
    lowStockAlerts: true,
    billingReminders: false,
    systemAlerts: true,
  },
  security: { ...DEFAULT_SECURITY },
};

export type HospitalSettingsPayload = {
  general: Record<string, string>;
  branding: Record<string, string>;
  notifications: Record<string, boolean>;
  security: {
    sessionTimeoutMinutes: number;
    maxLoginAttempts: number;
    passwordMinLength: number;
    enforce2faAdmin: boolean;
    enforce2faStaff: boolean;
    auditLog: boolean;
    ipWhitelist: boolean;
    allowedIps: string[];
  };
};

function asInt(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : fallback;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return (v as unknown[])
    .filter((x): x is string => typeof x === 'string')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function normalizeHospitalSettings(raw: unknown): HospitalSettingsPayload {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
  const g = { ...HOSPITAL_SETTINGS_DEFAULTS.general, ...(r.general ?? {}) } as Record<string, string>;
  const b = { ...HOSPITAL_SETTINGS_DEFAULTS.branding, ...(r.branding ?? {}) } as Record<string, string>;
  for (const k of ['logoUrl', 'faviconUrl', 'appTitle'] as const) {
    if (typeof b[k] !== 'string') b[k] = HOSPITAL_SETTINGS_DEFAULTS.branding[k] ?? '';
  }
  const n = { ...HOSPITAL_SETTINGS_DEFAULTS.notifications, ...(r.notifications ?? {}) } as Record<string, boolean>;
  const rs = (r.security ?? {}) as Record<string, unknown>;
  const ds = DEFAULT_SECURITY;
  const mergedIps = asStringArray(rs.allowedIps);
  const security = {
    sessionTimeoutMinutes: asInt(rs.sessionTimeoutMinutes, ds.sessionTimeoutMinutes),
    maxLoginAttempts: asInt(rs.maxLoginAttempts, ds.maxLoginAttempts),
    passwordMinLength: asInt(rs.passwordMinLength, ds.passwordMinLength),
    enforce2faAdmin: Boolean(rs.enforce2faAdmin ?? ds.enforce2faAdmin),
    enforce2faStaff: Boolean(rs.enforce2faStaff ?? ds.enforce2faStaff),
    auditLog: Boolean(rs.auditLog ?? ds.auditLog),
    ipWhitelist: Boolean(rs.ipWhitelist ?? ds.ipWhitelist),
    allowedIps: mergedIps.length ? mergedIps : [...ds.allowedIps],
  };
  return { general: g, branding: b, notifications: n, security };
}
