import type { DesktopApi } from '@todopop/shared';
declare global {
  interface Window {
    todopop: DesktopApi & {
      show(): void;
      closeEdit(): void;
      resizeEdit(height: number): void;
      hit(hit: boolean): void;
      onPop(callback: () => void): () => void;
      onPopSound(callback: () => void): () => void;
    };
  }
}
