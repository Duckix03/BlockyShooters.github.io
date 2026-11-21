# 🌐 Servidor online do Last Survivor

Servidor da partida online, feito pra rodar **de graça** na Cloudflare (Workers + Durable Objects).
O site continua no GitHub Pages; só a parte online fica na Cloudflare.

## Como funciona

1. Quem clica em **JOGAR** entra numa fila e fica **até 30 segundos procurando jogadores**.
2. Se achar 2 ou mais, abre uma partida: os jogadores reais + **bots completando as 31 vagas**.
3. Se não achar ninguém, o jogo começa **contra bots**, como antes.

Na partida, o **servidor é a autoridade**:

- guarda a **vida** de todo mundo (editar o jogo no navegador não dá vida infinita);
- confere cada **tiro**: se a pessoa tem aquela arma, se não está atirando mais rápido do que a arma permite e se o alvo está no alcance. O **dano é calculado no servidor**;
- recusa **teleporte e velocidade impossível**;
- decide quem pegou cada **item** do chão, as mortes, a colocação e o **vencedor**;
- **anti-wallhack:** cada jogador só recebe a posição de quem ele poderia ver. O servidor confere a linha de visão
  (relevo, paredes, telhados e pedras do mapa, em `src/occluders.js`) umas 3 vezes por segundo pra cada par.
  Quem está bem escondido atrás de parede ou morro nem chega no navegador, então não tem ESP que mostre.
  Tiros só chegam pra quem está perto o bastante pra ouvir. A regra é generosa (na dúvida, aparece), pra ninguém
  ficar invisível por erro.

A IA dos bots roda no navegador de um dos jogadores (o "host"). Se ele sair, outro jogador assume.
Os comandos de trapaça do console (`give`, `god`, `tp`, `esp`...) ficam desligados no online.
O console fica escondido pros jogadores: só abre depois de abrir o jogo uma vez com `?dev` no link (`?dev=0` desliga).

**Atualizou o servidor (ex.: contas novas)?** Rode `npx wrangler deploy` de novo dentro da pasta `server`. Sem isso, o botão de criar conta dá erro.

**Mudou o mapa?** (terreno, casas, pedras ou `LS.MAP_SEED`) Rode `python tools/export-occluders.py . server/src/occluders.js`
pra atualizar as paredes que o servidor usa pra linha de visão.

## 👤 Contas

O servidor também guarda as **contas** (`src/accounts.js`): nome único com senha, perfil, estatísticas, curtidas e selos.

- O **nome** de uma conta é só dela. Na partida online, quem não tem conta e tenta usar o nome de uma conta entra como `Convidado1234`.
- A senha é guardada com hash (PBKDF2 + sal), nunca em texto.
- **Selos** (Owner, Dev, Criador de Conteúdo, Verificado) só podem ser dados pelo **owner**, no botão **ADMIN** do perfil.
- Não tem e-mail: quem esquecer a senha perde a conta (dá pra adicionar depois).

### Virar owner (uma vez só)

1. Crie a **chave de admin** (uma senha grande que só você sabe). Dentro da pasta `server`:

   ```bash
   npx wrangler secret put ADMIN_KEY
   ```

   Ele pede pra você digitar a chave (mínimo 12 caracteres). Ela fica guardada só na Cloudflare, não no GitHub.
2. Publique de novo: `npx wrangler deploy` (veja abaixo).
3. No jogo: abra o **perfil** (clique no seu nome no canto de cima), **CRIAR CONTA**, depois **CONTA** → **Chave de admin** → cole a chave → **USAR**.
   Você ganha Owner, Dev e Verificado, e aparece o botão **ADMIN** no perfil pra dar selos pelo ID de cada um.

## Publicar (uma vez só, uns 5 minutos)

1. Crie uma conta grátis em **https://dash.cloudflare.com/sign-up** (não pede cartão).
2. Instale o **Node.js** (versão LTS) em **https://nodejs.org**.
3. Abra o terminal **dentro da pasta `server`** deste repositório e rode:

   ```bash
   npx wrangler login
   npx wrangler deploy
   ```

   O primeiro comando abre o navegador pra você autorizar. O segundo publica e mostra um endereço parecido com
   `https://lastsurvivor.lastsurvivorbr.workers.dev`.
4. Abra esse endereço no navegador: tem que aparecer **"Last Survivor server ok"**.
5. Em **`js/config.js`**, coloque o endereço:

   ```js
   LS.NET_URL = 'https://lastsurvivor.lastsurvivorbr.workers.dev'; // já configurado
   ```

   Faça commit e espere o GitHub Pages atualizar. Pronto: o **JOGAR** já procura jogadores de verdade.

**Pra testar sozinho:** abra o jogo em duas janelas (ou no PC e no celular) e clique em **JOGAR** nas duas, com menos de 30 s de diferença.

## Testar no seu computador (opcional)

```bash
cd server
npx wrangler dev
```

Depois, no console do jogo (tecla `'`; no localhost ele sempre abre), digite `LS.NET_URL = 'http://127.0.0.1:8787'` e clique em **JOGAR**.

## Limites do plano grátis

- **100.000 requisições por dia.** Cada mensagem que chega do jogador conta como uma fração de requisição, e o jogo manda 12 posições por segundo. Dá pra muitas partidas por dia entre amigos.
- Se o jogo crescer muito, a Cloudflare tem o plano pago (Workers Paid).

## O que ainda dá pra trapacear (e como melhorar depois)

- **Wallhack/ESP:** resolvido em boa parte (veja acima). Sobra: quem está perto (até 18 m) ou visível há menos de 1 s ainda chega, e o **host** recebe todo mundo, porque os bots rodam no navegador dele. Um host trapaceiro ainda veria todos.
- **Inventário e munição** ainda são controlados pelo navegador. O servidor já confere a arma em uso e o ritmo de tiro, mas não conta as balas.
- **Mira automática** não tem como o servidor impedir totalmente. Dá pra detectar padrões suspeitos depois.
