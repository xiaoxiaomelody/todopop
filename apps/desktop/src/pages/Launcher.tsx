import { BrandLogo } from '@todopop/ui';
export function Launcher() {
  return (
    <div className="launcher-shell">
      <button
        title="Open TODOPOP · ⌘⇧Space"
        aria-label="Open TODOPOP panel"
        onClick={() => window.todopop.show()}
      >
        <BrandLogo />
      </button>
    </div>
  );
}
