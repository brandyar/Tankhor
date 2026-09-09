/**
 * TANKHOR (تن‌خور) - Cryptographic Licensing & Machine Fingerprint Engine
 * Provides offline cryptographic signature verification, machine binding,
 * and module entitlement validation for hybrid desktop (Tauri) and web environments.
 */

import { OrganizationModule, SystemModule } from '../types';
import { toPersianDigits } from './formatters';

// Secret verification salt for Tankhor module license signatures
// In enterprise deployment, this mirrors server-side Directus private signing key
const LICENSE_SIGN_SALT = 'TANKHOR_ENTITLEMENT_SECURE_SALT_v1_2026';

export interface LicensePayload {
  organization_id: number;
  slug: string;
  license_type: 'lifetime' | 'subscription' | 'pro_bundle';
  hardware_id?: string | null;
  issued_at: string;
  expires_at?: string | null;
}

export interface LicenseToken {
  payload: LicensePayload;
  signature: string;
}

/**
 * Computes SHA-256 hash using Web Crypto API
 */
export async function sha256(message: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback simple hash if subtle crypto is not available
  let hash = 0;
  for (let i = 0; i < message.length; i++) {
    const char = message.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(64, '0');
}

/**
 * Gets or computes a persistent machine fingerprint for desktop/browser
 */
export function getMachineFingerprint(): string {
  if (typeof window === 'undefined') return 'TANKHOR_SERVER_ENV';

  let storedId = localStorage.getItem('tankhor_hardware_id');
  if (storedId && storedId.length >= 16) {
    return storedId;
  }

  // Derive stable fingerprint from browser/device characteristics
  const nav = window.navigator;
  const screen = window.screen;
  const rawParts = [
    nav.userAgent || '',
    nav.language || '',
    screen.colorDepth || '',
    screen.width || '',
    screen.height || '',
    nav.hardwareConcurrency || '',
    (nav as any).deviceMemory || '',
  ].join('###');

  // Simple synchronous hash for immediate seed
  let hash1 = 5381;
  let hash2 = 52711;
  for (let i = 0; i < rawParts.length; i++) {
    const char = rawParts.charCodeAt(i);
    hash1 = (hash1 * 33) ^ char;
    hash2 = (hash2 * 33) ^ char;
  }
  const hex1 = (hash1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (hash2 >>> 0).toString(16).padStart(8, '0');
  const randomSuffix = Math.random().toString(16).substring(2, 10);
  
  storedId = `HW-${hex1}-${hex2}-${randomSuffix}`.toUpperCase();
  try {
    localStorage.setItem('tankhor_hardware_id', storedId);
  } catch {}

  return storedId;
}

/**
 * Computes signature for a given payload
 */
export async function computeLicenseSignature(payload: LicensePayload): Promise<string> {
  const serialized = [
    payload.organization_id,
    payload.slug,
    payload.license_type,
    payload.hardware_id || 'ANY',
    payload.issued_at,
    payload.expires_at || 'NEVER',
    LICENSE_SIGN_SALT,
  ].join('|');

  return await sha256(serialized);
}

/**
 * Generates an exportable signed license token string.
 * Uses a compact format (TK1_...) to strictly adhere to database column length limits (< 150 chars).
 */
export async function generateLicenseTokenString(payload: LicensePayload): Promise<string> {
  const issuedSec = Math.floor(new Date(payload.issued_at).getTime() / 1000);
  const normalizedIssuedAt = new Date(issuedSec * 1000).toISOString();
  const hwid = payload.hardware_id ? String(payload.hardware_id).trim() : 'ANY';
  const expiresSec = payload.expires_at ? Math.floor(new Date(payload.expires_at).getTime() / 1000) : 'NEVER';
  const normalizedExpiresAt = expiresSec === 'NEVER' ? null : new Date(Number(expiresSec) * 1000).toISOString();

  const normalizedPayload: LicensePayload = {
    ...payload,
    issued_at: normalizedIssuedAt,
    expires_at: normalizedExpiresAt,
  };

  const signature = await computeLicenseSignature(normalizedPayload);

  return `TK1_${normalizedPayload.organization_id}_${normalizedPayload.slug}_${normalizedPayload.license_type}_${hwid}_${issuedSec}_${expiresSec}_${signature}`;
}

/**
 * Decodes and verifies a license token string (supports compact TK1_ and legacy formats)
 */
export async function verifyLicenseTokenString(
  tokenStr: string,
  expectedOrgId?: number,
  expectedHardwareId?: string
): Promise<{ valid: boolean; payload?: LicensePayload; error?: string }> {
  try {
    const trimmed = tokenStr.trim();
    let payload: LicensePayload;
    let signature: string;

    if (trimmed.startsWith('TK1_')) {
      const parts = trimmed.split('_');
      if (parts.length < 8) {
        return { valid: false, error: 'INVALID_TOKEN_FORMAT' };
      }
      const orgId = Number(parts[1]);
      const slug = parts[2];
      const license_type = parts[3] as any;
      const hwid = parts[4] === 'ANY' ? null : parts[4];
      const issuedSec = Number(parts[5]);
      const expiresSec = parts[6];
      signature = parts[7];

      payload = {
        organization_id: orgId,
        slug,
        license_type,
        hardware_id: hwid,
        issued_at: new Date(issuedSec * 1000).toISOString(),
        expires_at: expiresSec === 'NEVER' ? null : new Date(Number(expiresSec) * 1000).toISOString(),
      };
    } else {
      // Legacy base64/JSON format
      let rawJson: string;
      try {
        rawJson = decodeURIComponent(atob(trimmed));
      } catch {
        rawJson = Buffer.from(trimmed, 'base64').toString('utf-8');
      }
      const tokenObj: LicenseToken = JSON.parse(rawJson);

      if (!tokenObj || !tokenObj.payload || !tokenObj.signature) {
        return { valid: false, error: 'INVALID_FORMAT' };
      }
      payload = tokenObj.payload;
      signature = tokenObj.signature;
    }

    // 1. Verify cryptographic signature
    const expectedSig = await computeLicenseSignature(payload);
    if (expectedSig !== signature) {
      return { valid: false, error: 'SIGNATURE_MISMATCH' };
    }

    // 2. Verify organization match if expectedOrgId provided
    if (expectedOrgId && payload.organization_id !== expectedOrgId) {
      return { valid: false, error: 'ORGANIZATION_MISMATCH' };
    }

    // 3. Verify hardware binding if bound
    if (payload.hardware_id && payload.hardware_id !== 'ANY') {
      const currentHw = expectedHardwareId || getMachineFingerprint();
      if (payload.hardware_id.toUpperCase() !== currentHw.toUpperCase()) {
        return { valid: false, error: 'HARDWARE_MISMATCH' };
      }
    }

    // 4. Verify expiry date if time-limited
    if (payload.expires_at && payload.expires_at !== 'NEVER') {
      const expiry = new Date(payload.expires_at).getTime();
      if (Date.now() > expiry) {
        return { valid: false, error: 'LICENSE_EXPIRED' };
      }
    }

    return { valid: true, payload };
  } catch (err: any) {
    return { valid: false, error: err.message || 'DECODE_ERROR' };
  }
}

/**
 * Checks if an organization module has valid active entitlement
 */
export async function isModuleLicenseActive(
  module: OrganizationModule,
  expectedOrgId?: number
): Promise<boolean> {
  if (!module || module.status !== 'active') return false;

  // If expiry date passed
  if (module.expires_at) {
    const expiry = new Date(module.expires_at).getTime();
    if (Date.now() > expiry) return false;
  }

  // If license token is present, cryptographically verify it
  if (module.license_token) {
    const res = await verifyLicenseTokenString(module.license_token, expectedOrgId);
    return res.valid;
  }

  // If created via cloud directus admin without raw token, verify status
  return module.status === 'active';
}

/**
 * Formats a module price based on active locale (Persian Tomans or English USD)
 * - Persian locale: uses price_ir (in Tomans) formatted with Persian commas and digits, e.g. "۴۹۰,۰۰۰ تومان"
 * - English locale: uses price_usd (in USD) formatted with dollar sign, e.g. "$19"
 */
export function formatModulePrice(
  module?: { price_ir?: string | number | null; price_usd?: string | number | null } | null,
  locale: string = 'fa'
): string {
  if (!module) return '';

  const isEn = locale === 'en';

  if (isEn) {
    if (module.price_usd !== undefined && module.price_usd !== null && String(module.price_usd).trim() !== '') {
      const clean = String(module.price_usd).trim();
      if (clean.startsWith('$') || clean.toLowerCase().includes('usd')) {
        return clean;
      }
      const num = Number(clean.replace(/[^0-9.]/g, ''));
      if (!isNaN(num) && num > 0) {
        return `$${num.toLocaleString('en-US')}`;
      }
      return `$${clean}`;
    }
    if (module.price_ir) {
      const num = Number(String(module.price_ir).replace(/[^0-9]/g, ''));
      if (!isNaN(num) && num > 0) {
        return `${num.toLocaleString('en-US')} Tomans`;
      }
    }
    return 'Contact Support';
  }

  // Persian (fa) locale:
  if (module.price_ir !== undefined && module.price_ir !== null && String(module.price_ir).trim() !== '') {
    const clean = String(module.price_ir).trim();
    if (clean.includes('تومان')) {
      return clean;
    }
    const num = Number(clean.replace(/[^0-9]/g, ''));
    if (!isNaN(num) && num > 0) {
      return `${toPersianDigits(num.toLocaleString('fa-IR'))} تومان`;
    }
    return `${toPersianDigits(clean)} تومان`;
  }

  // Fallback to USD price in Persian if price_ir is not set
  if (module.price_usd) {
    const clean = String(module.price_usd).trim().replace(/^\$/, '');
    return `${toPersianDigits(clean)} دلار`;
  }

  return 'تماس با پشتیبانی';
}

/**
 * Fallback baseline catalog of modules (derived from real database records)
 */
export const DEFAULT_SYSTEM_MODULES: SystemModule[] = [
  {
    id: 1,
    name: 'تولید و چاپ بارکد',
    slug: 'barcode',
    description: 'طراحی برچسب با اندازه‌های سفارشی، پشتیبانی از پرینترهای حرارتی، چاپ دسته‌ای و بارکدهای بین‌المللی EAN-13 و CODE-128',
    icon: 'barcode',
    price_ir: '490000',
    price_usd: '19',
    is_standalone_purchasable: true,
    included_in_pro: false,
    status: 'published',
  },
];
