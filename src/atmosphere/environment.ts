import { advanceHour, DEFAULT_DAY_LENGTH } from './time';

/** Time of day (and, later, weather): the single state every material and light reads (KTD9). */
export class Environment {
  hour = 21.5;
  dayLength = DEFAULT_DAY_LENGTH;
  /** When false, the hour stays where the settings put it. */
  autoTime = true;

  update(dt: number): void {
    if (this.autoTime) this.hour = advanceHour(this.hour, dt, this.dayLength);
  }
}
