const NAMES: Record<string, string> = {
  Space: 'Espace',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  ShiftLeft: 'Maj G',
  ShiftRight: 'Maj D',
  ControlLeft: 'Ctrl G',
  ControlRight: 'Ctrl D',
  AltLeft: 'Alt',
  Escape: 'Échap',
  Enter: 'Entrée',
  Tab: 'Tab',
  Backspace: 'Retour',
};

/** Human label of a KeyboardEvent.code ('KeyW' → 'W'). */
export function keyLabel(code: string): string {
  if (NAMES[code]) return NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Pavé ${code.slice(6)}`;
  return code;
}
