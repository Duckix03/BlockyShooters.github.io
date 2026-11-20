# 🦴 Animações externas

Coloque aqui arquivos **.glb**, **.gltf** ou **.fbx** com animações de personagem humanoide
(Mixamo, Quaternius, Kenney…). O jogo converte a animação para os 7 ossos do boneco de blocos.

## Ossos do personagem

```
Hips (quadril)
 ├─ Spine (tronco)
 │   ├─ Head (cabeça)
 │   ├─ RightArm (braço direito, segura a arma)
 │   └─ LeftArm (braço esquerdo)
 ├─ RightUpLeg (perna direita)
 └─ LeftUpLeg (perna esquerda)
```

Os nomes são os mesmos do Mixamo, mas o jogo também reconhece outros padrões
(`UpperArm.R`, `thigh_l`, `Bip01 R UpperArm`, `pelvis`, `chest`...).

## Testar

- **Arraste** o arquivo para a janela do jogo: ele carrega e toca no seu personagem.
- Ou use o console (tecla `'` ou F2):
  - `anim load anims/danca.glb danca` carrega e toca
  - `anim play danca` · `anim play danca once` (uma vez só) · `anim play danca upper` (só da cintura pra cima)
  - `anim stop` para · `anim list` lista · `anim bones` mostra o esqueleto

## Deixar fixa no jogo

Em `js/animlib.js`, adicione na lista `LIBRARY`:

```js
LIBRARY: [
  { name: 'danca', url: 'anims/danca.glb' },
  { name: 'vitoria', url: 'anims/vitoria.fbx', loop: false },
],
```

E no código: `LS.Anim.play(model, 'danca')`.

## Dicas

- No Mixamo, baixe em **FBX Binary**, com **"In Place"** marcado (sem andar pelo mapa).
- Antes de usar algo do GitHub, veja a licença: **CC0** ou **MIT** pode usar tranquilo.
- O boneco não tem cotovelo nem joelho, então o braço segue o ombro e a perna segue o quadril.
