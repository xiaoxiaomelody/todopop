import { useEffect, useState } from 'react';
import { Bubble } from '../components/Bubble';
import { useTaskStore } from '../store/taskStore';
export function BubbleOverlay({ id }: { id: string }) {
  const task = useTaskStore((s) => s.tasks.find((t) => t.id === id));
  const [popping, setPopping] = useState(false);
  useEffect(() => window.todopop.onPop(() => setPopping(true)), []);
  if (!task) return null;
  return <Bubble task={task} popping={popping} />;
}
