// Controles de toque para celular: joystick virtual (mover), arrastar à direita (mirar) e botões.
export function setupTouch(input) {
  const root = document.getElementById('touch');
  root.classList.remove('hidden');
  const stick = document.getElementById('stick'), knob = document.getElementById('stick-knob');
  let stickId = null, lookId = null, lx = 0, ly = 0, cx = 0, cy = 0;
  const R = 50;

  stick.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0]; stickId = t.identifier;
    const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
    e.preventDefault();
  }, { passive: false });

  addEventListener('touchstart', (e) => {
    for (const t of e.changedTouches) {
      if (t.target.closest('#touch') || lookId !== null) continue;
      lookId = t.identifier; lx = t.clientX; ly = t.clientY;
    }
  });
  addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) {
        let dx = t.clientX - cx, dy = t.clientY - cy; const d = Math.hypot(dx, dy);
        if (d > R) { dx *= R / d; dy *= R / d; }
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        input.touchMove.x = dx / R; input.touchMove.y = dy / R;
      } else if (t.identifier === lookId) {
        input.look((t.clientX - lx) * 2.2, (t.clientY - ly) * 2.2);
        lx = t.clientX; ly = t.clientY;
      }
    }
    e.preventDefault();
  }, { passive: false });
  const end = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) {
        stickId = null; input.touchMove.x = input.touchMove.y = 0; knob.style.transform = '';
      } else if (t.identifier === lookId) lookId = null;
    }
  };
  addEventListener('touchend', end); addEventListener('touchcancel', end);

  const hold = (id, on, off) => {
    const b = document.getElementById(id);
    b.addEventListener('touchstart', (e) => { e.preventDefault(); on(); }, { passive: false });
    b.addEventListener('touchend', (e) => { e.preventDefault(); off?.(); }, { passive: false });
  };
  hold('btn-fire', () => { input.fire = true; }, () => { input.fire = false; });
  hold('btn-jump', () => { input.keys.add('Space'); input.pressed.add('Space'); }, () => input.keys.delete('Space'));
  hold('btn-use', () => input.pressed.add('KeyE'));
}
