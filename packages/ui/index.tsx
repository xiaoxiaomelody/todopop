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
