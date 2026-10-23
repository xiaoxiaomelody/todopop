/// <reference path="./assets.d.ts" />
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import logoO from './assets/logo-o.svg';
export function ActionGlyph({ name }: { name: 'add' | 'close' | 'receipt' | 'tint' | 'help' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === 'add' ? (
        <path d="M12 5v14M5 12h14" />
      ) : name === 'close' ? (
        <path d="m6 6 12 12M18 6 6 18" />
      ) : name === 'receipt' ? (
        <circle cx="12" cy="12" r="7" strokeDasharray="2 4" />
      ) : name === 'tint' ? (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" stroke="none" />
        </>
      ) : (
        <>
          <path d="M8.5 8a3.5 3.5 0 0 1 7 0c0 2.5-3.5 2.5-3.5 5" />
          <circle cx="12" cy="18" r=".8" fill="currentColor" stroke="none" />
        </>
      )}
    </svg>
  );
}
export function BrandLogo({
  actions,
}: { actions?: { name: string; symbol: string; active?: boolean; onClick(): void }[] } = {}) {
  return (
    <div className="logo" aria-label="TODOPOP">
      {['T', 'O', 'D', 'O', 'P', 'O', 'P'].map((letter, index) =>
        letter === 'O' ? (
          actions ? (
            <button
              key={index}
              type="button"
              className="logo-o-button"
              aria-label={actions[(index - 1) / 2].name}
              aria-expanded={actions[(index - 1) / 2].active}
              title={actions[(index - 1) / 2].name}
              onClick={actions[(index - 1) / 2].onClick}
            >
              <img src={logoO} alt="" width="24.08" height="21.77" />
              <span aria-hidden="true">
                <ActionGlyph name={(['add', 'receipt', 'tint'] as const)[(index - 1) / 2]} />
              </span>
            </button>
          ) : (
            <img key={index} src={logoO} alt="" width="24.08" height="21.77" />
          )
        ) : (
          <span key={index}>{letter}</span>
        ),
      )}
    </div>
  );
}
export function Button({
  variant = 'outline',
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'outline' | 'filled' | 'text' }) {
  return (
    <button className={`tp-button tp-button--${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
export function TextInput({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`tp-input ${className}`} {...props} />;
}
export function StatusDot({
  state = 'idle',
}: {
  state?: 'idle' | 'connected' | 'connecting' | 'error';
}) {
  return <span aria-hidden="true" className={`status-dot tp-status-dot tp-status-dot--${state}`} />;
}
export function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="eyebrow tp-field-label">{children}</span>;
}

export function applyTheme(tint: string) {
  if (!/^#[a-fA-F0-9]{6}$/.test(tint)) return;
  const channels = [1, 3, 5].map((i) => parseInt(tint.slice(i, i + 2), 16) / 255),
    max = Math.max(...channels),
    min = Math.min(...channels),
    d = max - min,
    light = (max + min) / 2;
  const hue = d
    ? ((max === channels[0]
        ? (channels[1] - channels[2]) / d
        : max === channels[1]
          ? (channels[2] - channels[0]) / d + 2
          : (channels[0] - channels[1]) / d + 4) *
        60 +
        360) %
      360
    : 222.27;
  const saturation = d ? d / (1 - Math.abs(2 * light - 1)) : 0;
  document.documentElement.style.setProperty(
    '--tp-asset-filter',
    `hue-rotate(${hue - 222.27}deg) saturate(${saturation / 0.7174})`,
  );
  const luminance = (rgb: number[]) =>
    rgb
      .map((n) => (n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4)))
      .reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i], 0);
  const readable = [...channels];
  while (1.05 / (luminance(readable) + 0.05) < 4.5) for (let i = 0; i < 3; i++) readable[i] *= 0.94;
  const ink =
    '#' +
    readable
      .map((n) =>
        Math.round(n * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('');
  document.documentElement.style.setProperty('--tint', tint);
  document.documentElement.style.setProperty('--ink', ink);
  document.documentElement.style.setProperty('--rule', ink + '38');
  const rgb = [1, 3, 5]
    .map((i) =>
      Math.round(parseInt(ink.slice(i, i + 2), 16) * 0.55 + 255 * 0.45)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');
  document.documentElement.style.setProperty('--soft', '#' + rgb);
}
