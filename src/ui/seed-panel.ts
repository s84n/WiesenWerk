import { TEXTS } from '../data/texts';

/**
 * Kleines Feld zum Eingeben oder Würfeln eines Seeds.
 * Vorläufig für Phase 1; wandert in Phase 4 ins Hauptmenü.
 */
export class SeedPanel {
  private readonly input: HTMLInputElement;

  constructor(
    parent: HTMLElement,
    seed: number,
    onGenerate: (seed: number) => void,
    roll: () => number,
  ) {
    const panel = document.createElement('div');
    panel.className = 'panel seed-panel';

    const label = document.createElement('label');
    label.textContent = TEXTS.seed.label;
    this.input = document.createElement('input');
    this.input.type = 'number';
    this.input.min = '1';
    this.input.value = String(seed);
    label.appendChild(this.input);

    const rollBtn = document.createElement('button');
    rollBtn.className = 'button small secondary';
    rollBtn.textContent = TEXTS.seed.roll;
    rollBtn.title = TEXTS.seed.rollTooltip;
    rollBtn.addEventListener('click', () => {
      const s = roll();
      this.input.value = String(s);
      onGenerate(s);
      rollBtn.blur();
    });

    const genBtn = document.createElement('button');
    genBtn.className = 'button small';
    genBtn.textContent = TEXTS.seed.generate;
    genBtn.title = TEXTS.seed.generateTooltip;
    const generate = (): void => {
      const s = Math.max(1, Math.floor(Number(this.input.value) || 1));
      this.input.value = String(s);
      onGenerate(s);
      genBtn.blur();
      this.input.blur();
    };
    genBtn.addEventListener('click', generate);
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') generate();
    });

    panel.append(label, rollBtn, genBtn);
    parent.appendChild(panel);
  }
}
