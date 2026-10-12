<div align="center">

<img src="extension/icons/icon128.png" width="96" alt="">

# BO1 Zombies Co-op

**Play Black Ops 1 Zombies in your browser with up to 4 friends, online.**<br>
A free Chrome extension for [vel.gg/bo1z](https://vel.gg/bo1z/): host a game, send a link, play Kino der Toten together.

[![Latest release](https://img.shields.io/github/v/release/AllanLotta/bo1-zombies-coop?label=download&color=e2552f)](https://github.com/AllanLotta/bo1-zombies-coop/releases/latest)
![Players](https://img.shields.io/badge/players-up%20to%204-63d471)
![Maps](https://img.shields.io/badge/maps-all%2010-5aa8ff)
![Browser](https://img.shields.io/badge/browser-Chrome-f4c542)

**English** · [Português](#português)

<img src="docs/images/four-players.jpg" width="860" alt="Four players in the same lobby, one browser each: the host and three friends, with names, status and ping">

</div>

## Features

- **Up to 4 players online**: one hosts, up to three join with an invite link. Works over the internet; nobody needs
  to be on the same Wi-Fi or open ports.
- **A lobby everyone sees**: each player's name, colour (white, blue, yellow, green, as on the BO1 scoreboard),
  status and ping, so you always know who is loading, joining or ready.
- **Everyone spawns together**: the host's start waits until the others are in (or starts now, if you prefer).
- **All 10 maps**, Hell mode included: Kino der Toten, Five, Der Riese, Nacht der Untoten, Verrückt, Shi No Numa,
  Ascension, Call of the Dead, Shangri-La and Moon.
- **Pause together**: any player opening the menu pauses everyone.
- **PlayStation and Xbox controllers** with adjustable aim speed.
- **English and Portuguese**, picked from your browser's language.
- **Stable**: fixes the crash where one player pressing Escape or T (chat) took down the other players' games.

<p align="center"><img src="docs/images/in-game.png" width="640" alt="Playing Kino der Toten in co-op, with the players indicator in the corner"><br><sub>In game, the card folds into a small indicator: one dot per player, and your ping</sub></p>

<table>
<tr>
<td align="center"><img src="docs/images/lobby-host.png" width="250" alt="Host lobby"><br><sub>Hosting: room code, steps, lobby</sub></td>
<td align="center"><img src="docs/images/joining.png" width="250" alt="Joining"><br><sub>Joining: progress and what to do next</sub></td>
<td align="center"><img src="docs/images/lobby-guest.png" width="250" alt="Guest lobby with settings"><br><sub>In the lobby, with settings open</sub></td>
</tr>
</table>

## Install (2 minutes, every player)

1. Download **`bo1-zombies-coop-*.zip`** from the [latest release](https://github.com/AllanLotta/bo1-zombies-coop/releases/latest) and unzip it.
2. In Chrome, open `chrome://extensions` and switch on **Developer mode** (top right).
3. Click **Load unpacked** and pick the unzipped folder (the one with `manifest.json` inside).
4. Open [vel.gg/bo1z](https://vel.gg/bo1z/). The **Co-op** card appears in the top right corner.

Downloaded the whole repository instead? Pick its `extension` folder in step 3.

## Play

**Host**

1. On the Co-op card, click **Host a game**, then **Copy link** and send it to your friends.
2. Pick a map. Everyone else follows you to it automatically.
3. Wait on the "click to start" screen until the lobby shows everyone as **Ready**, then click the game.

**Friends**

1. Open the invite link and press any key when the page asks, to load the map.
2. Wait until the card says **You are in**, then click the game.

Tips:

- Set your name under **Settings** so it shows in everyone's lobby.
- Somebody got disconnected? They click **Rejoin**. Joining after the start means watching until the next round,
  as in the original game.
- Spawned far away from the others? **Go to the host** on the card brings you next to them.

## Troubleshooting

| Problem | What to do |
| --- | --- |
| "vel.gg updated its game engine…" | vel.gg shipped a new engine. Co-op switches itself off until this extension is updated; check for a new release. |
| "You and the host have different versions" | Both reload the page (the engine is cached per browser). |
| "This game is full" | A room holds 4 players. Wait for a free seat or host another room. |
| Stuck on "Next in line" | Players connect one at a time; it moves on within a minute. If it does not, reload. |
| Co-op stops working for everyone at the same time | The relay's free daily allowance may be used up; it resets at midnight UTC. See [Run your own relay](#run-your-own-relay). |

Works in Chrome. Other Chromium browsers (Edge, Brave, Opera) load the same extension but are not tested.

## Run your own relay

Players connect through a small relay on Cloudflare, which only forwards game packets. The default relay runs on
Cloudflare's free plan, whose daily allowance is shared by everyone using it. Your own relay is free too, takes about
five minutes, and is used only by the people you invite:

```sh
git clone https://github.com/AllanLotta/bo1-zombies-coop
cd bo1-zombies-coop
npm install
npx wrangler login          # free Cloudflare account, email confirmed
npm run relay:deploy        # prints https://bo1z-coop-4p-relay.<your-name>.workers.dev
```

Then, on the Co-op card: **Settings → Change relay**, paste that address, **Save**. Your invite links carry the relay,
so friends switch to it with one click.

## How it works

vel.gg runs the decompiled Black Ops 1 engine as WebAssembly. Its multiplayer code is still inside, but the network
layer is gone, so players can only talk to their own local server through in-memory "loopback" queues. The extension:

1. **Patches the engine as it loads** (after checking its exact SHA-256 and every function by name): a mailbox for
   console commands, a switch to park the local server, an extra inbound queue for the host's server, and two
   crash fixes (players in a menu, and a command flood from guests waiting in the lobby).
2. **Gives each guest its own loopback queue on the host**, so the host's real game server sees up to three remote
   players as ordinary local clients, each with a distinct port and qport.
3. **Pumps packets** between those queues and a WebSocket in a Worker, through a Cloudflare Durable Object per room
   that routes them by seat without looking inside.

## Development

```
extension/        what players load: manifest, icons and the built coop.js
src/
  engine/         known engine builds, wasm patching, shared-memory access
  net/            packet pump worker and loopback queues
  session/        host, guest, lobby, control messages, engine hooks
  ui/             the card, its view model, styles and texts (EN/PT)
  input/          controller support
  game/ util/     vel.gg page helpers, settings, relay selection
shared/           wire protocol used by both the extension and the relay
relay/            Cloudflare Worker + Durable Objects
test/             relay, engine patch, end-to-end and UI preview tests
scripts/          build, packaging and icon rendering
```

```sh
npm install
npm run build              # src/ -> extension/coop.js
npm run check              # lint + build + engine patch test
npm run relay:dev          # relay on http://127.0.0.1:8787
npm run test:relay         # routing test against it
node test/e2e.mjs 2 kino   # two real browsers playing through the local relay
npm run preview            # screenshots of every card state (no game loaded)
npm run package            # dist/bo1-zombies-coop-<version>.zip
```

Each end-to-end player is a full game engine using several GB of memory: on a 16 GB machine, test with 3 at most.

## Credits

The game in the browser is [vel.gg](https://vel.gg/bo1z/) by MisaDev4, built on the decompiled engine. This project
started from invictus841's two-player co-op extension.

Not affiliated with Activision or Treyarch. Call of Duty and Black Ops are trademarks of Activision Publishing.

---

## Português

**Jogue Black Ops 1 Zombies no navegador com até 4 amigos, online.** Extensão gratuita do Chrome para o
[vel.gg/bo1z](https://vel.gg/bo1z/): um hospeda, manda o link, e todo mundo joga junto, inclusive no Kino der Toten.

<table>
<tr>
<td align="center"><img src="docs/images/lobby-host-pt.png" width="250" alt="Lobby do host"><br><sub>Hospedando: código da sala e lobby</sub></td>
<td align="center"><img src="docs/images/joining-pt.png" width="250" alt="Entrando"><br><sub>Entrando: progresso e próximo passo</sub></td>
</tr>
</table>

### O que tem

- **Até 4 jogadores online**, pela internet, sem precisar estar na mesma rede nem abrir portas.
- **Lobby para todos**: nome, cor (branco, azul, amarelo, verde, como no placar do BO1), status e ping de cada um.
- **Todos nascem juntos**: o início do host espera os outros entrarem (ou começa na hora, se preferir).
- **Os 10 mapas**, com Hell mode.
- **Pausa sincronizada**: quem abre o menu pausa para todos.
- **Controle de PlayStation e Xbox**, com ajuste de velocidade da mira.
- **Em português** quando o navegador está em português.
- **Corrige o crash** em que um jogador apertando ESC ou T (chat) derrubava o jogo dos outros.

### Instalar (2 minutos, cada jogador)

1. Baixe o **`bo1-zombies-coop-*.zip`** na [última versão](https://github.com/AllanLotta/bo1-zombies-coop/releases/latest) e descompacte.
2. No Chrome, abra `chrome://extensions` e ligue o **Modo do desenvolvedor** (canto superior direito).
3. Clique em **Carregar sem compactação** e escolha a pasta descompactada (a que tem o `manifest.json`).
4. Abra o [vel.gg/bo1z](https://vel.gg/bo1z/). O cartão **Co-op** aparece no canto superior direito.

### Jogar

**Host:** clique em **Hospedar partida**, depois em **Copiar link**, e mande para os amigos. Escolha o mapa (todos vão
junto). Espere na tela "click to start" até todos aparecerem como **Pronto** no lobby e clique no jogo.

**Amigos:** abram o link e apertem qualquer tecla quando a página pedir, para carregar o mapa. Quando o cartão disser
**Você entrou**, cliquem no jogo.

Dicas: coloque seu nome em **Configurações**. Se alguém cair, é só clicar em **Voltar para a partida** (quem entra
depois do início assiste até a próxima rodada, como no jogo original). Nasceu longe? **Ir até o host**.

### Problemas comuns

| Problema | O que fazer |
| --- | --- |
| "O vel.gg atualizou o motor do jogo…" | Saiu um motor novo; o co-op se desliga até a extensão ser atualizada. Veja se há versão nova. |
| "Versões diferentes do jogo" | Os dois recarregam a página. |
| "Esta partida está cheia" | A sala comporta 4 jogadores. |
| Parado em "Na fila para entrar" | Os jogadores entram um de cada vez; em até um minuto anda. Se não, recarregue. |
| O co-op parou para todo mundo ao mesmo tempo | A cota grátis diária do relay pode ter acabado; renova à meia-noite UTC. Dá para usar um relay próprio (veja acima, em inglês). |
