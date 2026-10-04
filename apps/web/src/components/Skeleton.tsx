// ─────────────────────────────────────────────────────────────────────────────
// ForceOrg-40k — Loading Skeleton Component
// Shimmer-animated placeholder for async content
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';

interface SkeletonProps {
  /** Width — CSS value (e.g. '100%', '200px') */
  width?: string;
  /** Height — CSS value (e.g. '1rem', '40px') */
  height?: string;
  /** Border radius variant */
  variant?: 'text' | 'rect' | 'circle';
  /** Number of rows for multi-line text skeletons */
  rows?: number;
  /** Custom className */
  className?: string;
  /** Custom inline style */
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height,
  variant = 'text',
  rows = 1,
  className = '',
  style = {},
}) => {
  const getHeight = () => {
    if (height) return height;
    switch (variant) {
      case 'text': return '0.85rem';
      case 'circle': return width;
      case 'rect': return '120px';
      default: return '0.85rem';
    }
  };

  const getBorderRadius = () => {
    switch (variant) {
      case 'circle': return '50%';
      case 'text': return 'var(--radius-sm)';
      case 'rect': return 'var(--radius-md)';
      default: return 'var(--radius-sm)';
    }
  };

  if (rows > 1) {
    return (
      <div className={`skeleton-group ${className}`} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="skeleton"
            style={{
              width: i === rows - 1 ? '70%' : width,
              height: getHeight(),
              borderRadius: getBorderRadius(),
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`skeleton ${className}`}
      style={{
        width,
        height: getHeight(),
        borderRadius: getBorderRadius(),
        ...style,
      }}
    />
  );
};

// ── Preset Skeletons ────────────────────────────────────────────────────────

export const UnitCardSkeleton: React.FC = () => (
  <div className="panel animate-fade-in" style={{ padding: '1.25rem' }}>
    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
      <Skeleton variant="rect" width="80px" height="80px" />
      <div style={{ flex: 1 }}>
        <Skeleton width="60%" height="1.1rem" />
        <div style={{ height: '0.5rem' }} />
        <Skeleton width="40%" height="0.75rem" />
        <div style={{ height: '0.5rem' }} />
        <Skeleton width="30%" height="0.75rem" />
      </div>
    </div>
    <Skeleton rows={3} />
  </div>
);

export const RosterListSkeleton: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="panel" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <Skeleton width="50%" height="0.9rem" />
          <div style={{ height: '0.4rem' }} />
          <Skeleton width="30%" height="0.7rem" />
        </div>
        <Skeleton width="60px" height="0.8rem" />
      </div>
    ))}
  </div>
);

export const FullPageSkeleton: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem' }}>
    <Skeleton variant="circle" width="48px" />
    <Skeleton width="180px" height="0.85rem" />
    <Skeleton width="120px" height="0.7rem" />
  </div>
);
