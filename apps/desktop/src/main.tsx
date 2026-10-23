import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { applyTheme } from '@todopop/ui';
import { MotionConfig } from 'motion/react';
import { Landing } from './pages/Landing';
import { BubbleOverlay } from './pages/BubbleOverlay';
import { EditPopover } from './pages/EditPopover';
import { Launcher } from './pages/Launcher';
import { useTaskStore, connectStore } from './store/taskStore';
import '@todopop/ui/styles.css';
import './styles.css';
const id = new URLSearchParams(location.hash.slice(1)).get('bubble');
const launcher = location.hash === '#launcher';
const editId = new URLSearchParams(location.hash.slice(1)).get('edit');
document.body.classList.toggle('bubble-window', Boolean(id) || launcher);
function Theme() {
  const tint = useTaskStore((s) => s.settings.tint);
  useEffect(() => {
    applyTheme(tint);
  }, [tint]);
  return null;
}
connectStore();
createRoot(document.getElementById('root')!).render(
  <MotionConfig reducedMotion="user">
    <Theme />
    {id ? (
      <BubbleOverlay id={id} />
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
