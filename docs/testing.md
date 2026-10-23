# Validation

See the current [detailed test report](testing-details.zh-CN.md) and [manual review list](manual-review.zh-CN.md).

Run `npm run typecheck`, `npm test`, and `npm run build` for static and shared-logic checks.
Run `npx playwright install chromium` once, then `npm run test:e2e` on a graphical
macOS desktop. The test starts its own local fixture server, temporary application
data directory, and disposable Chromium profile with the actual built extension.

The integration suite verifies:

- Creating a task through the real React form and opening its URL through a bubble click.
- Always-on-top, non-focusable bubble windows, pointer-driven drag, and saved positions.
- Rejection of website origins and incorrect pairing tokens.
- Authenticated URL/focus transitions, inactive Chrome, and disconnected fallback.
- Real Manifest V3 worker pairing, navigation, tab switching, and switching to Electron.
- Snooze, explicit completion, restart persistence, and archive restoration.
- Task editing/deletion, all four urgency sizes, loaded local assets, and corrupt-file recovery.
- No renderer exceptions during these flows.

The latest passing result is recorded in `e2e-result.json`. Test fixture URLs and
tokens are ephemeral. Normal user tasks and the normal Chrome profile are not used.
Screenshots are captured from the actual Electron renderers.

## Live demo

1. Start TODOPOP and load/pair the built extension in Chrome.
2. Create two tasks, each with a distinct ordinary HTTP(S) page or Google Doc URL.
3. Verify both bubbles float above the desktop and drag them to different positions.
4. Click a linked bubble. When its page becomes active, both bubbles should hide.
5. Switch to an unrelated tab, then another app: bubbles should return without focus theft.
6. Return to either task page: bubbles should hide again.
7. From Floating, complete the focused task; focus should remain only if another active task matches.
8. Hover a bubble and click ✓. Verify its pop animation and Popped entry.
9. Quit/restart TODOPOP. Confirm completed tasks, positions, and pairing are retained.
10. Restore a popped task and confirm its bubble returns.

Multi-monitor unplugging, full-screen Spaces on every macOS version, and installer
signing/distribution still need hardware/release-specific manual checks. Bubble
positions are clamped to a currently available display when created or dragged.
