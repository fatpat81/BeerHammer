// ─────────────────────────────────────────────────────────────────────────────
// ForceOrg-40k — Universal Chapter Icon Component (§8.3)
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { CHAPTER_PATHS } from './paths';

export type ChapterKey = keyof typeof CHAPTER_PATHS;

export interface ChapterIconProps extends React.SVGProps<SVGSVGElement> {
  chapter?: ChapterKey | string;
  chapterKey?: ChapterKey | string;
  size?: number | string;
  color?: string;
  className?: string;
  isWatermark?: boolean;
}

export const ChapterIcon: React.FC<ChapterIconProps> = ({
  chapter,
  chapterKey,
  size = 24,
  color = 'currentColor',
  className = '',
  isWatermark = false,
  style,
  ...svgProps
}) => {
  const effectiveKey = (chapterKey || chapter) as ChapterKey;
  const definition = effectiveKey ? CHAPTER_PATHS[effectiveKey] : undefined;
  if (!definition) return null;

  const combinedStyles: React.CSSProperties = {
    display: 'inline-block',
    flexShrink: 0,
    verticalAlign: 'middle',
    ...(isWatermark
      ? {
          position: 'absolute',
          pointerEvents: 'none',
          opacity: 'var(--badge-watermark-opacity, 0.06)' as any,
          right: '-5%',
          bottom: '-10%',
          width: '70%',
          height: '70%',
          zIndex: 0,
        }
      : {}),
    ...style,
  };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={definition.viewBox}
      width={isWatermark ? undefined : size}
      height={isWatermark ? undefined : size}
      fill={color}
      className={`chapter-icon chapter-icon--${chapter} ${className}`}
      style={combinedStyles}
      aria-label={`${definition.name} Chapter Insignia`}
      role="img"
      {...svgProps}
    >
      {definition.paths.map((path, idx) => (
        <path
          key={`${chapter}-path-${idx}`}
          d={path.d}
          fill={path.fill || color}
          opacity={path.opacity ?? 1}
        />
      ))}
    </svg>
  );
};
