import * as THREE from 'three';
import { CityView, type ChunkHandle } from './city/cityView';
import { districtAt, CHUNK_SIZE, BLOCK_SIZE, type Box } from './city/generator';
import { WorkerChunkSource, type ChunkPayload } from './city/payload';
import { ChunkStreamer, type ChunkSink } from './city/streamer';
import { Input } from './input/actions';
import { firstGamepad } from './input/gamepad';
import { KeyboardSource, bindPointerLock } from './input/keyboard';
import { loadBindings } from './input/bindings';
import { CollisionWorld } from './physics/collide';
import { beaconsForChunk, lanesForChunk, type Lane } from './traffic/lanes';
import { TrafficSim } from './traffic/sim';
import { TrafficRender } from './traffic/trafficRender';
import { CarController, type DriveInput } from './vehicle/controller';
import { createCarVisual, type CarVisual } from './vehicle/carModel';

/** Static collision boxes of a chunk: building tiers and skywalks. */
function chunkBoxes(payload: ChunkPayload): Box[] {
  return [...payload.chunk.buildings.flatMap((b) => b.tiers), ...payload.chunk.walkways];
}

/** City view that also feeds the collision world. */
class CollidingCity implements ChunkSink<ChunkPayload, ChunkHandle> {
  constructor(
    readonly view: CityView,
    private readonly world: CollisionWorld,
  ) {}
  private keys = new Map<ChunkHandle, string>();
  /** Loaded chunk coordinates, so traffic lanes and beacons follow the streamed area. */
  readonly loaded = new Map<string, { cx: number; cz: number }>();
  changed = false;
  mount(payload: ChunkPayload, lod: boolean): ChunkHandle {
    const key = `${payload.cx},${payload.cz}`;
    this.world.addStatic(key, chunkBoxes(payload));
    const h = this.view.mount(payload, lod);
    this.keys.set(h, key);
    this.loaded.set(key, { cx: payload.cx, cz: payload.cz });
    this.changed = true;
    return h;
  }
  unmount(h: ChunkHandle): void {
    const key = this.keys.get(h);
    if (key) {
      this.world.removeStatic(key);
      this.loaded.delete(key);
      this.changed = true;
    }
    this.keys.delete(h);
    this.view.unmount(h);
  }
  setLod(h: ChunkHandle, lod: boolean): void {
    this.view.setLod(h, lod);
  }
}

/** Spawn on an avenue of the nearest neon-district chunk, facing along it. */
export function spawnPoint(seed: number): { x: number; z: number } {
  for (let r = 0; r < 30; r++)
    for (let cx = -r; cx <= r; cx++)
      for (let cz = -r; cz <= r; cz++) {
        if (Math.max(Math.abs(cx), Math.abs(cz)) !== r) continue;
        if (districtAt(seed, cx, cz) === 'neon') return { x: cx * CHUNK_SIZE + 3, z: cz * CHUNK_SIZE + BLOCK_SIZE / 2 };
      }
  return { x: 3, z: BLOCK_SIZE / 2 };
}

export interface Game {
  car: CarController;
  visual: CarVisual;
  input: Input;
  keyboard: KeyboardSource;
  world: CollisionWorld;
  traffic: TrafficSim;
  trafficView: TrafficRender;
  streamer: ChunkStreamer<ChunkPayload, ChunkHandle>;
  city: CityView;
  /** When set, drives the car instead of the player (benchmark flight). */
  autopilot: DriveInput | null;
  /** Fixed-step simulation. */
  step(dt: number): void;
  /** Once per rendered frame, before the simulation steps. */
  frame(): void;
}

export async function createGame(scene: THREE.Scene, canvas: HTMLCanvasElement, seed: number): Promise<Game> {
  const world = new CollisionWorld();
  const city = new CityView();
  scene.add(city.root);
  const sink = new CollidingCity(city, world);
  const streamer = new ChunkStreamer(new WorkerChunkSource(seed), sink, {
    radius: 5,
    lodRadius: 3,
    maxMountsPerFrame: 2,
    maxInFlight: 6,
  });

  const spawn = spawnPoint(seed);
  const car = new CarController({ x: spawn.x, y: 0, z: spawn.z }, 0);
  const visual = await createCarVisual();
  scene.add(visual.root);

  const traffic = new TrafficSim({ maxVehicles: 260, seed, areaRadius: 450 });
  const trafficView = new TrafficRender(260);
  scene.add(trafficView.group);
  const refreshLanes = () => {
    const lanes = new Map<string, Lane>();
    const beacons = [];
    for (const { cx, cz } of sink.loaded.values()) {
      for (const lane of lanesForChunk(cx, cz)) lanes.set(lane.id, lane);
      beacons.push(...beaconsForChunk(cx, cz));
    }
    traffic.setLanes([...lanes.values()]);
    trafficView.setLanes([...lanes.values()]);
    trafficView.setBeacons(beacons);
    sink.changed = false;
  };
  let simTime = 0;

  const keyboard = new KeyboardSource();
  const input = new Input(keyboard, loadBindings(safeLocalStorage()));
  bindPointerLock(canvas, (dx, dy) => input.addMouseDelta(dx, dy));

  let toggleRequested = false;
  const game: Game = {
    car,
    visual,
    input,
    keyboard,
    world,
    traffic,
    trafficView,
    streamer,
    city,
    autopilot: null,
    frame() {
      input.update(firstGamepad());
      if (input.pressed('toggleFlight')) toggleRequested = true;
      const f = car.forward();
      streamer.update(car.state.position.x, car.state.position.z, f.x, f.z);
      if (sink.changed) refreshLanes();
      trafficView.update(traffic, simTime, car.state.position);
    },
    step(dt) {
      if (toggleRequested) {
        car.toggleFlight();
        toggleRequested = false;
      }
      simTime += dt;
      const s = car.state;
      traffic.setPlayer({ ...s.position, vx: s.velocity.x, vy: s.velocity.y, vz: s.velocity.z });
      traffic.step(dt, simTime);
      world.setVehicles(traffic.obstaclesNear(s.position, 40));
      const prev = { ...car.state.position };
      car.state.floor = world.floorAt(prev.x, prev.z, prev.y);
      car.step(dt, game.autopilot ?? { throttle: input.axes.throttle, steer: input.axes.steer, lift: input.axes.lift, boost: input.isHeld('boost') });
      world.resolveCar(car, prev);
      visual.update(car.state, dt, input.axes.throttle < 0 && car.forwardSpeed > 1);
    },
  };
  return game;
}

export function safeLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
