import { useRef, useState } from 'react';
import { Button, TextInput } from '@todopop/ui';
import { PALETTE, groupColor, type Side } from '@todopop/shared';
import { RingColorPicker } from './RingColorPicker';
import { useTaskStore } from '../store/taskStore';
const themes = [
  ['Ink Blue', '#1a419e'],
  ['Berry', '#9c1c31'],
  ['Teal', '#078b86'],
  ['Graphite', '#292929'],
];
export function Appearance() {
  const s = useTaskStore(),
    [name, setName] = useState(''),
    [editing, setEditing] = useState<string | null>(null),
    [renamed, setRenamed] = useState('');
  const moving = useRef(false);
  return (
    <div className="appearance-content">
      <span className="eyebrow">Tint</span>
      <div className="theme-swatches">
        {themes.map(([label, color]) => (
          <button
            key={label}
            title={label}
            aria-label={`Tint ${label}`}
            aria-pressed={s.settings.tint === color}
            style={{ background: color }}
            onClick={() => {
              void s.run(() => window.todopop.setSettings({ tint: color }));
            }}
          />
        ))}
        <code>{s.settings.tint.toUpperCase()}</code>
      </div>
      {!editing && (
        <RingColorPicker
          label="Tint"
          value={s.settings.tint}
          onChange={(tint) => void s.run(() => window.todopop.setSettings({ tint }))}
        />
      )}
      <div className="field-line">
        <span className="eyebrow">Groups</span>
        <span className="hint">Select a group to edit and highlight.</span>
      </div>
      <div className="group-list">
        {s.groups.map((group) => (
          <div key={group.id}>
            <button
              className="group-row"
              aria-pressed={s.selectedGroupId === group.id}
              onClick={() => {
                void s.run(() =>
                  window.todopop.selectGroup(s.selectedGroupId === group.id ? null : group.id),
                );
                setEditing(editing === group.id ? null : group.id);
                setRenamed(group.name);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setEditing(group.id);
                setRenamed(group.name);
              }}
            >
              <i style={{ background: groupColor(group.color, s.settings.tint) }} />
              <span>{group.name}</span>
              <small>{group.side === 'any' ? 'Anywhere' : group.side}</small>
              <span>···</span>
            </button>
            {editing === group.id && (
              <div className="group-editor">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void s.run(() =>
                      window.todopop.groups('update', { id: group.id, name: renamed }),
                    );
                  }}
                >
                  <TextInput
                    aria-label="Group name"
                    value={renamed}
                    maxLength={24}
                    onChange={(e) => setRenamed(e.target.value)}
                  />
                  <Button type="submit">Rename</Button>
                </form>
                <div className="group-palette">
                  {PALETTE.map((_, slot) => (
                    <button
                      key={slot}
                      aria-label={`Group color ${slot + 1}`}
                      aria-pressed={group.color.kind === 'palette' && group.color.slot === slot}
                      style={{ background: groupColor({ kind: 'palette', slot }, s.settings.tint) }}
                      onClick={() => {
                        void s.run(() =>
                          window.todopop.groups('update', {
                            id: group.id,
                            color: { kind: 'palette', slot },
                          }),
                        );
                      }}
                    />
                  ))}
                </div>
                <RingColorPicker
                  label={group.name}
                  value={groupColor(group.color, s.settings.tint)}
                  onChange={(hex) =>
                    void s.run(() =>
                      window.todopop.groups('update', {
                        id: group.id,
                        color: { kind: 'custom', hex },
                      }),
                    )
                  }
                />
                <button
                  type="button"
                  className="group-move-handle"
                  aria-label={`Move group ${group.name}`}
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    moving.current = true;
                    void s.run(async () => {
                      await window.todopop.selectGroup(group.id);
                      if (moving.current) window.todopop.dragGroup('start', e.screenX, e.screenY);
                    });
                  }}
                  onPointerMove={(e) => {
                    if (moving.current) window.todopop.dragGroup('move', e.screenX, e.screenY);
                  }}
                  onPointerUp={(e) => {
                    moving.current = false;
                    window.todopop.dragGroup('end', e.screenX, e.screenY);
                  }}
                  onPointerCancel={(e) => {
                    moving.current = false;
                    window.todopop.dragGroup('end', e.screenX, e.screenY);
                  }}
                >
                  ↔ Drag to move this group
                </button>
                <div className="side-buttons">
                  {(['any', 'left', 'top', 'bottom', 'right'] as Side[]).map((side) => (
                    <button
                      key={side}
                      aria-pressed={group.side === side}
                      onClick={() => {
                        void s.run(() => window.todopop.groups('update', { id: group.id, side }));
                      }}
                    >
                      {side === 'any'
                        ? 'Any'
                        : ({ left: '←', top: '↑', bottom: '↓', right: '→' } as const)[side]}
                    </button>
                  ))}
                </div>
                <p className="hint">
                  Preset colors follow Tint. A color in use swaps; custom colors stay put.
                </p>
                <Button
                  variant="text"
                  onClick={async () => {
                    if (await s.run(() => window.todopop.groups('delete', { id: group.id })))
                      setEditing(null);
                  }}
                >
                  Remove group · tasks move to No group
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
      <form
        className="new-group-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await s.run(() => window.todopop.groups('create', { name }))) setName('');
        }}
      >
        <TextInput
          aria-label="New group name"
          placeholder="New group name"
          value={name}
          maxLength={24}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" disabled={!name.trim()}>
          + New
        </Button>
      </form>
    </div>
  );
}
