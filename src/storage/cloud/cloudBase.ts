import { directusClient } from '../../api/directus';
import { LocalOfflineAdapter } from '../localAdapter';
import { StorageSyncManager } from '../syncManager';
import { normalizeId } from '../../utils/formatters';
import { mediaManager } from '../../utils/mediaManager';

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function cleanUuid(val: any): string | null {
  if (typeof val === 'string' && UUID_REGEX.test(val.trim())) {
    return val.trim();
  }
  return null;
}

export function cleanInt(val: any): number | null {
  if (val === undefined || val === null || val === '') return null;
  const num = Number(val);
  if (isNaN(num) || num <= 0) return null;
  return Math.floor(num);
}

export class CloudStorageBase {
  public localAdapter: LocalOfflineAdapter;

  constructor(localAdapter?: LocalOfflineAdapter) {
    this.localAdapter = localAdapter || new LocalOfflineAdapter();
  }

  get client() {
    return directusClient;
  }

  get syncManager() {
    return StorageSyncManager;
  }

  get media() {
    return mediaManager;
  }

  cleanUuid(val: any): string | null {
    return cleanUuid(val);
  }

  cleanInt(val: any): number | null {
    return cleanInt(val);
  }

  normalizeId(val: any): number {
    return normalizeId(val) || Number(val);
  }
}
