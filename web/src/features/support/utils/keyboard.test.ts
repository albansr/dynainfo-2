import { describe, it, expect } from 'vitest';
import { isSubmitShortcut } from './keyboard';

describe('isSubmitShortcut', () => {
  it('is Enter with ⌘ or Ctrl, never Enter alone', () => {
    expect(isSubmitShortcut({ key: 'Enter', metaKey: true, ctrlKey: false })).toBe(true);
    expect(isSubmitShortcut({ key: 'Enter', metaKey: false, ctrlKey: true })).toBe(true);
    expect(isSubmitShortcut({ key: 'Enter', metaKey: false, ctrlKey: false })).toBe(false);
    expect(isSubmitShortcut({ key: 'a', metaKey: true, ctrlKey: false })).toBe(false);
  });
});
