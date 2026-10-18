/** Handling parameters, grouped here so the feel can be tuned in one place. */
export const TUNING = {
  /** Maximum altitude in metres (R4). */
  ceiling: 600,
  /** Duration of the take-off thruster deployment, in seconds (R3: at most 2 s). */
  takeoffTime: 1.5,
  retractTime: 0.8,
  takeoffClimb: 6,
  /** Lowest hover height in flight. */
  hoverMin: 1.5,
  boostSpeed: 1.45,
  boostAccel: 1.6,
  ground: {
    accel: 26,
    brake: 45,
    maxSpeed: 70,
    reverseSpeed: 15,
    turnRate: 2.2,
    grip: 50,
    driftGrip: 4,
    driftSpeed: 35,
  },
  flight: {
    accel: 32,
    brake: 30,
    maxSpeed: 110,
    reverseSpeed: 20,
    turnRate: 1.5,
    grip: 3.5,
    climbRate: 25,
    climbResponse: 3,
    landingSpeed: 45,
  },
} as const;
