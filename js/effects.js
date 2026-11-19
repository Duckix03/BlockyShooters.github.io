// Efeitos visuais: clarão, fumaça, cápsulas, traçantes, faíscas, marcas de bala, sangue e números de dano
'use strict';
LS.Effects = {
  items: [], decals: [],
  _tex(draw, size) {
    const cv = document.createElement('canvas'); cv.width = cv.height = size || 64;
    draw(cv.getContext('2d'), cv.width);
    const t = new THREE.CanvasTexture(cv); return t;
  },
  init(scene) {
    this.scene = scene;
    const A = THREE.AdditiveBlending;
    // texturas geradas
    const flashTex = this._tex((g, s) => {
      const c = s / 2, gr = g.createRadialGradient(c, c, 0, c, c, c);
      gr.addColorStop(0, 'rgba(255,255,230,1)'); gr.addColorStop(0.25, 'rgba(255,210,90,0.95)'); gr.addColorStop(0.6, 'rgba(255,120,20,0.35)'); gr.addColorStop(1, 'rgba(255,80,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
      g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,220,120,0.9)';
      for (let i = 0; i < 6; i++) { g.save(); g.translate(c, c); g.rotate(i * Math.PI / 3 + 0.2); g.beginPath(); g.moveTo(0, -3); g.lineTo(c, 0); g.lineTo(0, 3); g.fill(); g.restore(); }
    }, 128);
    const softTex = this._tex((g, s) => {
      const c = s / 2, gr = g.createRadialGradient(c, c, 0, c, c, c);
      gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
    });
    const holeTex = this._tex((g, s) => {
      const c = s / 2, gr = g.createRadialGradient(c, c, 0, c, c, c);
      gr.addColorStop(0, 'rgba(10,10,10,1)'); gr.addColorStop(0.3, 'rgba(25,20,15,0.95)'); gr.addColorStop(0.55, 'rgba(60,50,40,0.5)'); gr.addColorStop(1, 'rgba(60,50,40,0)');
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
    });
    this.flashMat = new THREE.MeshBasicMaterial({ map: flashTex, transparent: true, blending: A, depthWrite: false, side: THREE.DoubleSide });
    this.flashSprite = new THREE.SpriteMaterial({ map: flashTex, transparent: true, blending: A, depthWrite: false });
    this.smokeMat = new THREE.SpriteMaterial({ map: softTex, color: 0xb8b8b8, transparent: true, depthWrite: false, opacity: 0.5 });
    this.dustMat = new THREE.SpriteMaterial({ map: softTex, color: 0xc8b48c, transparent: true, depthWrite: false });
    this.bloodMat = new THREE.SpriteMaterial({ map: softTex, color: 0xb01010, transparent: true, depthWrite: false });
    this.sparkMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, blending: A, depthWrite: false });
    this.tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9, blending: A, depthWrite: false });
    this.holeMat = new THREE.MeshBasicMaterial({ map: holeTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    this.flashGeo = new THREE.PlaneGeometry(1, 1);
    this.tracerGeo = new THREE.BoxGeometry(0.035, 0.035, 1); this.tracerGeo.translate(0, 0, -0.5);
    this.sparkGeo = new THREE.BoxGeometry(0.03, 0.03, 0.18);
    this.shellGeo = new THREE.BoxGeometry(0.03, 0.03, 0.08);
    this.shellMat = LS.lambert(0xd4a43a); this.shellRedMat = LS.lambert(0xc0302a);
    this.dropGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05); this.dropMat = LS.lambert(0x9a0d0d);
    this.flashLight = new THREE.PointLight(0xffb050, 0, 10);
    scene.add(this.flashLight);
  },
  lite() { return LS.settings.perfMode; },
  clear() {
    for (const it of this.items) this.scene.remove(it.obj);
    for (const d of this.decals) this.scene.remove(d);
    this.items = []; this.decals = [];
  },
  add(obj, life, type, extra) { this.scene.add(obj); const it = Object.assign({ obj, life, max: life, type }, extra || {}); this.items.push(it); return it; },

  // clarão do disparo: estrela frontal + "pétalas" laterais + luz + fumaça
  muzzle(pos, dir, wdef, withLight) {
    const big = wdef.cat === 'Escopeta' ? 1.6 : wdef.cat === 'Sniper' ? 1.4 : wdef.cat === 'Pistola' ? 0.8 : 1;
    const s = new THREE.Sprite(this.flashSprite); s.position.copy(pos); s.scale.setScalar(0.45 * big * LS.util.rand(0.8, 1.2));
    s.material.rotation = Math.random() * Math.PI;
    this.add(s, 0.05, 'flash');
    // pétalas alongadas na direção do tiro (visíveis de lado)
    for (let i = 0; i < 2; i++) {
      const m = new THREE.Mesh(this.flashGeo, this.flashMat);
      m.position.copy(pos).addScaledVector(dir, 0.18 * big);
      m.lookAt(m.position.clone().add(dir)); m.rotateY(Math.PI / 2); m.rotateX(i * Math.PI / 2);
      m.scale.set(0.6 * big, 0.22 * big, 1);
      this.add(m, 0.04, 'flash');
    }
    if (withLight && !this.lite()) { this.flashLight.position.copy(pos); this.flashLight.intensity = 3 * big; }
    if (!this.lite()) {
      const sm = new THREE.Sprite(this.smokeMat.clone()); sm.position.copy(pos).addScaledVector(dir, 0.2); sm.scale.setScalar(0.25 * big);
      this.add(sm, 0.9, 'smoke', { v: dir.clone().multiplyScalar(0.6).add(new THREE.Vector3(0, 0.5, 0)), grow: 1.2 * big, op: 0.35 });
    }
  },
  // cápsula ejetada para a direita da arma
  shell(pos, yaw, red) {
    if (this.lite()) return;
    const m = new THREE.Mesh(this.shellGeo, red ? this.shellRedMat : this.shellMat);
    m.position.copy(pos);
    const right = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
    const v = right.multiplyScalar(LS.util.rand(1.5, 2.5)); v.y = LS.util.rand(1.8, 2.8);
    v.x += Math.sin(yaw) * LS.util.rand(-0.5, 0.3); v.z += Math.cos(yaw) * LS.util.rand(-0.5, 0.3);
    this.add(m, 2.5, 'shell', { v, spin: new THREE.Vector3(LS.util.rand(-15, 15), LS.util.rand(-15, 15), 0), bounced: 0 });
  },
  // traçante: projétil brilhante que viaja até o alvo
  tracer(from, to) {
    const len = from.distanceTo(to); if (len < 1) return;
    const m = new THREE.Mesh(this.tracerGeo, this.tracerMat.clone());
    m.position.copy(from); m.lookAt(to);
    const seg = Math.min(3.5, len * 0.5); m.scale.set(1, 1, seg);
    const speed = 420, life = Math.max(0.04, len / speed);
    this.add(m, life, 'tracer', { from: from.clone(), to: to.clone(), len, seg });
  },
  impact(pos, blood, dir) {
    const lite = this.lite();
    if (blood) {
      const b = new THREE.Sprite(this.bloodMat.clone()); b.position.copy(pos); b.scale.setScalar(0.3);
      this.add(b, 0.35, 'puff', { v: new THREE.Vector3(0, 0.6, 0), grow: 1.4, op: 0.9 });
      for (let i = 0; i < (lite ? 2 : 6); i++) {
        const m = new THREE.Mesh(this.dropGeo, this.dropMat); m.position.copy(pos);
        this.add(m, 0.6, 'drop', { v: new THREE.Vector3(LS.util.rand(-2, 2), LS.util.rand(0.5, 3), LS.util.rand(-2, 2)) });
      }
      return;
    }
    const d = new THREE.Sprite(this.dustMat.clone()); d.position.copy(pos); d.scale.setScalar(0.25);
    this.add(d, 0.6, 'puff', { v: new THREE.Vector3(0, 0.8, 0), grow: 1.6, op: 0.75 });
    for (let i = 0; i < (lite ? 2 : 7); i++) {
      const m = new THREE.Mesh(this.sparkGeo, this.sparkMat.clone()); m.position.copy(pos);
      const v = new THREE.Vector3(LS.util.rand(-1, 1), LS.util.rand(0, 1.4), LS.util.rand(-1, 1)).normalize().multiplyScalar(LS.util.rand(4, 9));
      if (dir) v.addScaledVector(dir, -4);
      m.lookAt(pos.clone().add(v));
      this.add(m, LS.util.rand(0.12, 0.3), 'spark', { v });
    }
    // marca de bala virada para o atirador
    if (dir && !lite) {
      const h = new THREE.Mesh(this.flashGeo, this.holeMat);
      h.position.copy(pos).addScaledVector(dir, -0.02); h.lookAt(pos.clone().sub(dir)); h.scale.setScalar(LS.util.rand(0.12, 0.18));
      this.scene.add(h); this.decals.push(h);
      if (this.decals.length > 80) this.scene.remove(this.decals.shift());
    }
  },
  // número de dano flutuante (só para os acertos do jogador)
  damageNumber(pos, dmg, head) {
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64;
    const g = cv.getContext('2d');
    g.font = 'bold 44px Segoe UI, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,0.85)'; g.strokeText(Math.round(dmg), 64, 32);
    g.fillStyle = head ? '#ff4040' : '#ffffff'; g.fillText(Math.round(dmg), 64, 32);
    const tex = new THREE.CanvasTexture(cv);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    s.position.copy(pos).add(new THREE.Vector3(LS.util.rand(-0.3, 0.3), 0.4, LS.util.rand(-0.3, 0.3)));
    s.scale.set(head ? 1.1 : 0.8, head ? 0.55 : 0.4, 1); s.renderOrder = 10;
    this.add(s, 0.9, 'number', { v: new THREE.Vector3(0, 1.2, 0) });
  },
  // poeira ao aterrissar
  landDust(pos) {
    for (let i = 0; i < (this.lite() ? 3 : 10); i++) {
      const a = i / 10 * Math.PI * 2, d = new THREE.Sprite(this.dustMat.clone());
      d.position.set(pos.x + Math.cos(a) * 0.4, pos.y + 0.2, pos.z + Math.sin(a) * 0.4); d.scale.setScalar(0.5);
      this.add(d, 0.9, 'puff', { v: new THREE.Vector3(Math.cos(a) * 2.5, 0.4, Math.sin(a) * 2.5), grow: 2, op: 0.6 });
    }
  },

  update(dt) {
    this.flashLight.intensity = Math.max(0, this.flashLight.intensity - dt * 60);
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.life -= dt;
      if (it.life <= 0) {
        this.scene.remove(it.obj);
        const mat = it.obj.material;
        if (mat && it.type !== 'flash' && it.type !== 'shell' && it.type !== 'drop') { if (mat.map && it.type === 'number') mat.map.dispose(); mat.dispose(); }
        this.items.splice(i, 1); continue;
      }
      const k = it.life / it.max, o = it.obj;
      switch (it.type) {
        case 'tracer': {
          const p = 1 - k; // progresso ao longo do caminho
          o.position.lerpVectors(it.from, it.to, Math.min(1, p + it.seg / it.len));
          break;
        }
        case 'smoke': case 'puff':
          o.position.addScaledVector(it.v, dt); it.v.multiplyScalar(1 - dt * 2);
          o.scale.multiplyScalar(1 + dt * it.grow); o.material.opacity = it.op * k;
          break;
        case 'spark':
          it.v.y -= 12 * dt; o.position.addScaledVector(it.v, dt); o.material.opacity = k;
          break;
        case 'drop':
          it.v.y -= 12 * dt; o.position.addScaledVector(it.v, dt);
          break;
        case 'number':
          o.position.addScaledVector(it.v, dt); o.material.opacity = Math.min(1, k * 2);
          break;
        case 'shell': {
          it.v.y -= 14 * dt; o.position.addScaledVector(it.v, dt);
          o.rotation.x += it.spin.x * dt; o.rotation.y += it.spin.y * dt;
          const g = LS.World.groundAt(o.position.x, o.position.z, o.position.y + 0.3, 0.05);
          if (o.position.y < g + 0.015) {
            o.position.y = g + 0.015;
            if (it.bounced < 2 && it.v.y < -1) { it.v.y *= -0.35; it.v.x *= 0.5; it.v.z *= 0.5; it.spin.multiplyScalar(0.5); it.bounced++; }
            else { it.v.set(0, 0, 0); it.spin.set(0, 0, 0); }
          }
          break;
        }
      }
    }
  }
};
