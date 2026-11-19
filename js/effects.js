// Efeitos visuais: traçantes, clarão do disparo, impactos
'use strict';
LS.Effects = {
  items: [],
  init(scene) {
    this.scene = scene;
    this.tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9 });
    this.flashMat = new THREE.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0.95 });
    this.flashGeo = new THREE.SphereGeometry(0.12, 6, 4);
    this.puffGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    this.dustMat = new THREE.MeshBasicMaterial({ color: 0xbfae8f, transparent: true });
    this.bloodMat = new THREE.MeshBasicMaterial({ color: 0xc01818, transparent: true });
    this.flashLight = new THREE.PointLight(0xffc060, 0, 8);
    scene.add(this.flashLight);
  },
  clear() { for (const it of this.items) this.scene.remove(it.obj); this.items = []; },

  tracer(from, to) {
    const g = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
    const l = new THREE.Line(g, this.tracerMat.clone());
    this.scene.add(l);
    this.items.push({ obj: l, life: 0.08, max: 0.08, type: 'tracer' });
  },
  flash(pos, withLight) {
    const m = new THREE.Mesh(this.flashGeo, this.flashMat);
    m.position.copy(pos); m.scale.setScalar(LS.util.rand(0.8, 1.5));
    this.scene.add(m);
    this.items.push({ obj: m, life: 0.05, max: 0.05, type: 'flash' });
    if (withLight) { this.flashLight.position.copy(pos); this.flashLight.intensity = 2.5; }
  },
  impact(pos, blood) {
    const n = blood ? 6 : 5;
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(this.puffGeo, (blood ? this.bloodMat : this.dustMat).clone());
      m.position.copy(pos);
      const v = new THREE.Vector3(LS.util.rand(-2, 2), LS.util.rand(0.5, 3), LS.util.rand(-2, 2));
      this.scene.add(m);
      this.items.push({ obj: m, life: 0.4, max: 0.4, type: 'puff', v });
    }
  },
  update(dt) {
    this.flashLight.intensity = Math.max(0, this.flashLight.intensity - dt * 40);
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.life -= dt;
      if (it.life <= 0) {
        this.scene.remove(it.obj);
        if (it.type === 'tracer') { it.obj.geometry.dispose(); it.obj.material.dispose(); }
        else if (it.type === 'puff') it.obj.material.dispose();
        this.items.splice(i, 1); continue;
      }
      const k = it.life / it.max;
      if (it.type === 'tracer') it.obj.material.opacity = k;
      else if (it.type === 'puff') {
        it.v.y -= 9 * dt; it.obj.position.addScaledVector(it.v, dt);
        it.obj.material.opacity = k;
      }
    }
  }
};
