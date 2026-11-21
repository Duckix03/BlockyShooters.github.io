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
- decide quem pegou cada **item** do chão, as mortes, a colocação e o **vencedor**.

A IA dos bots roda no navegador de um dos jogadores (o "host"). Se ele sair, outro jogador assume.
Os comandos de trapaça do console (`give`, `god`, `tp`, `esp`...) ficam desligados no online.

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

Depois, no console do jogo (tecla `'`), digite `LS.NET_URL = 'http://127.0.0.1:8787'` e clique em **JOGAR**.

## Limites do plano grátis

- **100.000 requisições por dia.** Cada mensagem que chega do jogador conta como uma fração de requisição, e o jogo manda 12 posições por segundo. Dá pra muitas partidas por dia entre amigos.
- Se o jogo crescer muito, a Cloudflare tem o plano pago (Workers Paid).

## O que ainda dá pra trapacear (e como melhorar depois)

- **Wallhack/ESP:** o navegador recebe a posição de todos os jogadores. Pra impedir, o servidor teria que mandar só quem cada jogador consegue ver.
- **Inventário e munição** ainda são controlados pelo navegador. O servidor já confere a arma em uso e o ritmo de tiro, mas não conta as balas.
- **Mira automática** não tem como o servidor impedir totalmente. Dá pra detectar padrões suspeitos depois.
