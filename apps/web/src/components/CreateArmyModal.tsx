// ─────────────────────────────────────────────────────────────────────────────
// BeerHammer — Create Army Modal
// Supports all 27 canonical factions, subfaction/chapter selection,
// detachment rules & enhancements preview, and tournament battle size presets
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createRoster } from '@/lib/api';
import { ChapterIcon } from '@forceorg/ui-theme';
import type { UserArmy } from '@forceorg/types';

interface CreateArmyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onArmyCreated?: (army: UserArmy) => void;
}

interface FactionSummary {
  id: string;
  name: string;
  grandAlliance: 'Imperium' | 'Chaos' | 'Xenos' | 'Other';
  isLegends: boolean;
  file: string;
  datasheetCount: number;
  detachmentCount: number;
  subfactions?: { id: string; name: string; datasheetCount: number }[];
}

interface DetachmentDetail {
  id: string;
  name: string;
  dpCost?: number;
  rules: string[];
  enhancements?: { id: string; name: string; points: number; description: string }[];
}

interface DetailedFaction {
  id: string;
  name: string;
  grandAlliance: string;
  detachments: DetachmentDetail[];
  subfactions?: { id: string; name: string; datasheetCount: number }[];
}

export const CreateArmyModal: React.FC<CreateArmyModalProps> = ({
  isOpen,
  onClose,
  onArmyCreated,
}) => {
  const router = useRouter();

  const [factions, setFactions] = useState<FactionSummary[]>([]);
  const [loadingFactions, setLoadingFactions] = useState(true);
  const [activeAlliance, setActiveAlliance] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [includeLegends, setIncludeLegends] = useState(false);

  const [selectedFactionId, setSelectedFactionId] = useState<string>('imperium-space-marines');
  const [selectedSubfactionId, setSelectedSubfactionId] = useState<string>('ultramarines');
  const [factionDetails, setFactionDetails] = useState<DetailedFaction | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [selectedDetachments, setSelectedDetachments] = useState<string[]>(['Gladius Task Force']);
  const [pointsLimit, setPointsLimit] = useState<number>(2000);
  const [customPointsInput, setCustomPointsInput] = useState<string>('2000');
  const [isCustomPoints, setIsCustomPoints] = useState<boolean>(false);
  const [armyName, setArmyName] = useState<string>('Ultramarines Strike Force');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load master index
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    async function fetchIndex() {
      setLoadingFactions(true);
      try {
        const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
        const res = await fetch(`${basePath}/data/factions/index.json`);
        if (res.ok) {
          const data: FactionSummary[] = await res.json();
          if (isMounted) {
            setFactions(data);
            if (data.length > 0 && !selectedFactionId) {
              setSelectedFactionId(data[0]!.id);
            }
          }
        }
      } catch (err) {
        console.warn('Failed to load factions index, using fallback list', err);
      } finally {
        if (isMounted) setLoadingFactions(false);
      }
    }
    fetchIndex();
    return () => { isMounted = false; };
  }, [isOpen, selectedFactionId]);

  // Load specific faction details when factionId changes
  useEffect(() => {
    if (!isOpen || !selectedFactionId) return;
    let isMounted = true;
    async function fetchFactionData() {
      setLoadingDetails(true);
      try {
        const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
        const res = await fetch(`${basePath}/data/factions/${selectedFactionId}.json`);
        if (res.ok) {
          const data: DetailedFaction = await res.json();
          if (isMounted) {
            setFactionDetails(data);
            if (data.detachments && data.detachments.length > 0) {
              setSelectedDetachments([data.detachments[0]!.name]);
            } else {
              setSelectedDetachments(['Standard Detachment']);
            }
            if (data.subfactions && data.subfactions.length > 0) {
              setSelectedSubfactionId(data.subfactions[0]!.id);
              setArmyName(`${data.subfactions[0]!.name} Strike Force`);
            } else {
              setSelectedSubfactionId('');
              setArmyName(`${data.name} Strike Force`);
            }
          }
        }
      } catch (err) {
        console.warn(`Failed to load details for ${selectedFactionId}`, err);
      } finally {
        if (isMounted) setLoadingDetails(false);
      }
    }
    fetchFactionData();
    return () => { isMounted = false; };
  }, [isOpen, selectedFactionId]);

  // Filtered factions list
  const filteredFactions = useMemo(() => {
    return factions.filter(f => {
      if (!includeLegends && f.isLegends) return false;
      if (activeAlliance !== 'ALL' && f.grandAlliance !== activeAlliance) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = f.name.toLowerCase().includes(q);
        const matchesSubfaction = f.subfactions?.some(s => s.name.toLowerCase().includes(q));
        if (!matchesName && !matchesSubfaction) return false;
      }
      return true;
    });
  }, [factions, activeAlliance, searchQuery, includeLegends]);

  const selectedDetachmentObjs = useMemo(() => {
    if (!factionDetails?.detachments) return [];
    return factionDetails.detachments.filter(d => selectedDetachments.includes(d.name));
  }, [factionDetails, selectedDetachments]);

  const totalSelectedDp = useMemo(() => {
    return selectedDetachmentObjs.reduce((sum, d) => sum + (d.dpCost || 1), 0);
  }, [selectedDetachmentObjs]);

  const handleToggleDetachment = (det: DetachmentDetail) => {
    const cost = det.dpCost || 1;
    const isSelected = selectedDetachments.includes(det.name);

    if (isSelected) {
      setError(null);
      setSelectedDetachments(selectedDetachments.filter(n => n !== det.name));
    } else {
      if (totalSelectedDp + cost > 3) {
        setError(`Cannot select "${det.name}" (${cost} DP). Total Detachment Points would exceed the 3 DP budget (${totalSelectedDp + cost} / 3 DP).`);
        return;
      }
      setError(null);
      setSelectedDetachments([...selectedDetachments, det.name]);
    }
  };

  if (!isOpen) return null;

  const handlePointsPreset = (pts: number) => {
    setIsCustomPoints(false);
    setPointsLimit(pts);
    setCustomPointsInput(pts.toString());
  };

  const handleCustomPointsChange = (val: string) => {
    setCustomPointsInput(val);
    const num = parseInt(val, 10);
    if (!isNaN(num) && num > 0) {
      setPointsLimit(num);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedDetachments.length === 0) {
      setError('Please select at least one detachment.');
      return;
    }
    if (totalSelectedDp > 3) {
      setError('Total Detachment Points cannot exceed 3 DP.');
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      const newArmy = await createRoster({
        name: armyName.trim() || 'Untitled Roster',
        factionId: selectedFactionId,
        detachmentPrimary: selectedDetachments[0] || 'Standard Detachment',
        detachmentSecondary: selectedDetachments[1] || undefined,
        pointsLimit: pointsLimit || 2000,
        detachmentPointsLimit: 3,
        factionThemeOverride: selectedSubfactionId || selectedFactionId,
        rosterPayload: {
          units: [],
          totalPoints: 0,
          detachmentPointsUsed: totalSelectedDp,
          selectedDetachments,
        },
      });

      if (onArmyCreated) {
        onArmyCreated(newArmy);
      }
      onClose();
      router.push(`/army/${newArmy.id}/edit`);
    } catch (err: any) {
      console.error('Failed to create army:', err);
      setError(err?.message || 'Could not create force. Please verify connection.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 8, 14, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '840px',
          maxHeight: '90vh',
          backgroundColor: '#0B111A',
          border: '1px solid rgba(200, 157, 60, 0.35)',
          borderRadius: '12px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.8), 0 0 24px rgba(200, 157, 60, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'linear-gradient(180deg, rgba(20, 28, 42, 0.6) 0%, rgba(11, 17, 26, 0.9) 100%)',
          }}
        >
          <div>
            <div style={{ fontSize: '0.7rem', color: '#C89D3C', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              ✦ 11th Edition Force Org
            </div>
            <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#F1F5F9', fontFamily: 'var(--font-display)' }}>
              Assemble New Battle Force
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94A3B8',
              fontSize: '1.5rem',
              cursor: 'pointer',
              lineHeight: 1,
              padding: '0.25rem',
            }}
          >
            ×
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: '1.5rem', flex: 1 }}>
          {error && (
            <div style={{ padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #EF4444', borderRadius: '6px', color: '#FCA5A5', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              {error}
            </div>
          )}

          {/* Step 1: Select Faction & Alliance Filter */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#E2E8F0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                1. Select Army Faction
              </label>

              {/* Alliance Tabs & Legends Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {(['ALL', 'Imperium', 'Chaos', 'Xenos'] as const).map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveAlliance(tab)}
                    style={{
                      padding: '0.25rem 0.6rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      borderRadius: '4px',
                      border: '1px solid',
                      borderColor: activeAlliance === tab ? '#C89D3C' : 'rgba(255,255,255,0.1)',
                      background: activeAlliance === tab ? 'rgba(200, 157, 60, 0.2)' : 'rgba(255,255,255,0.03)',
                      color: activeAlliance === tab ? '#F1F5F9' : '#94A3B8',
                      cursor: 'pointer',
                    }}
                  >
                    {tab}
                  </button>
                ))}

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: '#94A3B8', marginLeft: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={includeLegends}
                    onChange={(e) => setIncludeLegends(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  Legends / Titans
                </label>
              </div>
            </div>

            {/* Instant Search Bar */}
            <div style={{ marginBottom: '0.75rem' }}>
              <input
                type="text"
                placeholder="🔍 Search all 27 factions & subfactions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.6rem 0.85rem',
                  fontSize: '0.85rem',
                  backgroundColor: 'rgba(15, 23, 42, 0.7)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '6px',
                  color: '#F8FAFC',
                  outline: 'none',
                }}
              />
            </div>

            {/* Factions Grid (Q1=C) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: '0.6rem',
                maxHeight: '220px',
                overflowY: 'auto',
                paddingRight: '0.25rem',
              }}
            >
              {loadingFactions ? (
                <div style={{ gridColumn: '1 / -1', padding: '1rem', textAlign: 'center', color: '#94A3B8', fontSize: '0.85rem' }}>
                  Loading faction catalogues...
                </div>
              ) : filteredFactions.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', padding: '1rem', textAlign: 'center', color: '#94A3B8', fontSize: '0.85rem' }}>
                  No factions match your search.
                </div>
              ) : (
                filteredFactions.map(f => {
                  const isSelected = f.id === selectedFactionId;
                  return (
                    <div
                      key={f.id}
                      onClick={() => setSelectedFactionId(f.id)}
                      style={{
                        padding: '0.65rem 0.75rem',
                        borderRadius: '6px',
                        border: '1px solid',
                        borderColor: isSelected ? '#C89D3C' : 'rgba(255, 255, 255, 0.08)',
                        background: isSelected
                          ? 'linear-gradient(135deg, rgba(200, 157, 60, 0.25) 0%, rgba(20, 28, 42, 0.8) 100%)'
                          : 'rgba(15, 23, 42, 0.5)',
                        cursor: 'pointer',
                        transition: 'all 120ms ease',
                        boxShadow: isSelected ? '0 0 12px rgba(200, 157, 60, 0.2)' : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <ChapterIcon chapterKey={f.id.replace('imperium-', '').replace('chaos-', '')} size={22} />
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: isSelected ? '#F8FAFC' : '#CBD5E1', lineHeight: 1.2 }}>
                          {f.name}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#94A3B8' }}>
                        <span>{f.grandAlliance}</span>
                        <span>{f.datasheetCount} units</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Subfaction Selector if available (Q1=C) */}
          {factionDetails?.subfactions && factionDetails.subfactions.length > 0 && (
            <div style={{ marginBottom: '1.25rem', padding: '0.85rem', background: 'rgba(200, 157, 60, 0.05)', borderRadius: '6px', border: '1px solid rgba(200, 157, 60, 0.2)' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#C89D3C', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                Chapter / Subfaction Specialization:
              </label>
              <select
                value={selectedSubfactionId}
                onChange={(e) => {
                  setSelectedSubfactionId(e.target.value);
                  const sub = factionDetails.subfactions?.find(s => s.id === e.target.value);
                  if (sub) setArmyName(`${sub.name} Strike Force`);
                }}
                style={{
                  width: '100%',
                  padding: '0.55rem',
                  fontSize: '0.85rem',
                  backgroundColor: '#0F172A',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '4px',
                  color: '#F8FAFC',
                }}
              >
                {factionDetails.subfactions.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.datasheetCount > 0 ? `(+${s.datasheetCount} unique units)` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Step 2: Multi-Detachment Selection & DP Budget Meter */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#E2E8F0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                2. Detachments & Detachment Points (DP)
              </label>

              {/* Live DP Budget Meter */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                background: 'rgba(15, 23, 42, 0.9)',
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                border: totalSelectedDp > 3 ? '1px solid #EF4444' : totalSelectedDp === 3 ? '1px solid #C89D3C' : '1px solid #38BDF8',
              }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: totalSelectedDp > 3 ? '#EF4444' : totalSelectedDp === 3 ? '#FCD34D' : '#38BDF8' }}>
                  ⚡ {totalSelectedDp} / 3 DP Used
                </span>
                <span style={{ fontSize: '0.7rem', color: '#94A3B8' }}>
                  {totalSelectedDp === 3 ? '• Budget Maxed (3/3 DP)' : `• ${3 - totalSelectedDp} DP remaining`}
                </span>
              </div>
            </div>

            {/* Visual Budget Progress Bar */}
            <div style={{ width: '100%', height: '6px', background: '#1E293B', borderRadius: '3px', marginBottom: '0.85rem', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, (totalSelectedDp / 3) * 100)}%`,
                  height: '100%',
                  background: totalSelectedDp > 3 ? '#EF4444' : totalSelectedDp === 3 ? 'linear-gradient(90deg, #F59E0B, #C89D3C)' : 'linear-gradient(90deg, #0284C7, #38BDF8)',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>

            {loadingDetails ? (
              <div style={{ padding: '0.75rem', color: '#94A3B8', fontSize: '0.85rem' }}>Loading detachments...</div>
            ) : factionDetails?.detachments && factionDetails.detachments.length > 0 ? (
              <div>
                {/* Detachment Cards Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                    gap: '0.65rem',
                    maxHeight: '260px',
                    overflowY: 'auto',
                    paddingRight: '0.25rem',
                    marginBottom: '0.85rem',
                  }}
                >
                  {factionDetails.detachments.map(d => {
                    const cost = d.dpCost || 1;
                    const isSelected = selectedDetachments.includes(d.name);
                    const canAdd = isSelected || (totalSelectedDp + cost <= 3);

                    return (
                      <div
                        key={d.id}
                        onClick={() => canAdd && handleToggleDetachment(d)}
                        style={{
                          padding: '0.75rem',
                          borderRadius: '6px',
                          border: '1px solid',
                          borderColor: isSelected ? '#C89D3C' : canAdd ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                          background: isSelected
                            ? 'linear-gradient(135deg, rgba(200, 157, 60, 0.25) 0%, rgba(20, 28, 42, 0.85) 100%)'
                            : canAdd
                            ? 'rgba(15, 23, 42, 0.6)'
                            : 'rgba(15, 23, 42, 0.3)',
                          cursor: canAdd ? 'pointer' : 'not-allowed',
                          opacity: canAdd ? 1 : 0.45,
                          transition: 'all 150ms ease',
                          boxShadow: isSelected ? '0 0 12px rgba(200, 157, 60, 0.25)' : 'none',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '0.5rem',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.4rem', marginBottom: '0.35rem' }}>
                            <strong style={{ fontSize: '0.82rem', color: isSelected ? '#F8FAFC' : '#CBD5E1', lineHeight: 1.25 }}>
                              {d.name}
                            </strong>
                            <span style={{
                              padding: '2px 7px',
                              borderRadius: '4px',
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              background: cost === 1 ? 'rgba(56, 189, 248, 0.2)' : cost === 2 ? 'rgba(200, 157, 60, 0.2)' : 'rgba(168, 85, 247, 0.2)',
                              border: cost === 1 ? '1px solid #38BDF8' : cost === 2 ? '1px solid #C89D3C' : '1px solid #A855F7',
                              color: cost === 1 ? '#38BDF8' : cost === 2 ? '#C89D3C' : '#C084FC',
                              whiteSpace: 'nowrap',
                            }}>
                              {cost} DP
                            </span>
                          </div>

                          {d.rules && d.rules.length > 0 && (
                            <div style={{ fontSize: '0.68rem', color: '#94A3B8', marginBottom: '0.25rem' }}>
                              Rule: <span style={{ color: '#E2E8F0' }}>{d.rules.join(', ')}</span>
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.35rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                          <span style={{ fontSize: '0.65rem', color: '#64748B' }}>
                            {d.enhancements?.length || 0} Enhancements
                          </span>

                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            color: isSelected ? '#FCD34D' : canAdd ? '#38BDF8' : '#64748B',
                          }}>
                            {isSelected ? '✓ Selected' : canAdd ? `+ Add (${cost} DP)` : '🔒 Exceeds DP'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Selected Detachments Summary & Combined Rules */}
                {selectedDetachmentObjs.length > 0 && (
                  <div style={{ padding: '0.85rem', background: 'rgba(15, 23, 42, 0.75)', borderRadius: '6px', border: '1px solid rgba(200, 157, 60, 0.25)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#C89D3C', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.04em' }}>
                      Active Force Detachments ({selectedDetachmentObjs.length}) — Combined DP: {totalSelectedDp} / 3 DP
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {selectedDetachmentObjs.map(d => (
                        <div key={d.id} style={{ padding: '0.5rem 0.65rem', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#38BDF8' }}>
                              ⚡ {d.name}
                            </span>
                            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#FCD34D' }}>
                              {d.dpCost || 1} DP
                            </span>
                          </div>

                          <div style={{ fontSize: '0.7rem', color: '#CBD5E1', marginBottom: '0.25rem' }}>
                            <strong style={{ color: '#94A3B8' }}>Rules: </strong>{d.rules.join(', ') || 'Standard Battle Formation'}
                          </div>

                          {d.enhancements && d.enhancements.length > 0 && (
                            <div style={{ fontSize: '0.65rem', color: '#94A3B8' }}>
                              <strong style={{ color: '#C89D3C' }}>Enhancements: </strong>
                              {d.enhancements.map(e => `${e.name} (${e.points} pts)`).join(' • ')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: '0.5rem', color: '#94A3B8', fontSize: '0.8rem' }}>Standard Detachment</div>
            )}
          </div>

          {/* Step 3: Tournament Battle Size & Custom Limit (Q8=A) */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#E2E8F0', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              3. Tournament Battle Size / Points Limit
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              {[
                { pts: 500, label: '500 pts', subtitle: 'Small-Scale' },
                { pts: 1000, label: '1,000 pts', subtitle: 'Incursion' },
                { pts: 2000, label: '2,000 pts', subtitle: 'Strike Force (Official)' },
              ].map(tier => (
                <button
                  key={tier.pts}
                  type="button"
                  onClick={() => handlePointsPreset(tier.pts)}
                  style={{
                    flex: '1 1 140px',
                    padding: '0.65rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: !isCustomPoints && pointsLimit === tier.pts ? '#C89D3C' : 'rgba(255,255,255,0.1)',
                    background: !isCustomPoints && pointsLimit === tier.pts ? 'rgba(200, 157, 60, 0.2)' : 'rgba(15, 23, 42, 0.5)',
                    color: '#F8FAFC',
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{tier.label}</div>
                  <div style={{ fontSize: '0.65rem', color: '#94A3B8' }}>{tier.subtitle}</div>
                </button>
              ))}

              <button
                type="button"
                onClick={() => setIsCustomPoints(true)}
                style={{
                  flex: '1 1 120px',
                  padding: '0.65rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid',
                  borderColor: isCustomPoints ? '#C89D3C' : 'rgba(255,255,255,0.1)',
                  background: isCustomPoints ? 'rgba(200, 157, 60, 0.2)' : 'rgba(15, 23, 42, 0.5)',
                  color: '#F8FAFC',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>Custom</div>
                <div style={{ fontSize: '0.65rem', color: '#94A3B8' }}>Custom Points</div>
              </button>
            </div>

            {isCustomPoints && (
              <div style={{ marginTop: '0.5rem' }}>
                <input
                  type="number"
                  min="100"
                  max="10000"
                  step="50"
                  value={customPointsInput}
                  onChange={(e) => handleCustomPointsChange(e.target.value)}
                  style={{
                    width: '160px',
                    padding: '0.5rem',
                    fontSize: '0.85rem',
                    backgroundColor: '#0F172A',
                    border: '1px solid #C89D3C',
                    borderRadius: '4px',
                    color: '#F8FAFC',
                  }}
                />
              </div>
            )}
          </div>

          {/* Step 4: Army Name */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#E2E8F0', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              4. Force Designation / Roster Name
            </label>
            <input
              type="text"
              value={armyName}
              onChange={(e) => setArmyName(e.target.value)}
              placeholder="e.g. 1st Company Strike Force"
              required
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                fontSize: '0.9rem',
                backgroundColor: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '6px',
                color: '#F8FAFC',
              }}
            />
          </div>

          {/* Action Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                padding: '0.65rem 1.25rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: '#94A3B8',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '0.65rem 1.5rem',
                fontSize: '0.85rem',
                fontWeight: 700,
                color: '#070B12',
                background: 'linear-gradient(135deg, #C89D3C 0%, #D4A843 100%)',
                border: 'none',
                borderRadius: '6px',
                cursor: submitting ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 16px rgba(200, 157, 60, 0.35)',
              }}
            >
              {submitting ? 'Deploying Force...' : 'Deploy Force & Launch Builder ➔'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
