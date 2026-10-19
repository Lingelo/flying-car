import { advanceNightHour, DEFAULT_DAY_LENGTH } from './time';
import { Weather } from './weather';

/** Night hour and weather: the single state every material and light reads (KTD9). */
export class Environment {
  hour = 21.5;
  dayLength = DEFAULT_DAY_LENGTH;
  /** When false, the hour stays where the settings put it. */
  autoTime = true;
  readonly weather: Weather;

  constructor(seed = 1) {
    this.weather = new Weather(seed, 'clear');
  }

  update(dt: number): void {
    if (this.autoTime) this.hour = advanceNightHour(this.hour, dt, this.dayLength);
    this.weather.step(dt);
  }
}
