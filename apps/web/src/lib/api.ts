// ─────────────────────────────────────────────────────────────────────────────
// ForceOrg-40k — Typed API Client
// Centralized fetch wrapper with auth token injection and error handling
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from './supabase';
import type {
  ApiResponse,
  UserArmy,
  Datasheet,
  Stratagem,
  AuditResult,
  UserUnitMedia,
} from '@forceorg/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

// ── Core Fetch ──────────────────────────────────────────────────────────────

class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function getAuthToken(): Promise<string | null> {
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const body: ApiResponse<T> = await response.json();

  if (!response.ok || !body.success) {
    throw new ApiError(
      body.error?.code || 'UNKNOWN',
      body.error?.message || 'An unexpected error occurred.',
      response.status,
    );
  }

  return body.data as T;
}

// ── Local Storage State & Persistence Layer ──────────────────────────────────

const DEFAULT_STARTER_ARMY: UserArmy = {
  id: 'starter-ultramarines-roster',
  userId: 'local-commander',
  name: 'Ultramarines 1st Company Veteran Force',
  factionId: 'adeptus_astartes',
  rulesetVersionId: '11.1.0-2026-Q3',
  detachmentPrimary: '1st Company Task Force',
  detachmentSecondary: null,
  pointsLimit: 2000,
  detachmentPointsLimit: 3,
  factionThemeOverride: 'ultramarines',
  rosterPayload: {
    units: [
      {
        instanceId: 'inst_term_cap',
        datasheetId: 'ds-captain-terminator',
        datasheetName: 'Captain in Terminator Armour',
        modelCount: 1,
        wargearSelections: [],
        pointsCost: 95,
      },
      {
        instanceId: 'inst_term_sq',
        datasheetId: 'ds-terminator-squad',
        datasheetName: 'Terminator Squad',
        modelCount: 5,
        wargearSelections: [],
        pointsCost: 185,
      },
      {
        instanceId: 'inst_intercessors',
        datasheetId: 'ds-intercessor-squad',
        datasheetName: 'Intercessor Squad',
        modelCount: 5,
        wargearSelections: [],
        pointsCost: 75,
      },
    ],
    totalPoints: 355,
    detachmentPointsUsed: 0,
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function getLocalUserId(): string {
  if (typeof window === 'undefined') return 'commander';
  try {
    const raw = localStorage.getItem('forceorg_local_user');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.id) return parsed.id;
    }
  } catch {}
  return 'commander';
}

function getStoredRosters(userId: string): UserArmy[] {
  if (typeof window === 'undefined') return [DEFAULT_STARTER_ARMY];
  try {
    const raw = localStorage.getItem(`forceorg_rosters_${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [DEFAULT_STARTER_ARMY];
}

function saveStoredRosters(userId: string, rosters: UserArmy[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`forceorg_rosters_${userId}`, JSON.stringify(rosters));
  } catch {}
}

// ── Datasheets ──────────────────────────────────────────────────────────────

export async function fetchDatasheets(
  factionId?: string,
  role?: string,
): Promise<Datasheet[]> {
  const params = new URLSearchParams();
  if (factionId) params.set('factionId', factionId);
  if (role) params.set('role', role);
  const qStr = params.toString();
  try {
    return await apiFetch<Datasheet[]>(`/datasheets${qStr ? `?${qStr}` : ''}`);
  } catch {
    // Offline catalog fallback
    return [
      {
        id: 'ds-captain-terminator',
        factionId: factionId || 'adeptus_astartes',
        name: 'Captain in Terminator Armour',
        battlefieldRole: 'CHARACTER',
        basePoints: 95,
        detachmentPointsCost: 0,
        unitComposition: { models: [{ name: 'Captain in Terminator Armour', count: 1, baseSize: '40mm' }] },
        stats: { movement: '5"', toughness: 5, save: '2+', invulnerableSave: '4+', leadership: '6+', objectiveControl: 1 },
        keywords: ['INFANTRY', 'CHARACTER', 'EPIC HERO', 'IMPERIUM', 'TERMINATOR', 'CAPTAIN'],
        isAlliedEligible: false,
        canonicalImageUrl: '/assets/models/default_placeholder.webp',
        canonicalThumbUrl: '/assets/models/default_placeholder.webp',
      },
      {
        id: 'ds-terminator-squad',
        factionId: factionId || 'adeptus_astartes',
        name: 'Terminator Squad',
        battlefieldRole: 'INFANTRY',
        basePoints: 185,
        detachmentPointsCost: 0,
        unitComposition: { models: [{ name: 'Terminator Sergeant', count: 1, baseSize: '40mm' }, { name: 'Terminator', count: 4, baseSize: '40mm' }] },
        stats: { movement: '5"', toughness: 5, save: '2+', invulnerableSave: '4+', leadership: '6+', objectiveControl: 1 },
        keywords: ['INFANTRY', 'IMPERIUM', 'TERMINATOR'],
        isAlliedEligible: false,
        canonicalImageUrl: '/assets/models/default_placeholder.webp',
        canonicalThumbUrl: '/assets/models/default_placeholder.webp',
      },
      {
        id: 'ds-intercessor-squad',
        factionId: factionId || 'adeptus_astartes',
        name: 'Intercessor Squad',
        battlefieldRole: 'BATTLELINE',
        basePoints: 75,
        detachmentPointsCost: 0,
        unitComposition: { models: [{ name: 'Intercessor Sergeant', count: 1, baseSize: '32mm' }, { name: 'Intercessor', count: 4, baseSize: '32mm' }] },
        stats: { movement: '6"', toughness: 4, save: '3+', leadership: '6+', objectiveControl: 2 },
        keywords: ['INFANTRY', 'BATTLELINE', 'IMPERIUM', 'TACTICUS'],
        isAlliedEligible: false,
        canonicalImageUrl: '/assets/models/default_placeholder.webp',
        canonicalThumbUrl: '/assets/models/default_placeholder.webp',
      },
    ];
  }
}

export async function fetchDatasheet(id: string): Promise<Datasheet> {
  try {
    return await apiFetch<Datasheet>(`/datasheets/${id}`);
  } catch {
    const list = await fetchDatasheets();
    return list.find(d => d.id === id) || list[0]!;
  }
}

// ── Stratagems ──────────────────────────────────────────────────────────────

export async function fetchStratagems(params?: {
  phase?: string;
  category?: string;
  detachmentId?: string;
}): Promise<Stratagem[]> {
  const query = new URLSearchParams();
  if (params?.phase && params.phase !== 'ANY') query.set('phase', params.phase);
  if (params?.category) query.set('category', params.category);
  if (params?.detachmentId) query.set('detachmentId', params.detachmentId);
  const qStr = query.toString();
  try {
    return await apiFetch<Stratagem[]>(`/stratagems${qStr ? `?${qStr}` : ''}`);
  } catch {
    return [];
  }
}

// ── Rosters ─────────────────────────────────────────────────────────────────

export async function fetchRosters(): Promise<UserArmy[]> {
  const userId = getLocalUserId();
  try {
    const remote = await apiFetch<UserArmy[]>('/rosters');
    if (Array.isArray(remote) && remote.length > 0) {
      saveStoredRosters(userId, remote);
      return remote;
    }
  } catch {
    // API offline, unconfigured, or using local/guest mode
  }
  return getStoredRosters(userId);
}

export async function fetchRoster(id: string): Promise<UserArmy> {
  const userId = getLocalUserId();
  try {
    const remote = await apiFetch<UserArmy>(`/rosters/${id}`);
    if (remote) {
      const rosters = getStoredRosters(userId);
      const idx = rosters.findIndex(r => r.id === id);
      if (idx >= 0) rosters[idx] = remote;
      else rosters.push(remote);
      saveStoredRosters(userId, rosters);
      return remote;
    }
  } catch {
    // Fallback to local storage
  }

  const rosters = getStoredRosters(userId);
  const found = rosters.find(r => r.id === id);
  if (found) return found;

  const fallback: UserArmy = {
    ...DEFAULT_STARTER_ARMY,
    id,
    userId,
  };
  return fallback;
}

export async function createRoster(data: {
  name: string;
  factionId: string;
  detachmentPrimary: string;
  detachmentSecondary?: string;
  pointsLimit?: number;
  detachmentPointsLimit?: number;
  factionThemeOverride?: string;
}): Promise<UserArmy> {
  const userId = getLocalUserId();
  let created: UserArmy | null = null;

  try {
    created = await apiFetch<UserArmy>('/rosters', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  } catch {
    // API offline; synthesize local army
    created = {
      id: `army_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      userId,
      name: data.name,
      factionId: data.factionId,
      rulesetVersionId: '11.1.0-2026-Q3',
      detachmentPrimary: data.detachmentPrimary,
      detachmentSecondary: data.detachmentSecondary || null,
      pointsLimit: data.pointsLimit || 2000,
      detachmentPointsLimit: data.detachmentPointsLimit || 3,
      factionThemeOverride: data.factionThemeOverride || null,
      rosterPayload: { units: [], totalPoints: 0, detachmentPointsUsed: 0 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  const rosters = getStoredRosters(userId);
  rosters.unshift(created);
  saveStoredRosters(userId, rosters);
  return created;
}

export async function updateRoster(
  id: string,
  data: Partial<{
    name: string;
    detachmentPrimary: string;
    detachmentSecondary: string | null;
    pointsLimit: number;
    factionThemeOverride: string | null;
    rosterPayload: unknown;
  }>,
): Promise<UserArmy> {
  const userId = getLocalUserId();
  const rosters = getStoredRosters(userId);
  const existing = rosters.find(r => r.id === id);

  const updated: UserArmy = {
    ...(existing || DEFAULT_STARTER_ARMY),
    id,
    userId,
    name: data.name !== undefined ? data.name : (existing?.name || 'Untitled Force'),
    detachmentPrimary: data.detachmentPrimary !== undefined ? data.detachmentPrimary : (existing?.detachmentPrimary || 'Standard Detachment'),
    detachmentSecondary: data.detachmentSecondary !== undefined ? data.detachmentSecondary : (existing?.detachmentSecondary || null),
    pointsLimit: data.pointsLimit !== undefined ? data.pointsLimit : (existing?.pointsLimit || 2000),
    factionThemeOverride: data.factionThemeOverride !== undefined ? data.factionThemeOverride : (existing?.factionThemeOverride || null),
    rosterPayload: ((data.rosterPayload !== undefined ? data.rosterPayload : existing?.rosterPayload) || { units: [], totalPoints: 0, detachmentPointsUsed: 0 }) as any,
    updatedAt: new Date().toISOString(),
  };

  const idx = rosters.findIndex(r => r.id === id);
  if (idx >= 0) rosters[idx] = updated;
  else rosters.unshift(updated);
  saveStoredRosters(userId, rosters);

  try {
    await apiFetch<UserArmy>(`/rosters/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  } catch {
    // API offline; local storage already updated
  }

  return updated;
}

export async function deleteRoster(id: string): Promise<{ deleted: boolean }> {
  const userId = getLocalUserId();
  const rosters = getStoredRosters(userId).filter(r => r.id !== id);
  saveStoredRosters(userId, rosters);

  try {
    await apiFetch<{ deleted: boolean }>(`/rosters/${id}`, {
      method: 'DELETE',
    });
  } catch {
    // API offline; local storage already deleted
  }

  return { deleted: true };
}

// ── Audit ───────────────────────────────────────────────────────────────────

export async function auditRoster(id: string): Promise<AuditResult> {
  try {
    return await apiFetch<AuditResult>(`/rosters/${id}/audit`, {
      method: 'POST',
    });
  } catch {
    const army = await fetchRoster(id);
    const payload = (army.rosterPayload as any) || {};
    const totalPoints = payload.totalPoints || 0;
    const isCompliant = totalPoints <= army.pointsLimit;

    return {
      rosterId: id,
      rulesetVersionCompared: army.rulesetVersionId || '11.1.0-2026-Q3',
      isCompliant,
      auditedAt: new Date().toISOString(),
      discrepancies: totalPoints > army.pointsLimit ? [
        {
          unitInstanceId: 'army-total',
          unitName: army.name,
          severity: 'RED',
          category: 'POINTS_SHIFT',
          message: `Roster exceeds points limit (${totalPoints} / ${army.pointsLimit} pts).`,
          oldValue: `${army.pointsLimit} pts`,
          newValue: `${totalPoints} pts`,
        },
      ] : [],
    };
  }
}

export interface RulesChangeItem {
  id: string;
  category: 'POINTS_CUT' | 'POINTS_HIKE' | 'KEYWORD_UPDATE' | 'NEW_DATASHEET' | 'ERRATA';
  factionId: string;
  factionName: string;
  targetName: string;
  previousValue?: string;
  currentValue: string;
  effectiveDate: string;
  summary: string;
}

export interface ChangelogData {
  currentRulesetVersion: string;
  lastSyncedAt: string;
  syncStatus: 'SYNCHRONIZED' | 'PENDING' | 'OFFLINE';
  totalChanges: number;
  recentChanges: RulesChangeItem[];
  syncRecords: Array<{
    endpoint: string;
    status: string;
    recordCount: number;
    syncedAt: string;
  }>;
}

// ── Media ───────────────────────────────────────────────────────────────────

export async function uploadMiniaturePhoto(
  rosterId: string,
  unitInstanceId: string,
  file: File,
): Promise<UserUnitMedia> {
  const token = await getAuthToken();
  const formData = new FormData();
  formData.append('miniature_photo', file);
  formData.append('image', file);
  formData.append('rosterId', rosterId);
  formData.append('unitInstanceId', unitInstanceId);

  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}/rosters/${rosterId}/units/${unitInstanceId}/media`, {
    method: 'POST',
    headers,
    body: formData,
  });

  const body: ApiResponse<UserUnitMedia | { media: UserUnitMedia }> = await response.json();
  if (!response.ok || !body.success) {
    throw new ApiError(
      body.error?.code || 'UPLOAD_FAILED',
      body.error?.message || 'Failed to upload miniature photo.',
      response.status,
    );
  }

  const rawData = body.data;
  return (rawData && 'media' in rawData ? (rawData as any).media : rawData) as UserUnitMedia;
}

export async function deleteMiniaturePhoto(
  rosterId: string,
  unitInstanceId: string,
): Promise<void> {
  await apiFetch<void>(`/rosters/${rosterId}/units/${unitInstanceId}/media`, { method: 'DELETE' });
}

// ── Changelog & Rules Sync ──────────────────────────────────────────────────

export async function fetchChangelog(): Promise<ChangelogData> {
  return apiFetch<ChangelogData>('/changelog');
}

// ── Health ──────────────────────────────────────────────────────────────────

export async function checkHealth(): Promise<{
  status: string;
  version: string;
  timestamp: string;
}> {
  return apiFetch('/health');
}

// ── Export Error Class ──────────────────────────────────────────────────────

export { ApiError };
