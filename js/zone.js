// Zona segura que encolhe progressivamente + avião de lançamento
'use strict';
LS.Zone = class {
  constructor(scene) {
    this.scene = scene;
    this.phases = [
      { wait: 80, shrink: 45, r: 220, dps: 1 },
      { wait: 50, shrink: 40, r: 135, dps: 2 },
      { wait: 40, shrink: 35, r: 80, dps: 4 },
      { wait: 32, shrink: 30, r: 42, dps: 6 },
      { wait: 25, shrink: 25, r: 18, dps: 9 },
      { wait: 20, shrink: 22, r: 0, dps: 14 }
    ];
    const geo = new THREE.CylinderGeometry(1, 1, 400, 64, 1, true);
    this.wall = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x3f7cff, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false, fog: false }));
    this.wall.position.y = 100;
    this.wall.renderOrder = 5;
    scene.add(this.wall);
    const rg = new THREE.RingGeometry(0.995, 1, 96); rg.rotateX(-Math.PI / 2);
    this.nextRing = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, side: THREE.DoubleSide, fog: false }));
    this.nextRing.position.y = 60;
    scene.add(this.nextRing);
    this.reset();
  }
  reset() {
    this.center = new THREE.Vector2(0, 0); this.radius = 430;
    this.startC = this.center.clone(); this.startR = this.radius;
    this.phase = 0; this.shrinking = false; this.timer = this.phases[0].wait; this.dmgT = 1; this.finished = false;
    this.pickNext();
  }
  pickNext() {
    const ph = this.phases[Math.min(this.phase, this.phases.length - 1)];
    this.nextR = ph.r;
    const maxOff = Math.max(0, Math.min(this.radius, 330) - ph.r);
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, o = Math.sqrt(Math.random()) * maxOff * (this.phase === 0 ? 0.55 : 1);
      const x = this.center.x + Math.cos(a) * o, z = this.center.y + Math.sin(a) * o;
      this.next = new THREE.Vector2(x, z);
      if (LS.World.heightAt(x, z) > 1.5 && Math.hypot(x, z) + ph.r < 380) break;
    }
    this.target = this.next; this.targetR = this.nextR;
  }
  get dps() { return this.phases[Math.min(this.phase, this.phases.length - 1)].dps; }
  isOutside(pos) { return Math.hypot(pos.x - this.center.x, pos.z - this.center.y) > this.radius; }

  update(dt, fighters) {
    if (!this.finished) {
      this.timer -= dt;
      const ph = this.phases[this.phase];
      if (!this.shrinking && this.timer <= 0) {
        this.shrinking = true; this.timer = ph.shrink;
        this.startC = this.center.clone(); this.startR = this.radius;
        LS.HUD.centerMsg('A ZONA ESTÁ ENCOLHENDO!', 'Vá para a área segura', 3); LS.Audio.alert();
      } else if (this.shrinking) {
        const k = 1 - Math.max(0, this.timer) / ph.shrink;
        this.center.lerpVectors(this.startC, this.next, k);
        this.radius = LS.util.lerp(this.startR, this.nextR, k);
        if (this.timer <= 0) {
          this.shrinking = false; this.phase++;
          if (this.phase >= this.phases.length) { this.finished = true; this.phase = this.phases.length - 1; this.timer = 0; }
          else { this.timer = this.phases[this.phase].wait; this.pickNext(); }
        }
      }
    }
    // dano fora da zona
    this.dmgT -= dt;
    if (this.dmgT <= 0) {
      this.dmgT = 1;
      for (const f of fighters) {
        if (f.alive && f.state === 'ground' && this.isOutside(f.pos)) {
          f.takeDamage(this.dps, null, false, 'Zona', true);
          if (f.isPlayer) LS.Audio.zoneTick();
        }
      }
    }
    const r = Math.max(this.radius, 0.5);
    this.wall.position.x = this.center.x; this.wall.position.z = this.center.y;
    this.wall.scale.set(r, 1, r);
    this.nextRing.visible = !this.finished && !this.shrinking;
    this.nextRing.position.x = this.next.x; this.nextRing.position.z = this.next.y;
    this.nextRing.scale.set(Math.max(this.nextR, 0.5), 1, Math.max(this.nextR, 0.5));
  }
};

LS.Plane = class {
  constructor(scene) {
    const g = new THREE.Group(), M = c => LS.lambert(c);
    const body = new THREE.Mesh(LS.boxGeo(3, 3, 16), M(0xd8d8d8)); g.add(body);
    const nose = new THREE.Mesh(LS.boxGeo(2.4, 2.4, 2), M(0xff8a1f)); nose.position.z = 9; g.add(nose);
    const wing = new THREE.Mesh(LS.boxGeo(22, 0.4, 3.5), M(0xbfbfbf)); wing.position.set(0, 0, 1); g.add(wing);
    const tail = new THREE.Mesh(LS.boxGeo(0.4, 4, 2.5), M(0xff8a1f)); tail.position.set(0, 2.5, -7); g.add(tail);
    const tailW = new THREE.Mesh(LS.boxGeo(8, 0.3, 2), M(0xbfbfbf)); tailW.position.set(0, 0.5, -7); g.add(tailW);
    [-6, 6].forEach(x => { const e = new THREE.Mesh(LS.boxGeo(1.4, 1.4, 3), M(0x555555)); e.position.set(x, -1, 2); g.add(e); });
    this.mesh = g; scene.add(g);
    this.speed = 38;
  }
  reset() {
    // trajeto aleatório atravessando a ilha
    const a = Math.random() * Math.PI * 2, off = LS.util.rand(-120, 120);
    const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), perp = new THREE.Vector3(-dir.z, 0, dir.x);
    this.start = dir.clone().multiplyScalar(-420).addScaledVector(perp, off); this.start.y = 190;
    this.end = dir.clone().multiplyScalar(420).addScaledVector(perp, off); this.end.y = 190;
    this.length = this.start.distanceTo(this.end);
    this.progress = 0; this.active = true;
    this.mesh.visible = true;
    this.mesh.position.copy(this.start);
    this.mesh.lookAt(this.end);
  }
  // só é possível saltar com o avião sobre a ilha
  canJump() { return this.active && this.progress > 0.08 && this.progress < 0.97; }
  update(dt) {
    if (!this.active) return;
    this.progress += this.speed * dt / this.length;
    this.mesh.position.lerpVectors(this.start, this.end, Math.min(1, this.progress));
    if (this.progress >= 1.1) { this.active = false; this.mesh.visible = false; }
  }
};
