import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import { Landing } from './pages/Landing';
import { BubbleOverlay } from './pages/BubbleOverlay';
import { connectStore } from './store/taskStore';
import '@todopop/ui/styles.css';
import './styles.css';
const id = new URLSearchParams(location.hash.slice(1)).get('bubble');
document.body.classList.toggle('bubble-window', Boolean(id));
connectStore();
createRoot(document.getElementById('root')!).render(
  <MotionConfig reducedMotion="user">{id ? <BubbleOverlay id={id} /> : <Landing />}</MotionConfig>,
);
