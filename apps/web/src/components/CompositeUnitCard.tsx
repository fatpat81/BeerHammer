// ─────────────────────────────────────────────────────────────────────────────
// ForceOrg-40k — Composite Unit Card Component (§11)
// Full production component with wound tracking, lightbox, and haptics
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState, useCallback, useRef } from 'react';
import { ChapterIcon } from '@forceorg/ui-theme';
import type { ChapterKey } from '@forceorg/ui-theme';
import styles from './CompositeUnitCard.module.css';
import { PhotoUploadModal } from './PhotoUploadModal';

export interface WeaponProfile {
  id: string;
  name: string;
  range: string;
  attacks: string;
  skill: string;
  strength: number;
  armorPenetration: number;
  damage: string;
  firingMode?: string;
  keywords: string[];
}

export interface UnitAbility {
  id: string;
  name: string;
  source: 'Bodyguard' | 'Leader' | 'Enhancement' | 'Detachment';
  phase?: string;
  description: string;
}

export interface ModelHealth {
  id: string;
  modelName: string;
  isLeader: boolean;
  maxWounds: number;
  currentWounds: number;
}

export interface CompositeUnitProps {
  rosterId: string;
  unitInstanceId: string;
  bodyguardName: string;
  leaderName?: string;
  chapterKey?: string;
  stats: {
    movement: string;
    bodyguardToughness: number;
    armorSave: string;
    invulnerableSave?: string;
    leadership: string;
    objectiveControl: number;
  };
  keywords: string[];
  initialModels: ModelHealth[];
  weapons: WeaponProfile[];
  abilities: UnitAbility[];
  canonicalImageUrl: string;
  customImageUrl?: string | null;
  availableStratagemsCount?: number;
  onOpenStratagems?: (unitId: string) => void;
  onModelWoundChange?: (modelId: string, nextWounds: number) => void;
  onCustomPhotoChange?: (newUrl: string | null) => void;
}

export const CompositeUnitCard: React.FC<CompositeUnitProps> = ({
  rosterId,
  unitInstanceId,
  bodyguardName,
  leaderName,
  chapterKey = 'ultramarines',
  stats,
  keywords,
  initialModels,
  weapons,
  abilities,
  canonicalImageUrl,
  customImageUrl: initialCustomImage,
  availableStratagemsCount = 6,
  onOpenStratagems,
  onModelWoundChange,
  onCustomPhotoChange,
}) => {
  const [models, setModels] = useState<ModelHealth[]>(initialModels);
  const [customImage, setCustomImage] = useState<string | null>(initialCustomImage || null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeDisplayImage = customImage || canonicalImageUrl;

  const triggerHaptic = useCallback((type: 'tick' | 'death') => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(type === 'tick' ? 12 : [25, 40, 25]);
    }
  }, []);

  const handleWoundDelta = (modelId: string, delta: number) => {
    setModels(prev =>
      prev.map(model => {
        if (model.id !== modelId) return model;
        const next = Math.max(0, Math.min(model.maxWounds, model.currentWounds + delta));
        if (next === 0 && model.currentWounds > 0) triggerHaptic('death');
        else if (next !== model.currentWounds) triggerHaptic('tick');
        onModelWoundChange?.(modelId, next);
        return { ...model, currentWounds: next };
      })
    );
  };

  const handleCustomPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append('miniature_photo', file);
    try {
      const res = await fetch(`/api/rosters/${rosterId}/units/${unitInstanceId}/media`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setCustomImage(data.data?.media?.imageUrl || data.media?.imageUrl);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleRevertToDefault = async () => {
    const res = await fetch(`/api/rosters/${rosterId}/units/${unitInstanceId}/media`, {
      method: 'DELETE',
    });
    if (res.ok) setCustomImage(null);
  };

  return (
    <div className={styles.container}>
      <article className={styles.card}>
        {/* Chapter Watermark */}
        <ChapterIcon
          chapter={chapterKey as ChapterKey}
          size="100%"
          isWatermark
          color="var(--c-trim, #c89d3c)"
        />

        <div className={styles.cardContent}>
          {/* ── Header ──────────────────────────────────────────────────── */}
          <header className={styles.header}>
            <div className={styles.identityBlock}>
              <div className={styles.avatarCluster}>
                <button
                  type="button"
                  className={styles.avatarFrame}
                  onClick={() => setIsLightboxOpen(true)}
                  title="View / change painted miniature photo"
                  style={{ position: 'relative' }}
                >
                  {activeDisplayImage ? (
                    <img
                      src={activeDisplayImage}
                      alt={bodyguardName}
                      className={styles.avatarImage}
                      onError={() => setCustomImage(null)}
                    />
                  ) : (
                    <div className={styles.avatarPlaceholder}>
                      <ChapterIcon chapterKey={chapterKey} size={32} color="var(--c-trim)" />
                    </div>
                  )}
                  <span className={styles.avatarCameraBadge} title="Miniature photo">📷</span>
                </button>
              </div>
              <div>
                {leaderName && (
                  <div className={styles.leaderTag}>
                    <span className={styles.leaderIcon}>⚔</span> Attached: {leaderName}
                  </div>
                )}
                <h2 className={styles.unitName}>{bodyguardName}</h2>
              </div>
            </div>

            <div className={styles.statBlock}>
              <div className={styles.statPip}>
                <span className={styles.statLabel}>M</span>
                <strong className={styles.statValue}>{stats.movement}</strong>
              </div>
              <div className={`${styles.statPip} ${styles.statPipGlow}`}>
                <span className={styles.statLabel}>T</span>
                <strong className={styles.statValue}>{stats.bodyguardToughness}</strong>
              </div>
              <div className={styles.statPip}>
                <span className={styles.statLabel}>Sv</span>
                <strong className={styles.statValue}>{stats.armorSave}</strong>
              </div>
              {stats.invulnerableSave && (
                <div className={`${styles.statPip} ${styles.statPipInvuln}`}>
                  <span className={styles.statLabel}>Inv</span>
                  <strong className={styles.statValue}>{stats.invulnerableSave}</strong>
                </div>
              )}
              <div className={styles.statPip}>
                <span className={styles.statLabel}>OC</span>
                <strong className={styles.statValue}>{stats.objectiveControl}</strong>
              </div>
            </div>
          </header>

          {/* ── Wound Allocation Matrix ──────────────────────────────────── */}
          <section className={styles.woundMatrix}>
            <div className={styles.woundTitle}>Wound Allocation Matrix</div>
            <div className={styles.woundGrid}>
              {models.map(model => {
                const isDead = model.currentWounds === 0;
                const woundPercent = model.maxWounds > 0 ? (model.currentWounds / model.maxWounds) * 100 : 0;
                return (
                  <div
                    key={model.id}
                    className={`${styles.modelRow} ${model.isLeader ? styles.modelRowLeader : ''} ${isDead ? styles.modelRowDead : ''}`}
                  >
                    <div>
                      <div className={styles.modelName}>
                        {model.isLeader ? `★ ${model.modelName}` : model.modelName}
                      </div>
                      <div className={styles.modelStatus}>
                        {isDead ? 'DESTROYED' : `${model.currentWounds} / ${model.maxWounds} W`}
                      </div>
                      {!isDead && (
                        <div className={styles.woundBar}>
                          <div
                            className={styles.woundBarFill}
                            style={{
                              width: `${woundPercent}%`,
                              background: woundPercent > 50 ? 'var(--c-glow)' : woundPercent > 25 ? '#F59E0B' : '#EF4444',
                            }}
                          />
                        </div>
                      )}
                    </div>
                    <div className={styles.woundControls}>
                      <button
                        type="button"
                        className={styles.btnWound}
                        disabled={isDead}
                        onClick={() => handleWoundDelta(model.id, -1)}
                      >
                        −
                      </button>
                      <button
                        type="button"
                        className={styles.btnWound}
                        disabled={model.currentWounds === model.maxWounds}
                        onClick={() => handleWoundDelta(model.id, 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── Weapons & Abilities ──────────────────────────────────────── */}
          <div className={styles.cardCore}>
            <section className={styles.weaponSection}>
              <div className={styles.weaponTableWrapper}>
                <table className={styles.weaponTable}>
                  <thead>
                    <tr>
                      <th>Weapon</th>
                      <th>Rng</th>
                      <th>A</th>
                      <th>BS/WS</th>
                      <th>S</th>
                      <th>AP</th>
                      <th>D</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weapons.map(w => (
                      <tr key={w.id}>
                        <td>
                          <strong>{w.name}</strong>
                          {w.firingMode && (
                            <span className={styles.firingModeBadge}>{w.firingMode}</span>
                          )}
                          {w.keywords.length > 0 && (
                            <div className={styles.weaponKeywords}>{w.keywords.join(', ')}</div>
                          )}
                        </td>
                        <td>{w.range}</td>
                        <td>{w.attacks}</td>
                        <td>{w.skill}</td>
                        <td>{w.strength}</td>
                        <td>{w.armorPenetration === 0 ? '0' : `-${w.armorPenetration}`}</td>
                        <td>{w.damage}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className={styles.abilitySection}>
              {abilities.map(a => (
                <div
                  key={a.id}
                  className={`${styles.abilityCard} ${a.source === 'Leader' ? styles.abilityCardLeader : ''}`}
                >
                  <div className={styles.abilityName}>
                    {a.name}
                    <span className={styles.abilitySource}>[{a.source}]</span>
                    {a.phase && <span className={styles.abilityPhase}>{a.phase}</span>}
                  </div>
                  <div className={styles.abilityDesc}>{a.description}</div>
                </div>
              ))}
            </section>
          </div>

          {/* ── Footer ──────────────────────────────────────────────────── */}
          <footer className={styles.footer}>
            <div className={styles.keywordList}>
              {keywords.map(kw => (
                <span
                  key={kw}
                  className={`${styles.keywordChip} ${kw === 'CHARACTER' ? styles.keywordChipCharacter : ''}`}
                >
                  {kw}
                </span>
              ))}
            </div>
            <button
              type="button"
              className={styles.btnStratagems}
              onClick={() => onOpenStratagems?.(unitInstanceId)}
            >
              <span>Stratagems</span>
              <span className={styles.stratagemCount}>{availableStratagemsCount}</span>
            </button>
          </footer>
        </div>
      </article>

      {/* ── Lightbox ────────────────────────────────────────────────────── */}
      {isLightboxOpen && (
        <div className={styles.lightboxOverlay} onClick={() => setIsLightboxOpen(false)}>
          <div className={styles.lightboxContent} onClick={e => e.stopPropagation()}>
            <div className={styles.lightboxImage}>
              {activeDisplayImage ? (
                <img
                  src={activeDisplayImage}
                  alt={bodyguardName}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <ChapterIcon chapterKey={chapterKey} size={120} color="var(--c-trim)" />
              )}
            </div>
            <div className={styles.lightboxInfo}>
              <h3>{bodyguardName}</h3>
              <div className={styles.lightboxStatus}>
                Status: {customImage ? '🎨 Custom Painted Miniature Active' : '🏛 Official Archive Photo Active'}
              </div>
              <div className={styles.lightboxActions}>
                <button
                  type="button"
                  onClick={() => setIsPhotoModalOpen(true)}
                  className={styles.btnUpload}
                >
                  📷 {customImage ? 'Change Photo' : 'Upload Painted Model'}
                </button>
                {customImage && (
                  <button type="button" onClick={handleRevertToDefault} className={styles.btnRevert}>
                    Reset Default
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsLightboxOpen(false)}
                  className={styles.btnClose}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Photo Upload Modal ──────────────────────────────────────────── */}
      <PhotoUploadModal
        isOpen={isPhotoModalOpen}
        onClose={() => setIsPhotoModalOpen(false)}
        rosterId={rosterId}
        unitInstanceId={unitInstanceId}
        unitName={bodyguardName}
        currentImageUrl={customImage}
        chapterKey={chapterKey}
        onPhotoUpdated={newUrl => {
          setCustomImage(newUrl);
          onCustomPhotoChange?.(newUrl);
        }}
      />
    </div>
  );
};
