import { useEffect } from 'react';
import popSound from '../assets/audio/bubble-pop.mp3?url';
let template: HTMLAudioElement | undefined;
const voices = new Set<HTMLAudioElement>();
function source() {
  if (!template) {
    template = new Audio(popSound);
    template.preload = 'auto';
  }
  return template;
}
export function playPopSound() {
  if (voices.size >= 4) {
    const oldest = voices.values().next().value;
    oldest?.pause();
    if (oldest) voices.delete(oldest);
  }
  const voice = source().cloneNode(true) as HTMLAudioElement;
  voice.volume = 0.6;
  voices.add(voice);
  const cleanup = () => voices.delete(voice);
  voice.addEventListener('ended', cleanup, { once: true });
  voice.addEventListener('error', cleanup, { once: true });
  void voice.play().catch(cleanup);
}
export function PopAudio() {
  useEffect(() => {
    source();
    return window.todopop.onPopSound(playPopSound);
  }, []);
  return null;
}
