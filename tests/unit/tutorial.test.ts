import { describe, it, expect } from 'vitest';
import { TutorialDirector, hintFlag } from '../../src/quests/TutorialDirector';
import { tutorialHints } from '../../game-data/quests/tutorial';
import { chunks } from '../../game-data/zones/laboratory';
const context = (
  x: number,
  flags = new Set<string>(),
  abilities: string[] = [],
  wounded = false,
) => ({
  x,
  flags,
  abilities: new Set(abilities),
  wounded,
});
describe('Contextual tutorial', () => {
  it('shows the hint of the current area only once its requirements are met', () => {
    const t = new TutorialDirector();
    expect(t.update(context(5))?.id).toBe('move');
    expect(t.update(context(30))?.id).toBe('attack');
    expect(t.update(context(30, new Set(), ['dash']))?.id).toBe('dash');
    expect(t.update(context(86))).toBeNull();
    expect(t.update(context(86, new Set(), ['remanence']))?.id).toBe('remanence');
    // At the edge of the rift, once the Seconde impulsion is recovered.
    expect(t.update(context(285))).toBeNull();
    expect(t.update(context(285, new Set(), ['double-jump']))?.id).toBe('double');
  });
  it('retires a hint once the action is performed, anywhere, and remembers it in flags', () => {
    const t = new TutorialDirector();
    const flags = new Set<string>();
    expect(t.update(context(18, flags))?.id).toBe('jump');
    expect(t.perform('jump', flags)).toEqual(['jump']);
    expect(flags.has(hintFlag('jump'))).toBe(true);
    expect(t.update(context(18, flags))).toBeNull();
    // Attacking before reaching the combat area skips its prompt.
    t.perform('attack', flags);
    expect(t.update(context(30, flags))).toBeNull();
    expect(t.perform('attack', flags)).toEqual([]);
  });
  it('offers Recueillement only while wounded, and hides pointless hints', () => {
    const t = new TutorialDirector();
    const flags = new Set(['tutorial:attack']);
    expect(t.update(context(150, flags))).toBeNull();
    expect(t.update(context(150, flags, [], true))?.id).toBe('heal');
    expect(t.update(context(130, flags, ['memory-step']))?.id).toBe('echo');
    flags.add('echo-gate-open');
    expect(t.update(context(130, flags, ['memory-step']))).toBeNull();
  });
  it('validates hint data and keeps every band inside the world', () => {
    expect(new Set(tutorialHints.map((h) => h.id)).size).toBe(tutorialHints.length);
    for (const hint of tutorialHints) {
      expect(hint.from).toBeLessThan(hint.to);
      expect(hint.from).toBeGreaterThanOrEqual(0);
      expect(hint.to).toBeLessThanOrEqual(chunks.at(-1)!.end);
    }
  });
});
