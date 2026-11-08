# TODOPOP for desktop

TODOPOP runs as a transparent layer over your whole screen. Your task bubbles float on top of every app, including Chrome in full screen. Clicks anywhere outside a bubble or the control panel pass straight through to the app underneath.

## Run it

You need Node.js 18 or newer (from nodejs.org). In a terminal, inside this folder:

```
npm install
npm start
```

The control panel is the TODOPOP logo itself, a little above the middle of your screen, in a white rounded rod with the same ink outline a bubble wears. Each popup is a wide, round card tucked under the logo, and the panel slides up a little when a tall card opens so it always fits.  Its three filled O's are the controls: hover one to see what it does.

## Using it

- **First O (+)**: blow a bubble. Under its name there's an optional **Task URL**: paste the page you'll work on (a Canvas assignment, a Google Doc), with or without `https://`. **Enter** walks you through the popup: name → URL → urgency (← → to slide it) → group (← → to pick, including **+ New**) → Enter once more blows the bubble. Enter on **+ New** opens the New group popup instead. Ctrl/⌘ + Enter blows it straight away. If you have no groups yet, the group step is skipped.
- **Deadline** (optional, like the Task URL): pick a date and time, or tap **Tonight** (11:59 PM) or **Tomorrow**. Tasks without one behave exactly as before. In a task's last day before its deadline, its urgency goes up one level by itself (Soon becomes Today, Today becomes NOW!). The bubble's caption shows "DUE FRI", then "DUE 11:59 PM" on the day and "DUE IN 3H" near the end. If the deadline passes, nothing turns red or fills the screen: the urgency goes back to what you picked and the caption just says "WAS DUE TUE". Change the date any time in the right-click editor; set the urgency yourself during that last day and the deadline leaves it alone.
- **Space**: if TODOPOP was the last thing you clicked, Space opens Blow a bubble from anywhere in the app (even when the panel is tucked away) with the cursor in the name field. Picking a group there also lights up that group's bubbles on screen. Along the bottom of the popup are your bubble tools: shuffle, pause growing, and the four line-up arrows.
- **Second O (✓)**: Popped, everything you've finished, by week or month.
- **Third O (half circle)**: Tint, your color. All three popups are part of the logo, so bubbles flow around whichever is open. While one is open, **← →** move to the next popup (unless you're typing in a field with text in it).
- One popup opens at a time; click its O again, or anywhere else, to close it. Drag the logo by its letters, or an open card by any empty space, to move it; double-click a letter to put it back.

- **Click** a bubble to get in it (focus mode). If it has a Task URL, that page opens in a new window of your normal browser at the same moment, filling the screen (Chrome, Edge, Brave, Vivaldi, Opera, Firefox and Safari are recognised; other browsers may open it as a tab). On a Mac, Chrome, Edge, Brave, Vivaldi and Safari are sized to the whole screen; the first time, macOS asks whether TODOPOP may control that browser, which is what lets it set the size. Elsewhere the browser picks the window's size (Chromium browsers on Windows and Linux are asked to start maximized). If it doesn't (feed the cat), its name sits in a card in the middle of the screen while you're inside, so you remember what you came in for; steps float around the card.
- **Double-click** a bubble to pop it (task done). A single click waits a moment, then gets you in. (To go back to press-and-hold, set `POP_GESTURE = 'hold'` in app/index.html.)
- Deleting a bubble is different from popping: it just shrinks away quietly. **Drag** to move it. **Right-click** to edit its name or urgency, or to delete it.
- **Click anywhere else** (another app, or empty screen) or press **Esc** to tuck the whole panel into a small TODOPOP button in the bottom-right corner. Click that button, or press **Ctrl/⌘ + Shift + Space**, to bring it back. Your bubbles stay on screen.
- **Ctrl + Shift + Space** (Windows) or **⌘ + Shift + Space** (Mac) also shows or hides the panel. The first few times the panel tucks away, a note reminds you of the shortcut, and hovering the small TODOPOP button shows it as keycaps. The TODOPOP icon in the menu bar (Mac) or system tray (Windows) does the same.
- At the top of **Floating**: the **shuffle** icon scatters your bubbles into a new random layout, and the four **arrows** slide them onto the left, top, bottom or right edge. Each bubble keeps its place along that edge (lining up left keeps its height), and overlapping ones ease apart.
- **Groups can live on a side of the screen.** Give a group a side (left, top, bottom, right, or the dots for "anywhere") from the side button on its row in **Edit groups**, or by right-clicking the group. Its bubbles slide straight across to that edge and stay at their place along it, easing apart where they'd overlap; new ones slide over from wherever they appear, and dragging a bubble along its edge moves it there. Shuffle and the arrows leave docked groups where they live.
- In **Popped**, click any finished task to bubble it again with the same name and urgency. Tasks you worked on in focus mode show their total focus time, and the summary adds up the week's or month's focus time.
- **Focus mode**: click a bubble (or right-click it and choose **Get in the bubble**). The bubble swells until it wraps your whole screen, then everything else disappears and a frame of your color, softly rounded on the inside, marks that you're inside it, and a small bar at the bottom times your session. **Done, pop it!** finishes the task; **×** leaves focus without popping. Time inside adds up: leave and come back later and the timer carries on from your total, which also shows on the bubble as a clock (like 3:56) on its own line under the urgency, and in its right-click menu. Bubbles you haven't been inside just show their urgency. Other bubbles stop growing while you focus.
- The **i** next to the slogan lists these gestures. Click any of the logo's three filled O's to open **Tint**: drag around the ring for the hue and up or down the bar beside it for saturation (grey to the most vivid ink that stays readable), or tap a preset. With Tint open, **← →** go around the ring and **↑ ↓** move the saturation bar. Click an O again to close it.
- **Groups**: there are none to start with. Under the urgency slider in **Blow a bubble**, click **+ New group**: a small popup asks for a name, a color (the same picker as right-clicking a group: the six tint colors plus the custom hue ring and saturation bar) and where its bubbles live (← → move along colors and sides, Enter makes it, Esc or a click outside cancels); you can make up to six, one per color. Pick a group and the bubble gets a second, thin ring of that color just inside its outline (shown a third see-through, like the group's dot). Under its urgency, the bubble also names its group: a small dot of the group's color and the group name (shortened with … if it doesn't fit). The ring wobbles with the bubble and turns dashed when growth is paused; the outline itself stays in your tint. Group colors follow your tint: the six choices are worked out from it, spread around the color wheel and kept clear of the tint itself, so they always sit well together; change your tint and your groups re-tune with it. **Right-click any group** (its chip, its filter in Floating, or its row in Edit groups) to pick one of the six; choosing one another group has swaps the two. The last, rainbow swatch opens a custom color picker: a hue ring with a saturation bar beside it. Slide the bar from soft grey (bottom) up to each hue's most intense color a screen can show (top): hot pink, electric blue, neon green. The whole ring re-colors as you slide, so you see every hue at that strength. A custom color stays put when you change your tint. It warns you if a hue sits too close to your tint or to another group. **Edit groups** lets you rename or delete a group. Right-click a bubble to move it into another group, or click **+ New** in that popup to name a new group on the spot; the bubble goes straight into it.
- **Floating** no longer lists your tasks; the bubbles on screen are the list. Tap a group there to make the other bubbles fade back while you look; tap it again (or **All**) to show everything. Popped tasks keep their group's dot, and bubbling one again keeps its group.
- **Steps (sub-bubbles)**: get in a bubble and click **+ Step** on the focus bar to break the task into steps. (You can drag the bar by its dots to the bottom left, middle or right, or to the left or right edge, where it turns vertical; it remembers the spot.) Inside, the steps float as small bubbles labeled with just their name; click one to pop it, no holding needed (Undo is on the note that appears). The side button next to **+ Step** slides a task's steps onto the left, top, bottom or right edge, each keeping its place along it (or lets them float); the task remembers it for next time. Steps don't grow, and there's only one level of them. From outside, the task shows how many are done (2/5) and a row of small beads on its outline, filled for each finished step. The beads sit on top, and slide round the outline to stay on screen when the top is out of view. Popping the last step asks whether to pop the whole task, and popping a task with steps left asks first. Right-click a step to rename or delete it. On the phone, steps are a checklist in the task's editor.
- **Pause growing**: in the Floating section, or from the tray menu (Pause growing → 30 minutes, 1 hour, until tomorrow morning, or until you resume). Paused bubbles get a dashed outline. **Resume** starts them growing again.
- **Screen full**: once bubbles cover about 90% of the screen (or are packed as tight as they'll go), they stop growing on their own. Pop one and they carry on.
- **The panel stays clear**: while it's open, bubbles flow around the control panel and press against it rather than covering it. The panel and the minimized TODOPOP button always sit above the bubbles.
- Bubbles grow only while TODOPOP is running and the computer is awake. Closing the lid pauses them; they pick up where they left off.
- The tray menu has **Start at login** and **Quit TODOPOP**.

## Phone app (optional)
TODOPOP works fully on its own; nothing here needs an account. To use it on your phone too: open the third O (Tint) and click **Get the phone app**. A QR code appears; point your phone's camera at it and TODOPOP opens on the phone already connected, sharing one list with your computer. Add, edit or pop on either and the other follows within a second (a task popped on the phone bursts on your computer). No email or password is involved: the computer makes a private account behind the scenes. **Show the code again** connects another phone; **Unpair** stops syncing (your list stays on the computer). Needs the Supabase details filled in (`SYNC_URL`, `SYNC_KEY` and `PHONE_URL` in `app/index.html`).

## Make an installer

On a Mac, `npm run dist:mac` creates a `.dmg` in `dist/`. On Windows, `npm run dist:win` creates a setup `.exe`. Each installer has to be built on its own platform.

The builds are not code-signed. On a Mac the first time you open the app, right-click it and choose Open. On Windows, choose More info → Run anyway.

## Good to know

- Bubbles appear on your main display.
- On Windows, TODOPOP sits in the taskbar like any other app. Clicking its icon opens the control panel (your bubbles stay put), and right-clicking it gives **Close window**, which quits TODOPOP. The bubbles never cover the taskbar.
- On a Mac, TODOPOP has no Dock icon because it is a floating layer. Use the menu bar icon instead.
- Games running in exclusive full-screen mode draw over everything, so bubbles won't show on top of those. Browsers, editors and other normal apps are fine.
- Tasks, groups, the archive and your theme colour are saved on your computer.

## Files

- `main.js`: the transparent always-on-top window, click-through, tray icon and shortcut
- `preload.js`: the small bridge the page uses to turn mouse capture on and off
- `openwin.js`: opens task links in a new window of your default browser
- `app/index.html`: the TODOPOP interface (the same page as the web demo)

## Language

TODOPOP speaks English and 简体中文. Pick one in the third O (under your color); the app reloads in that language and remembers it. A computer set to Chinese starts in Chinese. The tray menu follows the app's language.
<!-- TODOPOP: touched 2026-11-08 -->
