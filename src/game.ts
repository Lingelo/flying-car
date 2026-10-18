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
import { beaconsForChunk, lanesForChunk, type Beacon, type Lane } from './traffic/lanes';
import { TrafficSim } from './traffic/sim';
import { TrafficRender } from './traffic/trafficRender';
import { CarController, type CarState, type DriveInput } from './vehicle/controller';
import { MAX_TRAFFIC } from './settings/quality';
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
  /** Once per rendered frame. While paused, input edges meant for the simulation are dropped. */
  frame(paused?: boolean): void;
  /**
   * Places the car between the last two simulation steps (`alpha`), so motion stays smooth
   * whatever the display rate; returns that interpolated state for the camera.
   */
  render(alpha: number, frameDt: number): CarState;
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

  const traffic = new TrafficSim({ maxVehicles: MAX_TRAFFIC, seed, areaRadius: 450 });
  const trafficView = new TrafficRender(MAX_TRAFFIC);
  scene.add(trafficView.group);
  // Lanes and beacons are computed once per chunk and cached; the whole set is rebuilt at most
  // every 250 ms while streaming, not on every mount.
  const laneCache = new Map<string, { lanes: Lane[]; beacons: Beacon[] }>();
  let lastLaneRefresh = -Infinity;
  const refreshLanes = () => {
    const lanes = new Map<string, Lane>();
    const beacons: Beacon[] = [];
    for (const [key, { cx, cz }] of sink.loaded) {
      let cached = laneCache.get(key);
      if (!cached) laneCache.set(key, (cached = { lanes: lanesForChunk(cx, cz), beacons: beaconsForChunk(cx, cz) }));
      for (const lane of cached.lanes) lanes.set(lane.id, lane);
      for (const b of cached.beacons) beacons.push(b);
    }
    for (const key of laneCache.keys()) if (!sink.loaded.has(key)) laneCache.delete(key);
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
  let previous = { ...car.state.position, yaw: car.state.yaw };
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
    frame(paused = false) {
      input.update(firstGamepad());
      if (paused) toggleRequested = false;
      else if (input.pressed('toggleFlight')) toggleRequested = !toggleRequested;
      const f = car.forward();
      streamer.update(car.state.position.x, car.state.position.z, f.x, f.z);
      const now = performance.now();
      if (sink.changed && now - lastLaneRefresh > 250) {
        lastLaneRefresh = now;
        refreshLanes();
      }
      trafficView.update(traffic, simTime, car.state.position);
    },
    render(alpha, frameDt) {
      const s = car.state;
      const yawDelta = Math.atan2(Math.sin(s.yaw - previous.yaw), Math.cos(s.yaw - previous.yaw));
      const view: CarState = {
        ...s,
        position: {
          x: previous.x + (s.position.x - previous.x) * alpha,
          y: previous.y + (s.position.y - previous.y) * alpha,
          z: previous.z + (s.position.z - previous.z) * alpha,
        },
        yaw: previous.yaw + yawDelta * alpha,
      };
      visual.update(view, frameDt, input.axes.throttle < 0 && car.forwardSpeed > 1);
      return view;
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
      previous = { ...prev, yaw: car.state.yaw };
      car.state.floor = world.floorAt(prev.x, prev.z, prev.y);
      car.step(dt, game.autopilot ?? { throttle: input.axes.throttle, steer: input.axes.steer, lift: input.axes.lift, boost: input.isHeld('boost') });
      world.resolveCar(car, prev);
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
