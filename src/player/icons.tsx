/** Inline SVG icon set — no external icon dependency, works offline. */

const paths: Record<string, string> = {
  message: 'M4 4h16v12H8l-4 4V4z',
  phone: 'M6.6 3h3l1.5 4-2 1.5a12 12 0 0 0 4.4 4.4L15 11l4 1.5v3a2 2 0 0 1-2.2 2A16 16 0 0 1 4.6 5.2 2 2 0 0 1 6.6 3z',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 0c-2.5 2-3.8 5-3.8 9s1.3 7 3.8 9c2.5-2 3.8-5 3.8-9S14.5 5 12 3zM3.5 9h17M3.5 15h17',
  camera: 'M4 7h3l1.5-2h7L17 7h3v12H4V7zm8 3.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
  mail: 'M3 6h18v12H3V6zm0 1 9 6 9-6',
  note: 'M6 3h9l5 5v13H6V3zm9 0v5h5',
  calendar: 'M4 5h16v16H4V5zm0 6h16M8 3v4m8-4v4',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4v5l3 2',
  gear: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm8 3a8 8 0 0 0-.1-1.2l2-1.5-2-3.4-2.4 1a8 8 0 0 0-2-1.2L15 2H9l-.5 2.7a8 8 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.5A8 8 0 0 0 4 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.4-1a8 8 0 0 0 2 1.2L9 22h6l.5-2.7a8 8 0 0 0 2-1.2l2.4 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z',
  music: 'M9 18V6l10-2v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm10-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  map: 'M9 4 3 6.5v13L9 17l6 3 6-2.5v-13L15 7 9 4zm0 0v13m6-10v13',
  journal: 'M5 3h11l3 3v15H5V3zm3 5h8M8 12h8M8 16h5',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm5 12 5 5',
  'chevron-left': 'M15 5l-7 7 7 7',
  'chevron-right': 'M9 5l7 7-7 7',
  plus: 'M12 5v14M5 12h14',
  heart: 'M12 20s-7-4.4-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.6-7 9-7 9z',
  repeat: 'M4 9a5 5 0 0 1 5-5h9l-3-3m3 3-3 3M20 15a5 5 0 0 1-5 5H6l3 3m-3-3 3-3',
  bookmark: 'M7 3h10v18l-5-4-5 4V3z',
  send: 'M4 12 21 4l-8 16-2-6-7-2z',
  share: 'M12 3v12M8 7l4-4 4 4M5 13v7h14v-7',
  trash: 'M5 7h14M9 7V5h6v2m-8 0 1 13h8l1-13',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z',
  check: 'M4 12l5 5L20 6',
  close: 'M6 6l12 12M18 6 6 18',
  backspace: 'M9 5h10v14H9l-6-7 6-7z',
  person: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm-8 16a8 8 0 0 1 16 0',
  x: 'M4 4l16 16M20 4 4 20',
  bell: 'M12 3a5 5 0 0 0-5 5v4l-2 3h14l-2-3V8a5 5 0 0 0-5-5zm-2 14a2 2 0 0 0 4 0',
  home: 'M4 11l8-7 8 7v9h-6v-6h-4v6H4v-9z',
  moon: 'M20 14a8 8 0 1 1-9-11 7 7 0 0 0 9 11z',
  lock: 'M6 11h12v10H6V11zm3 0V8a3 3 0 0 1 6 0v3',
  key: 'M14 8a4 4 0 1 1-3.5 5.9L4 20v-3h3v-3h3l1.5-1.5A4 4 0 0 1 14 8z',
};

export interface IconProps {
  name: keyof typeof paths | string;
  size?: number;
  className?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 22, className, strokeWidth = 1.7 }: IconProps) {
  const d = paths[name] ?? paths.close;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} />
    </svg>
  );
}

/** Wallpaper gradients used when a project does not ship images. */
export const WALLPAPERS: Array<{ id: string; css: string; label: string }> = [
  {
    id: 'midnight',
    label: 'Midnight',
    css: 'linear-gradient(160deg,#3b3f7a 0%,#1a1c3a 45%,#0b0b18 100%)',
  },
  {
    id: 'sunset',
    label: 'Sunset',
    css: 'linear-gradient(160deg,#ff9a5a 0%,#d9547c 45%,#2b1a3d 100%)',
  },
  {
    id: 'forest',
    label: 'Forest',
    css: 'linear-gradient(160deg,#2f8f6d 0%,#12463f 50%,#08120f 100%)',
  },
  {
    id: 'mono',
    label: 'Mono',
    css: 'linear-gradient(160deg,#3a3a44 0%,#17171d 60%,#0a0a0c 100%)',
  },
  {
    id: 'ocean',
    label: 'Ocean',
    css: 'linear-gradient(160deg,#2b6ea8 0%,#123a5e 55%,#08141f 100%)',
  },
  {
    id: 'aurora',
    label: 'Aurora',
    css: 'linear-gradient(160deg,#7a4fbf 0%,#2b7fb8 50%,#10122a 100%)',
  },
];

export function wallpaperCss(value: string): string {
  if (!value) return WALLPAPERS[0].css;
  if (value.startsWith('grad:')) {
    const [a, b] = value.slice(5).split(',');
    return `linear-gradient(160deg, ${a || '#3b3f7a'} 0%, ${b || '#0b0b18'} 100%)`;
  }
  if (value.startsWith('http') || value.startsWith('data:') || value.startsWith('/')) {
    return `url("${value}")`;
  }
  const found = WALLPAPERS.find((w) => w.id === value);
  return found ? found.css : WALLPAPERS[0].css;
}
