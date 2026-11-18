// Configurações centrais do jogo: constantes técnicas, balanceamento e presets gráficos.

/** Passo fixo da lógica (60 Hz). O render roda livre e interpola. */
export const FIXED_DT = 1 / 60;
/** Limite de passos por frame (evita a "espiral da morte" quando a aba trava). */
export const MAX_STEPS_PER_FRAME = 5;

/** Mundo */
export const WORLD = {
  size: 512,          // lado do mapa em metros (centrado na origem)
  chunkSize: 64,      // lado de cada chunk
  seed: 1337,         // semente da geração procedural (mesma em main, física e IA)
  treesPerChunk: 40,
  rocksPerChunk: 14,
  cratesPerChunk: 3,
  buildings: 26,
  vehicles: 3,
  navCell: 8,         // resolução da navmesh (metros)
};

/** Quantidade de bots. Cada bot ocupa um slot no buffer compartilhado. */
export const BOT_COUNT = 24;

/**
 * Balanceamento ajustável ao vivo pelo lil-gui (F2).
 * Tudo que é enviado aos workers passa por `syncBalance()` no Game.
 */
export const BALANCE = {
  walkSpeed: 5.5,
  sprintSpeed: 8.5,
  jumpSpeed: 7,
  gravity: -20,
  maxHealth: 100,
  weaponDamage: 18,
  headshotMult: 2,
  fireRate: 9,          // tiros por segundo
  magSize: 30,
  reserveAmmo: 120,
  reloadTime: 1.6,
  spread: 0.012,        // radianos
  botAccuracy: 0.55,    // 0..1
  botReaction: 0.45,    // segundos até começar a atirar
  botViewDist: 70,
  botFireRate: 4,
  botDamage: 9,
  zoneShrinkTime: 240,  // segundos até a zona fechar por completo
  zoneDps: 4,
  vehicleEngine: 120,
  vehicleSteer: 0.55,
};

/**
 * Presets gráficos. `maxPixelRatio` é o teto; a escala dinâmica baixa a partir dele.
 * `viewChunks` = raio (em chunks) carregados ao redor da câmera.
 */
export const PRESETS = {
  low: {
    label: 'Baixo', maxPixelRatio: 0.75, minPixelRatio: 0.5, shadows: false, shadowMapSize: 512,
    shadowDistance: 0, viewChunks: 1, lodBias: 0.6, fog: 140, targetFps: 30,
  },
  medium: {
    label: 'Médio', maxPixelRatio: 1, minPixelRatio: 0.6, shadows: true, shadowMapSize: 1024,
    shadowDistance: 30, viewChunks: 2, lodBias: 1, fog: 190, targetFps: 60,
  },
  high: {
    label: 'Alto', maxPixelRatio: 1.5, minPixelRatio: 0.75, shadows: true, shadowMapSize: 2048,
    shadowDistance: 45, viewChunks: 3, lodBias: 1.4, fog: 260, targetFps: 60,
  },
  ultra: {
    label: 'Ultra', maxPixelRatio: 2, minPixelRatio: 1, shadows: true, shadowMapSize: 4096,
    shadowDistance: 60, viewChunks: 4, lodBias: 2, fog: 360, targetFps: 60,
  },
};

/** Detecção simples de celular (para preset padrão e controles de toque). */
export const IS_MOBILE = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
export const DEFAULT_PRESET = IS_MOBILE ? 'low' : 'high';
