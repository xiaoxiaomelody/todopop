import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { applyTheme } from '@todopop/ui';
import { MotionConfig } from 'motion/react';
import { Billboard } from './pages/Billboard';
import { Landing } from './pages/Landing';
import { BubbleOverlay } from './pages/BubbleOverlay';
import { EditPopover } from './pages/EditPopover';
import { Launcher } from './pages/Launcher';
import { useTaskStore, connectStore } from './store/taskStore';
import '@todopop/ui/styles.css';
import './styles.css';
const id = new URLSearchParams(location.hash.slice(1)).get('bubble');
const billboardId = new URLSearchParams(location.hash.slice(1)).get('billboard');
const launcher = location.hash === '#launcher';
const editId = new URLSearchParams(location.hash.slice(1)).get('edit');
document.body.classList.toggle('bubble-window', Boolean(id) || launcher);
function Theme() {
  const tint = useTaskStore((s) => s.settings.tint);
  useEffect(() => {
    applyTheme(tint);
    const resize = () =>
      document.documentElement.style.setProperty('--work-height', `${window.screen.availHeight}px`);
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [tint]);
  return null;
}
connectStore();
createRoot(document.getElementById('root')!).render(
  <MotionConfig reducedMotion="user">
    <Theme />
    {id ? (
      <BubbleOverlay id={id} />
    ) : billboardId ? (
      <Billboard id={billboardId} />
    ) : editId ? (
      <EditPopover id={editId} />
    ) : launcher ? (
      <Launcher />
    ) : (
      <Landing />
    )}
  </MotionConfig>,
);

import './advanced.css';
