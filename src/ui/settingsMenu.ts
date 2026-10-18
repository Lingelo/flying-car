import { NIGHT_END, NIGHT_START, toNightHour } from '../atmosphere/time';
import { WEATHER_KINDS, WEATHER_LABELS, type WeatherKind } from '../atmosphere/weather';

/** The hour slider covers the night only: 0 is NIGHT_START, NIGHT_SPAN is NIGHT_END. */
const NIGHT_SPAN = NIGHT_END + 24 - NIGHT_START;
const nightOffset = (hour: number) => (toNightHour(hour) - NIGHT_START + 24) % 24;
import { ACTIONS, ACTION_LABELS, DEFAULT_BINDINGS, rebind, type Bindings } from '../input/bindings';
import type { KeyboardSource } from '../input/keyboard';
import { QUALITY_LABELS, QUALITY_NAMES } from '../settings/quality';
import type { Settings } from '../settings/store';
import { formatHour } from './hud';
import { keyLabel } from './keys';

export interface MenuCallbacks {
  onSettings(settings: Settings): void;
  onBindings(bindings: Bindings): void;
  onClose(): void;
}

/** Pause menu: quality, time of day, weather, volumes and key bindings (R23, R6). */
export class SettingsMenu {
  readonly root = document.createElement('div');
  private settings: Settings;
  private bindings: Bindings;
  isOpen = false;

  constructor(
    parent: HTMLElement,
    settings: Settings,
    bindings: Bindings,
    private readonly keyboard: KeyboardSource,
    private readonly callbacks: MenuCallbacks,
  ) {
    this.settings = { ...settings };
    this.bindings = bindings;
    this.root.className = 'menu';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-label', 'Menu');
    parent.appendChild(this.root);
    this.render();
  }

  /** Current hour shown when the cycle is switched off. */
  liveHour = 21.5;

  open(): void {
    this.isOpen = true;
    this.render();
    this.root.classList.add('open');
    if (document.pointerLockElement) document.exitPointerLock();
  }

  close(): void {
    this.isOpen = false;
    this.keyboard.capture = null;
    this.root.classList.remove('open');
    this.callbacks.onClose();
  }

  private update(patch: Partial<Settings>): void {
    this.settings = { ...this.settings, ...patch };
    this.callbacks.onSettings(this.settings);
    this.render();
  }

  private render(): void {
    const s = this.settings;
    const hour = s.hour ?? this.liveHour;
    this.root.innerHTML = `
      <div class="menu-panel">
        <h1>NEON CITY</h1>
        <p class="sub">Bac à sable voiture volante · pause</p>

        <h2>Graphismes</h2>
        <div class="menu-row"><span>Qualité</span><div class="segmented">
          ${QUALITY_NAMES.map((q) => `<button data-quality="${q}" class="${s.quality === q ? 'active' : ''}">${QUALITY_LABELS[q]}</button>`).join('')}
        </div></div>

        <h2>Ambiance</h2>
        <div class="menu-row"><span>Heure</span><div class="inline">
          <button data-hour-auto class="${s.hour === null ? 'active' : ''}">Nuit qui avance</button>
          <input type="range" min="0" max="${NIGHT_SPAN}" step="0.25" value="${nightOffset(hour)}" data-hour aria-label="Heure de la nuit" />
          <output>${formatHour(hour)}</output>
        </div></div>
        <div class="menu-row"><span>Météo</span><div class="segmented">
          <button data-weather="auto" class="${s.weather === null ? 'active' : ''}">Dynamique</button>
          ${WEATHER_KINDS.map((w) => `<button data-weather="${w}" class="${s.weather === w ? 'active' : ''}">${WEATHER_LABELS[w]}</button>`).join('')}
        </div></div>

        <h2>Son</h2>
        <div class="menu-row"><span>Volume général</span><div class="inline"><input type="range" min="0" max="1" step="0.05" value="${s.masterVolume}" data-master aria-label="Volume général" /><output>${Math.round(s.masterVolume * 100)} %</output></div></div>
        <div class="menu-row"><span>Radio</span><div class="inline"><input type="range" min="0" max="1" step="0.05" value="${s.musicVolume}" data-music aria-label="Volume radio" /><output>${Math.round(s.musicVolume * 100)} %</output></div></div>

        <h2>Touches</h2>
        <div class="keys">
          ${ACTIONS.map((a) => `<span>${ACTION_LABELS[a]}</span><button data-bind="${a}">${this.bindings[a].map(keyLabel).join(' / ')}</button>`).join('')}
        </div>
        <p class="credits">Manette : gâchettes = accélérer / freiner, stick gauche = diriger, RB / LB = monter / descendre, Y = sol / vol, A = boost.<br>
        Ville, voitures, enseignes, sons et musique générés par le code. Inspiré du style des roadsters électriques ; design original.</p>

        <div class="actions">
          <button data-reset-keys>Touches par défaut</button>
          <button class="primary" data-close>REPRENDRE</button>
        </div>
      </div>`;

    const on = <T extends Element>(selector: string, event: string, handler: (el: T, e: Event) => void) =>
      this.root.querySelectorAll<T>(selector).forEach((el) => el.addEventListener(event, (e) => handler(el, e)));
    on<HTMLButtonElement>('[data-quality]', 'click', (el) => this.update({ quality: el.dataset.quality as Settings['quality'] }));
    on<HTMLButtonElement>('[data-hour-auto]', 'click', () => this.update({ hour: s.hour === null ? this.liveHour : null }));
    on<HTMLInputElement>('[data-hour]', 'input', (el) => {
      const h = (NIGHT_START + Number(el.value)) % 24;
      this.settings = { ...this.settings, hour: h };
      (el.nextElementSibling as HTMLOutputElement).textContent = formatHour(h);
      this.root.querySelector('[data-hour-auto]')?.classList.remove('active');
      this.callbacks.onSettings(this.settings);
    });
    on<HTMLButtonElement>('[data-weather]', 'click', (el) => this.update({ weather: el.dataset.weather === 'auto' ? null : (el.dataset.weather as WeatherKind) }));
    const volume = (selector: string, key: 'masterVolume' | 'musicVolume') =>
      on<HTMLInputElement>(selector, 'input', (el) => {
        this.settings = { ...this.settings, [key]: Number(el.value) };
        (el.nextElementSibling as HTMLOutputElement).textContent = `${Math.round(Number(el.value) * 100)} %`;
        this.callbacks.onSettings(this.settings);
      });
    volume('[data-master]', 'masterVolume');
    volume('[data-music]', 'musicVolume');
    on<HTMLButtonElement>('[data-bind]', 'click', (el) => {
      el.classList.add('capturing');
      el.textContent = 'Appuyez sur une touche…';
      this.keyboard.capture = (code) => {
        // Escape cancels the rebinding, except for the menu action itself.
        if (code !== 'Escape' || el.dataset.bind === 'menu') {
          this.bindings = rebind(this.bindings, el.dataset.bind as (typeof ACTIONS)[number], code);
          this.callbacks.onBindings(this.bindings);
        }
        this.render();
      };
    });
    on<HTMLButtonElement>('[data-reset-keys]', 'click', () => {
      this.bindings = structuredClone(DEFAULT_BINDINGS);
      this.callbacks.onBindings(this.bindings);
      this.render();
    });
    on<HTMLButtonElement>('[data-close]', 'click', () => this.close());
  }
}
