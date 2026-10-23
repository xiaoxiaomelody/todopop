import type { DesktopApi } from '@todopop/shared';
declare global {
  interface Window {
    todopop: DesktopApi & { hit(hit: boolean): void; onPop(callback: () => void): () => void };
  }
}
