// Painel de balanceamento ao vivo (lil-gui, F2). Mudanças vão direto para os Workers.
import GUI from 'lil-gui';

export function createBalanceGui(balance, onChange) {
  const gui = new GUI({ title: 'Balanceamento (F2)' });
  const add = (folder, key, min, max, step) => folder.add(balance, key, min, max, step).onChange(onChange);
  const mov = gui.addFolder('Movimento');
  add(mov, 'walkSpeed', 1, 15, 0.1); add(mov, 'sprintSpeed', 1, 20, 0.1);
  add(mov, 'jumpSpeed', 1, 15, 0.1); add(mov, 'gravity', -40, -5, 0.5);
  add(mov, 'crouchSpeed', 0.5, 8, 0.1); add(mov, 'crouchSpreadMult', 0.1, 1, 0.05);
  const arma = gui.addFolder('Arma');
  add(arma, 'weaponDamage', 1, 100, 1); add(arma, 'headshotMult', 1, 4, 0.1);
  add(arma, 'fireRate', 1, 20, 0.5); add(arma, 'magSize', 1, 100, 1);
  add(arma, 'reloadTime', 0.2, 5, 0.1); add(arma, 'spread', 0, 0.1, 0.001);
  const bots = gui.addFolder('Bots');
  add(bots, 'botAccuracy', 0, 1, 0.01); add(bots, 'botReaction', 0, 2, 0.05);
  add(bots, 'botViewDist', 10, 200, 1); add(bots, 'botFireRate', 0.5, 15, 0.5); add(bots, 'botDamage', 1, 50, 1);
  const zona = gui.addFolder('Zona / Veículo');
  add(zona, 'zoneShrinkTime', 30, 900, 10); add(zona, 'zoneDps', 0, 30, 0.5);
  add(zona, 'vehicleEngine', 20, 400, 5); add(zona, 'vehicleSteer', 0.1, 1, 0.01);
  gui.hide();
  return gui;
}
