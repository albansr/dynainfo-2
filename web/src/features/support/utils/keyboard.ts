/** ⌘ + Enter (Mac) or Ctrl + Enter: send the text being written. */
export function isSubmitShortcut(event: { key: string; metaKey: boolean; ctrlKey: boolean }): boolean {
  return event.key === 'Enter' && (event.metaKey || event.ctrlKey);
}

/** Hint shown under the text boxes that support the shortcut. */
export const SUBMIT_SHORTCUT_HINT = 'Ctrl o ⌘ + Enter para enviar';
