import { motion } from 'motion/react';
import popDrop from '../assets/figma/pop-drop.svg';
// Figma Bubble/Popped: ten outlined droplets, label/body disappear before Gone.
export function PopDrops({ size }: { size: number }) {
  const dropSize = Math.max(8, Math.min(18, size * 0.028));
  return (
    <>
      {Array.from({ length: 10 }, (_, i) => {
        const angle = ((i * 36 - 90) * Math.PI) / 180;
        return (
          <motion.div
            key={i}
            className="figma-pop-drop"
            style={{ margin: -dropSize / 2 }}
            data-node-id={`11:${347 + i}`}
            initial={{
              x: Math.cos(angle) * size * 0.34,
              y: Math.sin(angle) * size * 0.34,
              opacity: 1,
            }}
            animate={{
              x: Math.cos(angle) * size * 0.47,
              y: Math.sin(angle) * size * 0.47,
              opacity: [1, 1, 0],
            }}
            transition={{ duration: 0.48, times: [0, 0.6, 1], ease: 'easeOut' }}
          >
            <img src={popDrop} width={dropSize} height={dropSize} alt="" />
          </motion.div>
        );
      })}
    </>
  );
}
