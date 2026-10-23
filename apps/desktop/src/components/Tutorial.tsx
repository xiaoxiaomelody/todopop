import { useEffect, useRef, useState } from 'react';
import { PopDrops } from './PopDrops';
import { Button, TextInput } from '@todopop/ui';
export function Tutorial({ onDone }: { onDone(): void }) {
  const [step, setStep] = useState(0),
    [entered, setEntered] = useState(false),
    [edited, setEdited] = useState(false),
    [popped, setPopped] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const instructions = [
    'Your bubbles stay until you pop them.',
    'Click to enter a task.',
    'Double-click to edit.',
    'Right-click to pop.',
  ];
  return (
    <section className="tutorial" aria-label="TODOPOP tutorial">
      <div className="field-line">
        <span className="eyebrow">QUICK TOUR · {step + 1}/4</span>
        <button className="text-button" onClick={onDone}>
          Skip tour
        </button>
      </div>
      <h2>{instructions[step]}</h2>
      <p className="hint">Practice here. Your real tasks are untouched.</p>
      {step === 0 ? (
        <>
          <p>First O: create. Second O: finished tasks. Third O: tint & groups.</p>
          <Button onClick={() => setStep(1)}>Try it</Button>
        </>
      ) : entered ? (
        <div className="tutorial-billboard">
          <h3>Feed your pet</h3>
          <Button
            onClick={() => {
              setEntered(false);
              setStep(2);
            }}
          >
            Back · task stays
          </Button>
        </div>
      ) : edited ? (
        <div className="tutorial-editor">
          <TextInput aria-label="Practice task name" defaultValue="Feed your pet" />
          <p className="hint">Name · URL · Urgency · Group</p>
          <Button
            onClick={() => {
              setEdited(false);
              setStep(3);
            }}
          >
            Save practice edit
          </Button>
        </div>
      ) : popped ? (
        <>
          <div className="practice-pop">
            <PopDrops size={200} />
          </div>
          <p role="status">Popped! It’s in your receipt. You can undo a real Pop.</p>
          <Button variant="filled" onClick={onDone}>
            Start bubbling
          </Button>
        </>
      ) : (
        <button
          className="practice-bubble"
          aria-label="Practice bubble"
          onClick={(e) => {
            if (step === 1) {
              if (e.detail === 0) setEntered(true);
              else {
                if (timer.current) clearTimeout(timer.current);
                timer.current = setTimeout(() => setEntered(true), 350);
              }
            }
          }}
          onDoubleClick={() => {
            if (timer.current) clearTimeout(timer.current);
            if (step === 2) setEdited(true);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            if (timer.current) clearTimeout(timer.current);
            if (step === 3) setPopped(true);
          }}
        >
          Feed your pet
        </button>
      )}
      <p className="hint">
        No-link tasks focus locally. Linked tasks open their URL. Esc returns from focus.
      </p>
    </section>
  );
}
