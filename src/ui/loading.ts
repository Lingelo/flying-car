/**
 * Loading screen (markup and style in index.html, so it shows before this bundle loads). Tasks are
 * weighted promises; the screen fades out once they have all settled and the city around the car
 * is built, or after `maxWaitMs` whatever happens: a failed texture keeps its procedural fallback
 * and must never keep the player out.
 */
export class LoadingScreen {
  private total = 0;
  private done = 0;
  private finished = false;
  /** Labels of the tasks still running, in the order they were tracked. */
  private readonly running: string[] = [];
  private readonly started = performance.now();

  constructor(
    private readonly root: HTMLElement | null = document.getElementById('loading'),
    private readonly maxWaitMs = 25_000,
  ) {}

  /** Counts a task; its label shows while it runs. Rejections count as done (fallbacks exist). */
  track<T>(label: string, task: Promise<T>, weight = 1): Promise<T> {
    this.total += weight;
    this.running.push(label);
    this.status(this.running[0]);
    const settle = () => {
      this.done += weight;
      this.running.splice(this.running.indexOf(label), 1);
      if (this.running.length) this.status(this.running[0]);
      this.fill(0.7 * this.progress);
    };
    task.then(settle, settle);
    return task;
  }

  /** Share of the tracked tasks that have settled, 0 to 1. */
  get progress(): number {
    return this.total ? this.done / this.total : 0;
  }

  /**
   * Called every frame with the city's readiness (0 to 1): hides the screen when everything is
   * ready, or when the wait has gone on too long.
   */
  update(cityReady: number): void {
    if (this.finished || !this.root) return;
    const tasksDone = this.total > 0 && this.done >= this.total;
    const share = 0.7 * this.progress + 0.3 * Math.min(1, cityReady);
    this.fill(share);
    if (tasksDone && cityReady >= 1) this.status('Prêt');
    else if (tasksDone) this.status('Construction des quartiers');
    if ((tasksDone && cityReady >= 1) || performance.now() - this.started > this.maxWaitMs) this.finish();
  }

  get visible(): boolean {
    return !this.finished;
  }

  private finish(): void {
    this.finished = true;
    this.fill(1);
    this.root?.classList.add('done');
    setTimeout(() => this.root?.remove(), 1000);
  }

  private fill(share: number): void {
    const el = this.root?.querySelector<HTMLElement>('[data-fill]');
    if (el) el.style.width = `${Math.round(Math.max(0, Math.min(1, share)) * 100)}%`;
  }

  private status(text: string): void {
    const el = this.root?.querySelector<HTMLElement>('[data-status]');
    if (el) el.textContent = text;
  }
}
