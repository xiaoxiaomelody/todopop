# Design implementation

Source: https://www.figma.com/design/51bGy6oFsJV6YJa9jvBKIT/TODOPOP

Pages: `brainstorm` (0:1) and `TODOPOP prototype` (11:2).
Design context and screenshots were retrieved with the connected Figma plugin.

| Element          | Figma node                    | Implementation                                                   |
| ---------------- | ----------------------------- | ---------------------------------------------------------------- |
| Landing panel    | 14:3, panel 14:6              | `src/pages/Landing.tsx`                                          |
| Create form      | 14:25                         | `src/components/TaskForm.tsx`                                    |
| Urgency picker   | 12:2, 12:20, 12:56            | `src/components/UrgencyPicker.tsx`                               |
| Current task row | 12:110                        | `src/components/TaskList.tsx`                                    |
| Edit popover     | 24:1938                       | Editable title, URL, urgency, predefined group, delete/save/open |
| Bubble family    | 11:27, 11:117, 11:208, 11:303 | Four native window sizes: 118, 192, 298, 446                     |
| Hover reference  | 11:63                         | Spring squash and slow idle float                                |

The panel uses the design’s 348px component width for readable desktop controls.
The landing composition scales that panel to 70%; it is not a fixed full-screen app.
The blue ink, light rules, rounded white panel, filled O logo assets, Unbounded
variable font, vector bodies, inner rings, pop icon, grips, and urgency knob assets
are local files. No temporary Figma URLs are referenced at runtime.

The browser backdrop (24:1903) explicitly documents itself as a stand-in for the
user’s current app. TODOPOP does not render fake browser chrome over the desktop.
The main window resizes around the panel; every bubble is a separate small,
transparent window, with pointer forwarding outside the bubble’s interactive area.

The technical plan specifies click-to-open and explicit completion. Those semantics
win over the prototype component’s click-to-pop description. Completion triggers
an animated burst and archive entry; a plain click never completes the task.
Urgency determines initial size. Time-based growth and custom tint controls are
not part of the supplied P0 scope.

Snapshots from integration testing: `screenshots/panel.png` and `screenshots/bubble.png`.
