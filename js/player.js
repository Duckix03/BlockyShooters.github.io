// Física de movimento compartilhada + jogador controlado pelo usuário
'use strict';

// ---------- Física comum (jogador e bots) ----------
// wish: {x,z} direção desejada (normalizada ou zero), opts: {speed, jump}
LS.Fighter.prototype.physics = function (dt, wish, opts) {
  const W = LS.World, p = this.pos, v = this.vel, R = 0.38;
  if (this.state === 'plane') return;
  if (this.state === 'fall' || this.state === 'chute') {
    const hs = this.state === 'fall' ? 18 : 10;
    v.x = LS.util.lerp(v.x, wish.x * hs, Math.min(1, dt * 2));
    v.z = LS.util.lerp(v.z, wish.z * hs, Math.min(1, dt * 2));
    const term = this.state === 'fall' ? -45 : -7;
    v.y = Math.max(term, v.y - LS.GRAVITY * dt);
    if (this.state === 'chute') v.y = LS.util.lerp(v.y, term, Math.min(1, dt * 3));
    p.addScaledVector(v, dt);
    const g = W.groundAt(p.x, p.z, p.y, R);
    if (this.state === 'fall' && (p.y - g < 90 || opts.openChute)) { this.state = 'chute'; if (this.isPlayer) { LS.Audio.stopLoop('wind'); LS.Audio.startLoop('chute', 'wind'); } }
    if (p.y <= Math.max(g, LS.WATER_LEVEL - 1.2)) {
      p.y = Math.max(g, LS.WATER_LEVEL - 1.2); v.set(0, 0, 0);
      this.state = 'ground'; this.onGround = true;
      if (this.isPlayer) { LS.Audio.stopLoop('chute'); LS.Audio.land(); }
    }
    W.collideCircle(p, R, 1.8);
    this.clampToIsland();
    return;
  }
  // em terra
  const ground0 = W.heightAt(p.x, p.z);
  const swimming = ground0 < LS.WATER_LEVEL - 1.0 && p.y < LS.WATER_LEVEL;
  let speed = opts.speed * (swimming ? 0.5 : 1);
  const accel = this.onGround || swimming ? 14 : 3;
  v.x = LS.util.lerp(v.x, wish.x * speed, Math.min(1, dt * accel));
  v.z = LS.util.lerp(v.z, wish.z * speed, Math.min(1, dt * accel));
  if (opts.jump && this.onGround && !swimming) { v.y = 8.2; this.onGround = false; if (this.isPlayer) LS.Audio.jump(); }
  v.y -= LS.GRAVITY * dt;
  const oldY = p.y;
  p.x += v.x * dt; p.z += v.z * dt; p.y += v.y * dt;
  this.blocked = W.collideCircle(p, R, this.crouch ? 1.2 : 1.8);
  this.clampToIsland();
  let g = W.groundAt(p.x, p.z, Math.max(oldY, p.y), R);
  if (swimming) g = Math.max(g, LS.WATER_LEVEL - 1.3);
  if (p.y <= g) {
    if (!this.onGround && v.y < -14 && this.isPlayer) LS.Audio.land();
    if (!this.onGround && v.y < -20) this.takeDamage((-v.y - 20) * 3, null, false, 'Queda', true);
    p.y = g; v.y = 0; this.onGround = true;
  } else if (this.onGround && p.y - g < 0.6 && v.y <= 0) { p.y = g; v.y = 0; } // desce rampas sem "voar"
  else this.onGround = false;
  // bate a cabeça em tetos
  for (const b of W.nearBoxes(p.x, p.z, 1)) {
    if (p.x > b.minX && p.x < b.maxX && p.z > b.minZ && p.z < b.maxZ && p.y + 1.8 > b.minY && p.y < b.minY && v.y > 0) { v.y = 0; p.y = b.minY - 1.8; }
  }
};
LS.Fighter.prototype.clampToIsland = function () {
  const d = Math.hypot(this.pos.x, this.pos.z), M = 360;
  if (d > M) { this.pos.x *= M / d; this.pos.z *= M / d; }
};

// ---------- Jogador ----------
LS.Player = class extends LS.Fighter {
  constructor() {
    super(LS.playerProfile.name, true, { look: LS.playerProfile.look, chute: 0xff8a1f });
    this.camYaw = 0; this.camPitch = -0.1; this.camDist = 3.6;
    this.stepT = 0; this.prompt = ''; this.pickMsgT = 0;
    this.camPos = new THREE.Vector3(); this.aimDir = new THREE.Vector3(0, 0, 1);
    this._v = new THREE.Vector3(); this._w = new THREE.Vector3();
  }
  update(dt, camera) {
    const I = LS.Input, k = I.keys;
    const sens = 0.0022 * LS.settings.sensitivity * (this.aiming ? 1 / Math.max(1, (this.wdef() ? this.wdef().zoom : 1) * 0.8) : 1);
    if (!LS.Game.inventoryOpen) {
      this.camYaw -= I.mouse.dx * sens;
      this.camPitch -= I.mouse.dy * sens;
    }
    this.camPitch = LS.util.clamp(this.camPitch, -1.35, 1.2);
    if (!this.alive) { this.updateCamera(dt, camera); return; }
    this.updateTimers(dt);

    // direção de movimento relativa à câmera
    let fx = 0, fz = 0;
    if (k.KeyW) fz += 1; if (k.KeyS) fz -= 1; if (k.KeyA) fx += 1; if (k.KeyD) fx -= 1;
    const sy = Math.sin(this.camYaw), cy = Math.cos(this.camYaw);
    let wx = sy * fz + cy * fx, wz = cy * fz - sy * fx;
    const wl = Math.hypot(wx, wz); if (wl > 0) { wx /= wl; wz /= wl; }

    if (this.state === 'plane') {
      if (I.wasPressed('Space') && LS.Game.plane.canJump()) LS.Game.jumpFromPlane(this);
    } else if (this.state !== 'ground') {
      this.physics(dt, { x: wx, z: wz }, { openChute: I.wasPressed('Space') });
      this.yaw = this.camYaw;
    } else {
      if (I.wasPressed('KeyC')) this.crouch = !this.crouch;
      const w = this.weapon();
      this.aiming = I.mouse.right && !!w && !LS.Game.inventoryOpen;
      this.running = k.ShiftLeft && fz > 0 && !this.aiming && !this.healType;
      if (this.running) this.crouch = false;
      let speed = this.crouch ? 2.3 : this.running ? 7.6 : 4.6;
      if (this.aiming) speed *= 0.6;
      if (this.healType) speed *= 0.45;
      if (this.reloadT > 0) speed *= 0.85;
      const jump = I.wasPressed('Space') && !this.crouch;
      if (I.wasPressed('Space') && this.crouch) this.crouch = false;
      this.physics(dt, { x: wx, z: wz }, { speed, jump });
      this.yaw = this.camYaw;
      // passos
      const hs = Math.hypot(this.vel.x, this.vel.z);
      if (this.onGround && hs > 1) { this.stepT -= dt * hs; if (this.stepT <= 0) { this.stepT = 2.6; LS.Audio.footstep(this.crouch ? 0.4 : this.running ? 1.3 : 0.8); } }

      if (!LS.Game.inventoryOpen) {
        if (I.wasPressed('Digit1')) this.switchWeapon(0);
        if (I.wasPressed('Digit2')) this.switchWeapon(1);
        if (I.mouse.wheel) this.switchWeapon(1 - this.slot);
        if (I.wasPressed('KeyR')) this.startReload();
        if (I.wasPressed('KeyH')) this.startHeal('medkit');
        if (I.wasPressed('KeyG')) this.startHeal('bandage');
        const d = this.wdef();
        if (d && (d.auto ? I.mouse.left : I.mouse.leftPressed)) {
          if (this.running) this.running = false;
          const origin = this.shotOrigin();
          if (this.tryFire(origin, this.aimDir)) {
            this.camPitch += d.recoil * 0.012 * (this.crouch ? 0.7 : 1) * (this.aiming ? 0.8 : 1);
            this.camYaw += (Math.random() - 0.5) * d.recoil * 0.006;
          }
        }
      }
      this.handleLoot();
    }
    this.model.root.position.copy(this.pos);
    this.model.root.rotation.y = this.yaw;
    this.model.animate({ dt, speed: Math.hypot(this.vel.x, this.vel.z), running: this.running, crouch: this.crouch, air: this.state === 'ground' && !this.onGround,
      chute: this.state === 'chute', aimPitch: this.camPitch, armed: !!this.weapon(), armedAim: this.aiming || this.fireCd > 0, dead: !this.alive });
    this.model.root.visible = this.state !== 'plane';
    this.updateCamera(dt, camera);
  }
  shotOrigin() {
    // começa o raio da câmera na altura do personagem (evita acertar paredes atrás dele)
    const head = this.eyePos(this._w);
    const t0 = Math.max(0, this._v.subVectors(head, this.camPos).dot(this.aimDir));
    return new THREE.Vector3().copy(this.camPos).addScaledVector(this.aimDir, t0);
  }
  handleLoot() {
    this.prompt = '';
    // coleta automática de itens próximos
    const near = LS.Loot.nearest(this.pos, 1.7, it => it.type !== 'weapon' || !this.weapons[0] || !this.weapons[1]);
    if (near) {
      const msg = this.pickup(near, false);
      if (msg) { LS.Audio.pickup(); LS.HUD.toast('+ ' + msg); }
    }
    // armas com slots cheios: E para trocar
    const wpn = LS.Loot.nearest(this.pos, 2.0, it => it.type === 'weapon');
    if (wpn && this.weapons[0] && this.weapons[1]) {
      this.prompt = '<b>E</b> Trocar ' + LS.WEAPONS[this.weapon().id].name + ' por ' + LS.Loot.label(wpn);
      if (LS.Input.wasPressed('KeyE')) { const msg = this.pickup(wpn, true); if (msg) { LS.Audio.pickup(); LS.HUD.toast('+ ' + msg); } }
    } else {
      const other = LS.Loot.nearest(this.pos, 2.5, it => it.type !== 'weapon');
      if (other && !near) this.prompt = LS.Loot.label(other) + ' <span style="color:#aaa">(cheio / sem melhoria)</span>';
    }
  }
  updateCamera(dt, camera) {
    const wd = this.wdef();
    const zoom = this.aiming && wd ? wd.zoom : 1;
    const baseFov = 70;
    const targetFov = baseFov / zoom;
    camera.fov = LS.util.lerp(camera.fov, targetFov, Math.min(1, dt * 14));
    camera.updateProjectionMatrix();
    const scoped = this.aiming && wd && wd.scope && camera.fov < baseFov / 2;
    LS.HUD.setScope(scoped);
    this.model.root.visible = this.state !== 'plane' && !scoped;

    let target, dist;
    if (this.state === 'plane') {
      target = LS.Game.plane.mesh.position.clone(); dist = 26;
    } else {
      target = this.eyePos(new THREE.Vector3());
      target.y += this.state === 'ground' ? 0.15 : 1.5;
      dist = this.state === 'ground' ? (this.aiming ? 1.9 : 3.4) : 7;
      if (!this.alive) dist = 6;
      // ombro direito
      const side = this.state === 'ground' ? 0.75 : 0;
      target.x -= Math.cos(this.camYaw) * side; target.z += Math.sin(this.camYaw) * side;
    }
    this.camDist = LS.util.lerp(this.camDist, dist, Math.min(1, dt * 10));
    const cp = Math.cos(this.camPitch);
    const fwd = this.aimDir.set(Math.sin(this.camYaw) * cp, Math.sin(this.camPitch), Math.cos(this.camYaw) * cp).normalize();
    // colisão da câmera
    const back = this._v.copy(fwd).negate();
    let d = this.camDist;
    if (this.state !== 'plane') { const hit = LS.World.raycast(target, back, this.camDist + 0.3); d = Math.min(d, hit - 0.3); }
    d = Math.max(0.3, d);
    this.camPos.copy(target).addScaledVector(back, d);
    camera.position.copy(this.camPos);
    camera.lookAt(this._w.copy(this.camPos).add(fwd));
  }
};
