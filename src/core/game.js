// Orquestrador: liga input, sessão, simulação (workers), combate, zona, render, áudio e UI.
import * as THREE from 'three';
import { BALANCE, IS_MOBILE, PRESETS } from '../config/settings.js';
import {
  CHARACTER_COUNT, ENTITY_COUNT, F, FIRST_VEHICLE, FLAG_CROUCH, FLAG_IN_VEHICLE, PLAYER_SLOT, slotOffset,
} from './layout.js';
import { GameLoop } from './loop.js';
import { Input } from './input.js';
import { LocalSession } from './net.js';
import { loadSave, writeSave } from './save.js';
import { generateWorld } from './worldgen.js';
import { Simulation } from '../systems/simulation.js';
import { Combat } from '../systems/combat.js';
import { Zone } from '../systems/zone.js';
import { Audio } from '../systems/audio.js';
import { Renderer } from '../render/renderer.js';
import { WorldView } from '../render/world.js';
import { EntitiesView } from '../render/entities.js';
import { CharactersView } from '../render/characters.js';
import { Effects } from '../render/effects.js';
import { setupLoaders } from '../render/assets.js';
import { Hud } from '../ui/hud.js';
import { DebugOverlay } from '../ui/debug.js';
import { createBalanceGui } from '../ui/gui.js';
import { setupTouch } from '../ui/touch.js';

const AI_EVERY = 3; // IA a 20 Hz (60 / 3)
const name = (slot) => (slot === PLAYER_SLOT ? 'Você' : slot < 0 ? 'Zona' : `Bot ${slot}`);

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.balance = { ...BALANCE };
    this.session = new LocalSession();
    this.input = new Input(canvas);
    this.renderer = new Renderer(canvas);
    this.sim = new Simulation(this.balance);
    this.combat = new Combat(this.balance, this.session);
    this.zone = new Zone(this.balance);
    this.hud = new Hud();
    this.debug = new DebugOverlay();
    this.gen = generateWorld();
    this.loop = new GameLoop((dt) => this.fixedUpdate(dt), (a, dt) => this.render(a, dt));
    this.tick = 0;
    this.playing = false;
    this.onMatchEnd = null;

    // Objetos reaproveitados (zero alocação no loop)
    this.axes = { x: 0, z: 0 };
    this.stepInput = { mx: 0, mz: 0, yaw: 0, jump: false, sprint: false, crouch: false, throttle: 0, steer: 0, brake: false };
    this.shot = { ox: 0, oy: 0, oz: 0, dx: 0, dy: 0, dz: 0 };
    this.playerPos = new THREE.Vector3();
    this.camTarget = new THREE.Vector3();
    this.camForward = new THREE.Vector3();
    this.tmp = new THREE.Vector3();
    this.camDist = 4.2;
    this.frameNo = 0;
    this.eyeH = 1.6; // altura da câmera (desce ao agachar)
    this.crosshair = document.getElementById('crosshair');
    this.lastCrouch = false;
  }

  async init(progress) {
    progress('Iniciando renderer…');
    await this.renderer.init();
    setupLoaders(this.renderer.renderer);
    const scene = this.renderer.scene;
    this.worldView = new WorldView(scene);
    this.entities = new EntitiesView(scene);
    this.characters = new CharactersView(scene);
    this.effects = new Effects(scene);
    progress('Iniciando física e IA…');
    await this.sim.init();
    this.save = await loadSave();
    this.gui = createBalanceGui(this.balance, () => this.syncBalance());
    if (IS_MOBILE) setupTouch(this.input);
    this.session.onEvent((ev) => this.onEvent(ev));
    // Compila os shaders antes de jogar (evita travadas no primeiro frame)
    progress('Compilando shaders…');
    await this.renderer.renderer.compileAsync(scene, this.renderer.camera);
    progress(`Pronto (${this.renderer.backend}, ${this.sim.shared ? 'SharedArrayBuffer' : 'Transferable'})`);
  }

  syncBalance() { this.sim.setBalance({ ...this.balance }); }

  setPreset(key) {
    const p = PRESETS[key];
    this.presetKey = key;
    this.renderer.applyPreset(p);
    this.worldView.setQuality(p);
    this.characters.setQuality(p);
  }

  /** Limite de FPS (0 = sem limite). A resolução dinâmica passa a mirar esse FPS. */
  setFpsLimit(fps) {
    this.loop.maxFps = fps;
    this.renderer.fpsTarget = fps || 60;
    this.save.fpsLimit = fps;
  }

  /** Começa (ou recomeça) uma partida: reseta combate/zona e respawna todos. */
  startMatch() {
    this.combat.reset();
    this.zone.reset();
    for (let i = 0; i < CHARACTER_COUNT; i++) {
      const sp = i === PLAYER_SLOT ? { x: 0, z: 0 } : this.gen.spawns[(i * 7 + this.save.matches) % this.gen.spawns.length];
      this.sim.send({ type: 'alive', slot: i, alive: true, x: sp.x, z: sp.z });
      this.characters.onRespawn(i);
    }
    this.playing = true;
    this.hud.show(true);
    if (!IS_MOBILE) this.input.lock();
    this.loop.start();
  }

  inVehicle() { return ((this.sim.curr[slotOffset(PLAYER_SLOT) + F.FLAGS] | 0) & FLAG_IN_VEHICLE) !== 0; }

  /** Lógica em passo fixo de 60 Hz. */
  fixedUpdate(dt) {
    const inp = this.input, st = this.sim.curr;
    if (inp.consume('F1')) this.debug.toggle();
    if (inp.consume('F2')) this.gui._hidden ? this.gui.show() : this.gui.hide();
    if (!this.playing) { inp.pressed.clear(); return; }

    const alive = this.combat.alive[PLAYER_SLOT] === 1;
    const inCar = this.inVehicle();
    if (inp.consume('KeyR') && this.combat.startReload()) this.audio?.play('reload');
    if (inp.consume('KeyE') && alive) this.toggleVehicle(inCar);

    // Input -> direção no mundo, relativa ao yaw da câmera (frente = -Z)
    inp.axes(this.axes);
    const s = this.stepInput, yaw = inp.yaw;
    const sin = Math.sin(yaw), cos = Math.cos(yaw);
    s.mx = alive ? cos * this.axes.x - sin * this.axes.z : 0;
    s.mz = alive ? -sin * this.axes.x - cos * this.axes.z : 0;
    s.yaw = yaw;
    // Correr ou pular cancela o agachar
    if (inp.crouch && (inp.consume('Space') || inp.keys.has('ShiftLeft'))) inp.crouch = false;
    if (inCar || !alive) inp.crouch = false;
    s.crouch = inp.crouch;
    s.jump = alive && !inp.crouch && inp.keys.has('Space');
    s.sprint = inp.keys.has('ShiftLeft');
    s.throttle = this.axes.z; s.steer = -this.axes.x; s.brake = inp.keys.has('Space');
    this.session.sendInput(s);
    this.sim.step(dt, s);

    if (++this.tick % AI_EVERY === 0) this.sim.think(dt * AI_EVERY, this.zone.view);

    // Tiro do jogador: raio sai da câmera, passando pela mira
    let shot = null;
    if (inp.fire && alive && !inCar) {
      const cam = this.renderer.camera;
      const f = this.camForward;
      const skip = this.camDist; // começa na altura do jogador para não acertar o que está atrás dele
      this.shot.ox = cam.position.x + f.x * skip; this.shot.oy = cam.position.y + f.y * skip; this.shot.oz = cam.position.z + f.z * skip;
      this.shot.dx = f.x; this.shot.dy = f.y; this.shot.dz = f.z;
      shot = this.shot;
    }
    this.combat.update(dt, st, this.sim.intentsView, shot);

    // Zona
    this.zone.update(dt);
    for (let i = 0; i < CHARACTER_COUNT; i++) {
      if (!this.combat.alive[i]) continue;
      const o = slotOffset(i);
      if (this.zone.isOutside(st[o + F.X], st[o + F.Z])) this.combat.damage(i, this.balance.zoneDps * dt, -1);
    }

    this.updateHud(alive, inCar);
  }

  toggleVehicle(inCar) {
    if (inCar) { this.sim.send({ type: 'vehicle', action: 'exit' }); return; }
    const st = this.sim.curr, p = slotOffset(PLAYER_SLOT);
    for (let i = FIRST_VEHICLE; i < ENTITY_COUNT; i++) {
      const o = slotOffset(i);
      if (Math.hypot(st[o + F.X] - st[p + F.X], st[o + F.Z] - st[p + F.Z]) < 4) {
        this.sim.send({ type: 'vehicle', action: 'enter', vehicle: i - FIRST_VEHICLE });
        return;
      }
    }
  }

  nearVehicle() {
    const st = this.sim.curr, p = slotOffset(PLAYER_SLOT);
    for (let i = FIRST_VEHICLE; i < ENTITY_COUNT; i++) {
      const o = slotOffset(i);
      if (Math.hypot(st[o + F.X] - st[p + F.X], st[o + F.Z] - st[p + F.Z]) < 4) return true;
    }
    return false;
  }

  /** HUD: os Fields só tocam o DOM se o valor mudou. */
  updateHud(alive, inCar) {
    const h = this.hud, c = this.combat, w = c.weapon;
    h.setHealth(c.health[PLAYER_SLOT], this.balance.maxHealth);
    h.alive.set(c.aliveCount);
    h.kills.set(c.kills[PLAYER_SLOT]);
    h.ammo.set(w.reload > 0 ? 'Recarregando…' : `${w.mag} / ${w.reserve}`);
    const rem = Math.ceil(this.zone.remaining);
    h.zone.set(rem > 0 ? `Zona fecha em ${Math.floor(rem / 60)}:${String(rem % 60).padStart(2, '0')}` : 'Zona fechada');
    const o = slotOffset(PLAYER_SLOT);
    const outside = this.zone.isOutside(this.sim.curr[o + F.X], this.sim.curr[o + F.Z]);
    h.hint.set(!alive ? '' : inCar ? 'E para sair do veículo' : this.nearVehicle() ? 'E para dirigir'
      : outside ? '⚠ Fora da zona! Volte para dentro' : '');
  }

  onEvent(ev) {
    const a = this.audio;
    if (ev.type === 'shot') {
      // Traçante sai da arma do atirador, não da câmera
      const o = slotOffset(ev.shooter), st = this.sim.curr;
      this.effects.tracer(st[o + F.X], st[o + F.Y] + 1.35, st[o + F.Z], ev.ex, ev.ey, ev.ez);
      this.effects.burst(ev.ex, ev.ey, ev.ez, ev.hitSlot >= 0 ? 0xd12b2b : 0xcfc6a8, ev.hitSlot >= 0 ? 10 : 5);
      a?.play('shot', st[o + F.X], st[o + F.Y] + 1.4, st[o + F.Z], ev.shooter === PLAYER_SLOT ? 0.5 : 0.8);
    } else if (ev.type === 'hit') {
      if (ev.attacker === PLAYER_SLOT) {
        const h = this.combat.hit;
        this.hud.spawnDamage(h.ex, h.ey + 0.3, h.ez, ev.amount, ev.head);
        a?.play('hit', undefined, undefined, undefined, 0.6);
      }
    } else if (ev.type === 'kill') {
      this.characters.onDeath(ev.slot);
      this.sim.send({ type: 'alive', slot: ev.slot, alive: false });
      this.hud.pushFeed(`${name(ev.attacker)} ⟶ ${name(ev.slot)}`);
      if (ev.attacker === PLAYER_SLOT) a?.play('kill');
      if (ev.slot === PLAYER_SLOT) this.endMatch(false);
      else if (this.combat.alive[PLAYER_SLOT] && this.combat.aliveCount === 1) this.endMatch(true);
    } else if (ev.type === 'empty') a?.play('empty');
  }

  async endMatch(won) {
    if (!this.playing) return;
    this.playing = false;
    const kills = this.combat.kills[PLAYER_SLOT];
    const s = this.save;
    s.matches++; s.kills += kills; if (won) s.wins++;
    s.bestKills = Math.max(s.bestKills, kills);
    s.preset = this.presetKey;
    s.fpsLimit = this.loop.maxFps;
    await writeSave(s);
    document.exitPointerLock?.();
    this.onMatchEnd?.(won, kills, s);
  }

  /** Render livre: interpola entidades, posiciona câmera, efeitos e HUD de dano. */
  render(alpha, frameDt) {
    this.debug.begin();
    const sim = this.sim, prev = sim.prev, curr = sim.curr, o = slotOffset(PLAYER_SLOT);
    const inCar = this.inVehicle();
    let fx = 0, fy = 0, fz = 0;
    if (inCar) {
      const v = slotOffset(curr[o + F.A] + FIRST_VEHICLE);
      fx = prev[v] + (curr[v] - prev[v]) * alpha; fy = prev[v + 1] + (curr[v + 1] - prev[v + 1]) * alpha;
      fz = prev[v + 2] + (curr[v + 2] - prev[v + 2]) * alpha;
    } else {
      fx = prev[o] + (curr[o] - prev[o]) * alpha; fy = prev[o + 1] + (curr[o + 1] - prev[o + 1]) * alpha;
      fz = prev[o + 2] + (curr[o + 2] - prev[o + 2]) * alpha;
    }
    this.playerPos.set(fx, fy, fz);

    // Câmera em terceira pessoa por cima do ombro (mais longe dentro do veículo)
    const cam = this.renderer.camera, yaw = this.input.yaw, pitch = this.input.pitch;
    const targetDist = inCar ? 9 : 4.2;
    this.camDist += (targetDist - this.camDist) * Math.min(1, frameDt * 5);
    const cp = Math.cos(pitch);
    this.camForward.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
    const shoulder = inCar ? 0 : 0.6;
    const crouched = ((curr[o + F.FLAGS] | 0) & FLAG_CROUCH) !== 0;
    this.eyeH += ((inCar ? 2 : crouched ? 1.1 : 1.6) - this.eyeH) * Math.min(1, frameDt * 12);
    if (crouched !== this.lastCrouch) { this.lastCrouch = crouched; this.crosshair.classList.toggle('tight', crouched); }
    this.camTarget.set(fx + Math.cos(yaw) * shoulder, fy + this.eyeH, fz - Math.sin(yaw) * shoulder);
    cam.position.copy(this.camTarget).addScaledVector(this.camForward, -this.camDist);
    if (cam.position.y < 0.3) cam.position.y = 0.3;
    this.tmp.copy(cam.position).add(this.camForward);
    cam.lookAt(this.tmp);

    this.entities.update(prev, curr, alpha);
    this.characters.update(prev, curr, alpha, frameDt, cam, this.input.pitch);
    this.worldView.update(this.playerPos);
    this.worldView.setZone(this.zone.x, this.zone.z, this.zone.r);
    this.worldView.tick(frameDt);
    this.renderer.followShadow(this.playerPos);
    this.effects.update(frameDt);
    this.hud.updateDamage(frameDt, cam, this.tmp);
    this.audio?.listener(cam.position.x, cam.position.y, cam.position.z, this.camForward.x, this.camForward.y, this.camForward.z);
    this.renderer.updateDynamicResolution(frameDt);
    this.renderer.render();
    if ((++this.frameNo & 7) === 0) this.renderer.sampleGpuTime(); // tempo de GPU a cada 8 frames
    this.debug.end();
    this.debug.update(frameDt, () => {
      const info = this.renderer.info();
      return {
        frameMs: this.loop.frameMs, calls: info.calls, triangles: info.triangles,
        gpuMs: this.renderer.gpuMs, physicsMs: sim.physicsMs, aiMs: sim.aiMs, entities: ENTITY_COUNT, effects: this.effects.activeCount,
        backend: this.renderer.backend, shared: sim.shared, pixelRatio: this.renderer.pixelRatio,
        preset: PRESETS[this.presetKey].label, chunks: this.worldView.loaded.size,
      };
    });
  }

  /** Áudio só pode começar após um gesto do usuário (política de autoplay). */
  enableAudio() { if (!this.audio) this.audio = new Audio(); }
}

