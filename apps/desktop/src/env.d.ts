import type { DesktopApi, Rect } from '@todopop/shared';
declare global {
  interface Window {
    todopop: DesktopApi & {
      show(): void;
      closeEdit(): void;
      resizeEdit(height: number): void;
      hit(hit: boolean): void;
      bubbleViewport(): Promise<Rect | null>;
      onBubbleViewport(callback: (rect: Rect | null) => void): () => void;
      onPop(callback: () => void): () => void;
    };
  }
}
