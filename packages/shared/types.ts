export type FocusState = 'NORMAL' | 'FOCUS';
export type Urgency = 1 | 2 | 3 | 4;
export type Task = { id: string; title: string; url?: string; urgency: Urgency; completed: boolean };
export type BrowserContext = { type: 'CONTEXT_CHANGED'; browser: 'chrome'; isFocused: boolean; url: string | null };
