/// <reference path="./assets.d.ts" />
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import logoO from './assets/logo-o.svg';
export function BrandLogo() {
  return (
    <div className="logo" aria-label="TODOPOP">
      {['T', 'O', 'D', 'O', 'P', 'O', 'P'].map((letter, index) =>
        letter === 'O' ? (
          <img key={index} src={logoO} alt="" width="24.08" height="21.77" />
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
  document.documentElement.style.setProperty('--ink', tint);
  document.documentElement.style.setProperty('--rule', tint + '38');
  const rgb = [1, 3, 5]
    .map((i) =>
      Math.round(parseInt(tint.slice(i, i + 2), 16) * 0.55 + 255 * 0.45)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');
  document.documentElement.style.setProperty('--soft', '#' + rgb);
}
