// PlayStation / Xbox controller support (standard Gamepad API mapping). In game, buttons become the engine's own
// +action/-action console commands and the right stick moves the view; in menus, the sticks move the cursor.

// Standard mapping button indices (PlayStation names; Xbox: cross = A, circle = B, square = X, triangle = Y).
const BUTTON = { cross: 0, circle: 1, square: 2, triangle: 3, l1: 4, r1: 5, l2: 6, r2: 7, share: 8, options: 9, l3: 10, r3: 11, up: 12, down: 13, left: 14, right: 15 };

// Held buttons: "+action" on press, "-action" on release.
const HELD_ACTIONS = new Map([
  [BUTTON.cross, "gostand"], // jump
  [BUTTON.square, "usereload"], // reload; hold to use, buy or revive
  [BUTTON.l1, "smoke"], // special grenade
  [BUTTON.r1, "frag"], // grenade
  [BUTTON.l2, "speed_throw"], // aim down sights
  [BUTTON.r2, "attack"], // fire
  [BUTTON.share, "scores"],
  [BUTTON.r3, "melee"],
]);
const DPAD_SLOTS = new Map([[BUTTON.up, 1], [BUTTON.down, 2], [BUTTON.left, 3], [BUTTON.right, 4]]);

// Engine key codes and analog movement axes used with _KB_Input.
const KEY = { escape: 27, up: 154, down: 155, left: 156, right: 157, mouse1: 200 };
const AXIS_KEY = { forward: 301, back: 302, moveleft: 303, moveright: 304 };
const INPUT = { key: 0, mouseMove: 2, cursor: 4 };

const MOVE_DEADZONE = 0.16;
const LOOK_DEADZONE = 0.12;
const TRIGGER_THRESHOLD = 0.35;
const PRONE_HOLD_MS = 350;
const MAX_COMMAND_LENGTH = 900;

/** View speed (pixels of mouse motion per second at full tilt) for each aim level the card offers. */
export const AIM_SPEEDS = [400, 600, 800, 1000, 1250, 1500, 1800, 2100, 2500, 3000];

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

/** Stick position with a radial dead zone, rescaled so movement starts smoothly at its edge. */
function stick(pad, xAxis, yAxis, deadzone) {
  const x = pad.axes[xAxis] ?? 0;
  const y = pad.axes[yAxis] ?? 0;
  const magnitude = Math.hypot(x, y);
  if (magnitude < deadzone) return [0, 0];
  const scaled = Math.min(1, (magnitude - deadzone) / (1 - deadzone));
  return [(x / magnitude) * scaled, (y / magnitude) * scaled];
}

export class Gamepad {
  /**
   * @param engine () => { Module, command(text) } while the player is in a game, otherwise null
   * @param canvasSize () => { width, height }
   */
  constructor({ engine, canvasSize, aimLevel = 4 }) {
    this.engine = engine;
    this.canvasSize = canvasSize;
    this.aimLevel = aimLevel;
    this.status = "none"; // none | waiting | active
    this.name = "";
    this.previous = [];
    this.held = new Set();
    this.movement = { forward: 0, back: 0, moveleft: 0, moveright: 0 };
    this.sprinting = false;
    this.circleDownAt = 0;
    this.wentProne = false;
    this.lookRemainder = [0, 0];
    this.cursor = null;
    this.commands = [];
    this.lastFrame = 0;
    this.running = false;
  }

  start() {
    if (this.running) return;
    this.running = true;
    const frame = (time) => {
      if (!this.running) return;
      try {
        this.update(time);
      } catch (error) {
        this.status = `error: ${error.message}`;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    addEventListener("blur", () => this.releaseAll());
  }

  findPad() {
    const pads = [...(navigator.getGamepads?.() ?? [])].filter((pad) => pad?.connected);
    return pads.find((pad) => pad.mapping === "standard") ?? pads[0] ?? null;
  }

  update(time) {
    const dt = this.lastFrame ? Math.min(0.1, (time - this.lastFrame) / 1000) : 0;
    this.lastFrame = time;
    const pad = this.findPad();
    if (!pad) {
      if (this.status !== "none") this.releaseAll();
      this.status = "none";
      return;
    }
    this.name = pad.id;
    const engine = this.engine();
    if (!engine) {
      this.status = "waiting";
      return;
    }
    this.status = "active";

    const down = pad.buttons.map((button, i) => (i === BUTTON.l2 || i === BUTTON.r2 ? button.value > TRIGGER_THRESHOLD : button.pressed));
    const pressed = (i) => down[i] && !this.previous[i];
    const released = (i) => !down[i] && this.previous[i];
    if (engine.Module._KB_UIState?.() & 1) {
      this.releaseGameplay();
      this.menuInput(engine, pad, pressed, released, dt);
    } else {
      this.cursor = null;
      this.gameInput(engine, pad, down, pressed, released, dt);
    }
    this.previous = down;
    this.flush(engine);
  }

  gameInput(engine, pad, down, pressed, released, dt) {
    for (const [button, action] of HELD_ACTIONS) {
      if (pressed(button)) this.press(action);
      if (released(button)) this.release(action);
    }
    for (const [button, slot] of DPAD_SLOTS) {
      if (pressed(button)) this.commands.push(`+actionslot ${slot}`);
      if (released(button)) this.commands.push(`-actionslot ${slot}`);
    }
    if (pressed(BUTTON.triangle)) this.commands.push("weapnext");
    if (pressed(BUTTON.options)) this.tap(engine, KEY.escape);

    // Circle: tap to crouch, hold to go prone.
    if (pressed(BUTTON.circle)) {
      this.circleDownAt = performance.now();
      this.wentProne = false;
    }
    if (down[BUTTON.circle] && !this.wentProne && performance.now() - this.circleDownAt > PRONE_HOLD_MS) {
      this.commands.push("toggleprone");
      this.wentProne = true;
    }
    if (released(BUTTON.circle) && !this.wentProne) this.commands.push("togglecrouch");

    const [mx, my] = stick(pad, 0, 1, MOVE_DEADZONE);
    this.setMovement("forward", Math.max(0, -my));
    this.setMovement("back", Math.max(0, my));
    this.setMovement("moveleft", Math.max(0, -mx));
    this.setMovement("moveright", Math.max(0, mx));
    // L3 sprints until the stick comes back near the centre.
    if (pressed(BUTTON.l3) && !this.sprinting) {
      this.commands.push("+breath_sprint");
      this.sprinting = true;
    }
    if (this.sprinting && Math.hypot(mx, my) < 0.3) {
      this.commands.push("-breath_sprint");
      this.sprinting = false;
    }

    // Right stick as mouse motion, with an exponent for fine aim near the centre (halved while aiming down sights).
    const [lx, ly] = stick(pad, 2, 3, LOOK_DEADZONE);
    const tilt = Math.hypot(lx, ly);
    if (tilt > 0) {
      const speed = ((AIM_SPEEDS[this.aimLevel] * tilt ** 1.6) / tilt) * (down[BUTTON.l2] ? 0.5 : 1);
      this.lookRemainder[0] += lx * speed * dt;
      this.lookRemainder[1] += ly * speed * dt;
      const dx = Math.trunc(this.lookRemainder[0]);
      const dy = Math.trunc(this.lookRemainder[1]);
      this.lookRemainder[0] -= dx;
      this.lookRemainder[1] -= dy;
      if (dx || dy) engine.Module._KB_Input(INPUT.mouseMove, dx, dy);
    }
  }

  menuInput(engine, pad, pressed, released, dt) {
    const size = this.canvasSize();
    this.cursor ??= [size.width / 2, size.height / 2];
    const [ax, ay] = stick(pad, 0, 1, MOVE_DEADZONE);
    const [bx, by] = stick(pad, 2, 3, LOOK_DEADZONE);
    const vx = ax || bx;
    const vy = ay || by;
    if (vx || vy) {
      const speed = size.height * 1.1;
      this.cursor[0] = clamp(this.cursor[0] + vx * speed * dt, 0, size.width - 1);
      this.cursor[1] = clamp(this.cursor[1] + vy * speed * dt, 0, size.height - 1);
      engine.Module._KB_Input(INPUT.cursor, Math.round(this.cursor[0]), Math.round(this.cursor[1]));
    }
    if (pressed(BUTTON.cross)) engine.Module._KB_Input(INPUT.key, KEY.mouse1, 1);
    if (released(BUTTON.cross)) engine.Module._KB_Input(INPUT.key, KEY.mouse1, 0);
    if (pressed(BUTTON.circle) || pressed(BUTTON.options)) this.tap(engine, KEY.escape);
    for (const [button, key] of [[BUTTON.up, KEY.up], [BUTTON.down, KEY.down], [BUTTON.left, KEY.left], [BUTTON.right, KEY.right]]) {
      if (pressed(button)) this.tap(engine, key);
    }
  }

  press(action) {
    if (this.held.has(action)) return;
    this.held.add(action);
    this.commands.push(`+${action}`);
  }

  release(action) {
    if (this.held.delete(action)) this.commands.push(`-${action}`);
  }

  tap(engine, key) {
    engine.Module._KB_Input(INPUT.key, key, 1);
    engine.Module._KB_Input(INPUT.key, key, 0);
  }

  /** Analog movement: "+forward <key> 0 <amount>" with the amount rounded to 5% steps to limit traffic. */
  setMovement(direction, amount) {
    const rounded = Math.round(amount * 20) / 20;
    if (rounded === this.movement[direction]) return;
    this.movement[direction] = rounded;
    this.commands.push(rounded > 0 ? `+${direction} ${AXIS_KEY[direction]} 0 ${rounded}` : `-${direction} ${AXIS_KEY[direction]}`);
  }

  releaseGameplay() {
    for (const action of [...this.held]) this.release(action);
    for (const direction of Object.keys(this.movement)) this.setMovement(direction, 0);
    if (this.sprinting) {
      this.commands.push("-breath_sprint");
      this.sprinting = false;
    }
  }

  releaseAll() {
    this.releaseGameplay();
    this.previous = [];
    const engine = this.engine();
    if (engine) this.flush(engine);
  }

  /** Sends queued commands as one ";"-joined line per frame; kept for later while the previous line is pending. */
  flush(engine) {
    if (!this.commands.length) return;
    if (this.commands.length > 200) this.commands.splice(0, this.commands.length - 200);
    let count = 0;
    let length = 0;
    while (count < this.commands.length && length + this.commands[count].length + 1 < MAX_COMMAND_LENGTH) length += this.commands[count++].length + 1;
    if (engine.command(this.commands.slice(0, count).join(";"))) this.commands.splice(0, count);
  }
}
