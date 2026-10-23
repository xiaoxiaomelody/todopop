import { useEffect, useRef, useState } from 'react';
import { Bubble } from '../components/Bubble';
import { useTaskStore } from '../store/taskStore';
export function BubbleOverlay({ id }: { id: string }) {
  const task = useTaskStore((s) => s.tasks.find((t) => t.id === id));
  const last = useRef(task);
  if (task && !task.completed) last.current = task;
  const [popping, setPopping] = useState(false);
  useEffect(() => window.todopop.onPop(() => setPopping(true)), []);
  if (!last.current) return null;
  return <Bubble task={last.current} popping={popping} />;
}
