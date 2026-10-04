// ─────────────────────────────────────────────────────────────────────────────
// ForceOrg-40k — Create Army Modal
// Step 2.3: Faction picker → detachment → name → points limit → POST /api/rosters
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createRoster } from '@/lib/api';
import { ChapterIcon } from '@forceorg/ui-theme';
import type { UserArmy } from '@forceorg/types';

interface CreateArmyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onArmyCreated?: (army: UserArmy) => void;
}

interface FactionOption {
  id: string;
  name: string;
  defaultTheme: string;
  detachments: string[];
  subfactions: { key: string; name: string }[];
}

const FACTIONS: FactionOption[] = [
  {
    id: 'adeptus_astartes',
    name: 'Adeptus Astartes (Space Marines)',
    defaultTheme: 'ultramarines',
    detachments: [
      'Gladius Task Force',
      'Ironstorm Spearhead',
      'Firestorm Assault Force',
      '1st Company Task Force',
      'Anvil Siege Force',
      'Vanguard Spearhead',
      'Stormlance Task Force',
    ],
    subfactions: [
      { key: 'ultramarines', name: 'Ultramarines' },
      { key: 'blood_angels', name: 'Blood Angels' },
      { key: 'dark_angels', name: 'Dark Angels' },
      { key: 'space_wolves', name: 'Space Wolves' },
      { key: 'black_templars', name: 'Black Templars' },
      { key: 'imperial_fists', name: 'Imperial Fists' },
      { key: 'salamanders', name: 'Salamanders' },
      { key: 'raven_guard', name: 'Raven Guard' },
      { key: 'iron_hands', name: 'Iron Hands' },
      { key: 'grey_knights', name: 'Grey Knights' },
    ],
  },
  {
    id: 'necrons',
    name: 'Necrons',
    defaultTheme: 'necrons_szarekhan',
    detachments: [
      'Awakened Dynasty',
      'Hypercrypt Legion',
      'Canoptek Court',
      'Annihilation Legion',
      'Obeisance Phalanx',
    ],
    subfactions: [
      { key: 'necrons_szarekhan', name: 'Szarekhan Dynasty' },
      { key: 'necrons_sautekh', name: 'Sautekh Dynasty' },
      { key: 'necrons_mephrit', name: 'Mephrit Dynasty' },
      { key: 'necrons_novokh', name: 'Novokh Dynasty' },
      { key: 'necrons_nihilakh', name: 'Nihilakh Dynasty' },
    ],
  },
  {
    id: 'tau_empire',
    name: "T'au Empire",
    defaultTheme: 'tau_tau_sept',
    detachments: [
      'Kauyon',
      'Mont\'ka',
      'Retaliation Cadre',
      'Kroot Hunting Pack',
    ],
    subfactions: [
      { key: 'tau_tau_sept', name: "T'au Sept" },
      { key: 'tau_viorla', name: "Vior'la Sept" },
      { key: 'tau_farsight', name: 'Farsight Enclaves' },
    ],
  },
  {
    id: 'chaos_space_marines',
    name: 'Chaos Space Marines',
    defaultTheme: 'black_legion',
    detachments: [
      'Slaves to Darkness',
      'Veterans of the Long War',
      'Dread Talons',
      'Renegade Raiders',
      'Soulforged Warpack',
    ],
    subfactions: [
      { key: 'black_legion', name: 'Black Legion' },
      { key: 'world_eaters', name: 'World Eaters' },
      { key: 'death_guard', name: 'Death Guard' },
      { key: 'thousand_sons', name: 'Thousand Sons' },
    ],
  },
];

export const CreateArmyModal: React.FC<CreateArmyModalProps> = ({
  isOpen,
  onClose,
  onArmyCreated,
}) => {
  const router = useRouter();
  const [selectedFactionId, setSelectedFactionId] = useState(FACTIONS[0]!.id);
  const currentFaction = FACTIONS.find(f => f.id === selectedFactionId) || FACTIONS[0]!;

  const [selectedSubfaction, setSelectedSubfaction] = useState(currentFaction.defaultTheme);
  const [selectedDetachment, setSelectedDetachment] = useState(currentFaction.detachments[0] || 'Gladius Task Force');
  const [armyName, setArmyName] = useState('Ultramarines 1st Company Strike Force');
  const [pointsLimit, setPointsLimit] = useState(2000);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFactionChange = (factionId: string) => {
    setSelectedFactionId(factionId);
    const f = FACTIONS.find(item => item.id === factionId) || FACTIONS[0]!;
    setSelectedSubfaction(f.defaultTheme);
    setSelectedDetachment(f.detachments[0] || 'Default Detachment');
    setArmyName(`${f.subfactions[0]?.name || f.name} Force`);
  };

  const handleSubfactionChange = (themeKey: string) => {
    setSelectedSubfaction(themeKey);
    const sub = currentFaction.subfactions.find(s => s.key === themeKey);
    if (sub) {
      setArmyName(`${sub.name} Strike Force`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const newArmy = await createRoster({
        name: armyName.trim() || 'Untitled Roster',
        factionId: selectedFactionId,
        detachmentPrimary: selectedDetachment,
        pointsLimit,
        detachmentPointsLimit: 3,
        factionThemeOverride: selectedSubfaction,
      });

      if (onArmyCreated) {
        onArmyCreated(newArmy);
      }
      onClose();
      router.push(`/army/${newArmy.id}/edit`);
    } catch (err: any) {
      console.warn('[CreateArmyModal] API create failed:', err?.message);
      // Fallback: create offline local army id and navigate
      const fallbackArmy: UserArmy = {
        id: `army_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        userId: 'local-user',
        name: armyName.trim() || 'Untitled Roster',
        factionId: selectedFactionId,
        rulesetVersionId: '11.1.0-2026-Q3',
        detachmentPrimary: selectedDetachment,
        detachmentSecondary: null,
        pointsLimit,
        detachmentPointsLimit: 3,
        factionThemeOverride: selectedSubfaction,
        rosterPayload: { units: [], totalPoints: 0, detachmentPointsUsed: 0 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (onArmyCreated) {
        onArmyCreated(fallbackArmy);
      }
      onClose();
      router.push(`/army/${fallbackArmy.id}/edit`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: 'var(--c-trim)' }}>⚔</span>
            <h3 className="modal-title">Assemble New Battle Force</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div style={{ padding: '0.5rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: 'var(--radius-sm)', color: '#f87171', fontSize: '0.75rem' }}>
                {error}
              </div>
            )}

            {/* Faction Select */}
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>
                1. Select Faction
              </label>
              <select
                value={selectedFactionId}
                onChange={e => handleFactionChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.6rem 0.75rem',
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid var(--surface-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  outline: 'none',
                }}
              >
                {FACTIONS.map(f => (
                  <option key={f.id} value={f.id} style={{ background: '#0f1623' }}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Chapter / Subfaction Select */}
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>
                2. Subfaction / Chapter Heraldry
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: 28, height: 28, flexShrink: 0 }}>
                  <ChapterIcon chapterKey={selectedSubfaction} size={28} />
                </div>
                <select
                  value={selectedSubfaction}
                  onChange={e => handleSubfactionChange(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '0.6rem 0.75rem',
                    background: 'rgba(0, 0, 0, 0.35)',
                    border: '1px solid var(--surface-border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    outline: 'none',
                  }}
                >
                  {currentFaction.subfactions.map(s => (
                    <option key={s.key} value={s.key} style={{ background: '#0f1623' }}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Detachment Select */}
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>
                3. Primary Detachment Rule
              </label>
              <select
                value={selectedDetachment}
                onChange={e => setSelectedDetachment(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.6rem 0.75rem',
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid var(--surface-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  outline: 'none',
                }}
              >
                {currentFaction.detachments.map(d => (
                  <option key={d} value={d} style={{ background: '#0f1623' }}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Army Name */}
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>
                4. Roster Name
              </label>
              <input
                type="text"
                value={armyName}
                onChange={e => setArmyName(e.target.value)}
                required
                placeholder="e.g. 1st Company Strike Force"
                style={{
                  width: '100%',
                  padding: '0.6rem 0.75rem',
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid var(--surface-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Points Limit */}
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>
                5. Battle Size / Points Limit
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {[1000, 2000, 3000].map(pts => (
                  <button
                    key={pts}
                    type="button"
                    onClick={() => setPointsLimit(pts)}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      borderRadius: 'var(--radius-sm)',
                      border: pointsLimit === pts
                        ? '1px solid var(--c-trim, #C89D3C)'
                        : '1px solid var(--surface-border)',
                      background: pointsLimit === pts
                        ? 'rgba(200, 157, 60, 0.15)'
                        : 'rgba(0, 0, 0, 0.25)',
                      color: pointsLimit === pts ? 'var(--c-trim, #C89D3C)' : 'var(--text-secondary)',
                      fontWeight: pointsLimit === pts ? 700 : 500,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      transition: 'all 120ms ease',
                    }}
                  >
                    {pts} pts
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.5rem 1rem',
                background: 'transparent',
                border: '1px solid var(--surface-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-muted)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '0.5rem 1.25rem',
                background: 'linear-gradient(135deg, var(--c-trim, #C89D3C) 0%, #D4A843 100%)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                color: '#070b12',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: submitting ? 'wait' : 'pointer',
                boxShadow: '0 2px 10px rgba(200, 157, 60, 0.3)',
              }}
            >
              {submitting ? 'Creating Force…' : 'Create & Build Roster →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
