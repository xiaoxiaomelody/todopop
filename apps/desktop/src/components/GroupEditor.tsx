import { useState } from 'react';
import { ActionGlyph } from '@todopop/ui';
import { groupColor, slotHue, defaultWheelSat, type Side } from '@todopop/shared';
import { useTaskStore } from '../store/taskStore';
import { RingColorPicker } from './RingColorPicker';
export function SideGlyph({ side }: { side: Side }) {
  const paths = {
    left: 'M2.5 2.5v11M13.5 8H6M9 5L6 8l3 3',
    right: 'M13.5 2.5v11M2.5 8H10M7 5l3 3-3 3',
    top: 'M2.5 2.5h11M8 13.5V6M5 9l3-3 3 3',
    bottom: 'M2.5 13.5h11M8 2.5V10M5 7l3 3 3-3',
  };
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
      {side === 'any' ? (
        <g fill="currentColor" transform="translate(-0.3 0.2)">
          {[
            [4, 5],
            [11.5, 3.8],
            [7.2, 10.6],
            [12.6, 11.8],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="1.4" />
          ))}
        </g>
      ) : (
        <path
          d={paths[side]}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
const sides: Side[] = ['any', 'left', 'top', 'bottom', 'right'];
export function GroupEditor({
  selected,
  onSelect,
  initialEdit = false,
}: {
  selected?: string | null;
  onSelect?: (id: string | null) => void;
  initialEdit?: boolean;
}) {
  const s = useTaskStore(),
    [editing, setEditing] = useState(initialEdit),
    [picker, setPicker] = useState<string | null>(null),
    [custom, setCustom] = useState(false),
    [problem, setProblem] = useState('');
  const choose = (id: string | null) => {
    onSelect?.(id);
    void s.run(() => window.todopop.selectGroup(id));
  };
  async function add() {
    setEditing(true);
    if (await s.run(() => window.todopop.groups('create', { name: 'New group' }))) {
      const groups = (await window.todopop.snapshot()).groups;
      const id = groups[groups.length - 1].id;
      requestAnimationFrame(() => {
        const input = document.querySelector<HTMLInputElement>(`[data-group-row="${id}"] input`);
        input?.focus();
        input?.select();
      });
    }
  }
  return (
    <div className="prototype-groups">
      <div className="grp-top">
        <span className="eyebrow">Group</span>
        <button type="button" className="text-button" onClick={() => setEditing(!editing)}>
          {editing ? 'Done' : 'Edit groups'}
        </button>
      </div>
      {!editing ? (
        <div className="chips prototype-group-chips">
          <button type="button" aria-pressed={!selected} onClick={() => choose(null)}>
            No group
          </button>
          {s.groups.map((g) => (
            <button
              key={g.id}
              type="button"
              aria-label={g.name}
              aria-pressed={selected === g.id}
              onClick={() => choose(g.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                setPicker(g.id);
                setCustom(g.color.kind !== 'palette');
              }}
            >
              <i style={{ background: groupColor(g.color, s.settings.tint) }} />
              {g.name}
            </button>
          ))}
          <button type="button" className="add" onClick={() => void add()}>
            + Add a group
          </button>
        </div>
      ) : (
        <ul className="prototype-group-rows">
          {s.groups.map((g) => (
            <li
              key={g.id}
              data-group-row={g.id}
              className={selected === g.id ? 'selected-group' : ''}
              onContextMenu={(e) => {
                e.preventDefault();
                setPicker(g.id);
                setCustom(g.color.kind !== 'palette');
              }}
            >
              <button
                className="group-color-dot"
                type="button"
                aria-label={`Change color ${g.name}`}
                style={{ background: groupColor(g.color, s.settings.tint) }}
                onClick={() => {
                  setPicker(picker === g.id ? null : g.id);
                  setCustom(g.color.kind !== 'palette');
                  choose(g.id);
                }}
              />
              <input
                aria-label={`Group name ${g.name}`}
                defaultValue={g.name}
                maxLength={24}
                onBlur={(e) => {
                  const name = e.target.value.trim();
                  if (name && name !== g.name)
                    void s.run(() => window.todopop.groups('update', { id: g.id, name }));
                  else e.target.value = g.name;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.currentTarget.blur();
                  }
                }}
              />
              <button
                className="group-side-icon"
                type="button"
                aria-label={`Position ${g.name}: ${g.side}`}
                title={`Position: ${g.side}. Click to change.`}
                onClick={() => {
                  const side = sides[(sides.indexOf(g.side) + 1) % sides.length];
                  void s.run(() => window.todopop.groups('update', { id: g.id, side }));
                }}
              >
                <SideGlyph side={g.side} />
              </button>
              <button
                type="button"
                className="group-remove"
                aria-label={`Remove group ${g.name}`}
                onClick={() => void s.run(() => window.todopop.groups('delete', { id: g.id }))}
              >
                <ActionGlyph name="close" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <button type="button" className="add group-add" onClick={() => void add()}>
          + Add a group
        </button>
      )}
      {picker &&
        (() => {
          const g = s.groups.find((g) => g.id === picker);
          if (!g) return null;
          const h =
            g.color.kind === 'palette'
              ? slotHue(g.color.slot, s.settings.tint)
              : g.color.kind === 'wheel'
                ? g.color.h
                : undefined;
          const wheel =
            h === undefined
              ? undefined
              : { h, s: g.color.kind === 'wheel' ? g.color.saturation : defaultWheelSat(h) };
          return (
            <div className="group-color-card" aria-label={`Colors for ${g.name}`}>
              <div className="field-line">
                <span className="eyebrow">{g.name}</span>
                <button type="button" className="text-button" onClick={() => setPicker(null)}>
                  Close
                </button>
              </div>
              <div className="group-color-swatches">
                {Array.from({ length: 6 }, (_, slot) => (
                  <button
                    key={slot}
                    type="button"
                    aria-label={`Group color ${slot + 1}`}
                    aria-pressed={g.color.kind === 'palette' && g.color.slot === slot}
                    style={{ background: groupColor({ kind: 'palette', slot }, s.settings.tint) }}
                    onClick={() =>
                      void s.run(() =>
                        window.todopop.groups('update', {
                          id: g.id,
                          color: { kind: 'palette', slot },
                        }),
                      )
                    }
                  />
                ))}
                <button
                  type="button"
                  className="custom-color-button"
                  aria-label="Custom group color"
                  onClick={() => setCustom(!custom)}
                />
              </div>
              <div className="side-buttons">
                {sides.map((side) => (
                  <button
                    key={side}
                    type="button"
                    aria-label={`Set ${g.name} ${side}`}
                    aria-pressed={g.side === side}
                    onClick={() =>
                      void s.run(() => window.todopop.groups('update', { id: g.id, side }))
                    }
                  >
                    <SideGlyph side={side} />
                  </button>
                ))}
              </div>
              {custom && (
                <RingColorPicker
                  mode="group"
                  label={g.name}
                  value={groupColor(g.color, s.settings.tint)}
                  wheel={wheel}
                  onChange={(hex) =>
                    void s.run(() =>
                      window.todopop.groups('update', { id: g.id, color: { kind: 'custom', hex } }),
                    )
                  }
                  onWheelChange={(v) =>
                    s.run(() =>
                      window.todopop.groups('update', {
                        id: g.id,
                        color: { kind: 'wheel', h: v.h, saturation: v.s },
                      }),
                    )
                  }
                />
              )}
              <p className="hint">
                {g.color.kind === 'palette'
                  ? 'These six follow your tint. A color in use swaps.'
                  : 'Custom color. It stays put when you change your tint.'}
              </p>
            </div>
          );
        })()}
      {problem && <p role="alert">{problem}</p>}
    </div>
  );
}
