# card-games

Card games for [the arcade](https://www.lokeshmohanty.in/games/), in a
repository of their own. It is registered exactly as anyone's repository
would be (`registry/lokeshmohanty/card-games.json` in
[lokeshmohanty/games](https://github.com/lokeshmohanty/games)), like its
sibling [lokeshmohanty/web-games](https://github.com/lokeshmohanty/web-games).

| Game | Folder | Players | What it is |
|---|---|---|---|
| Glowdown | [`glowdown/`](glowdown) | 2–8 | A shedding game with a deck of its own: five suits of the night sky (Nova, Comet, Crystal, Orbit, Eclipse), numbers 1–8, SPARK +1, ECHO, GIFT and PRISMs; 60 cards, five each, placed by cards left. House rules the host switches on: stack sparks, snap, prisms pass hands, draw until you can play |
| Guess What | [`guess-what/`](guess-what) | 2–8 | A picture clue party game: everyone sees the picture but the guesser, who picks it from nine. Across phones (clues out loud or typed), or on one phone with people sharing it. 343 pictures in six categories (Emoji 11 or older, so Android 9 draws them), none repeated until all are seen |
| 29 | [`twenty-nine/`](twenty-nine) | 4 | The traditional Indian trick-taking game: two partnerships, bids 16–28, a hidden trump shown on demand, J 3 · 9 2 · A 1 · 10 1; the pair rule as an option |

Every game is multiplayer: alone, bots fill the other seats (they bid, play,
give clues and guess). All three are SDK v2 **managed** games
([docs/sdk-v2.md](https://github.com/lokeshmohanty/games/blob/main/docs/sdk-v2.md)):
the rules (`init / apply / view / turn / bot / result / snapshot / restore`)
run on the host, and each phone sees only its own view — its own hand, the
trump only once it is shown, the picture only if it is not guessing.

Each folder is one game:

```
game.json          the manifest (id, name, kind, seats, licence, "sdk": 2…)
index.html         the entry page — only the game's own scripts
<game>-rules.js    the rules and the bots: no document, no platform
<game>.js          the page: arcade.managed(rules) and the table
RULES.md           how to play, shown by the arcade on a first open and behind "?"
preview.gif        the portal card
test-<game>.mjs    rules tests (not served)
```

Guess What's pictures are in `guess-what/guess-what-pictures.js`: emoji,
each with its names and three clues for the bots. Add more there.

## Play one from your machine

```sh
curl -fsSLO https://www.lokeshmohanty.in/games/sdk/dev-server.mjs
node dev-server.mjs
```

and open the link it prints for a game: the live arcade loads it from this
folder. Edit, reload. **PLAY A BOT** to play alone; **INVITE A FRIEND** and
open the invite in a second tab to play yourself.

## Test

The rules tests need nothing but Node:

```sh
for t in */test-*.mjs; do node "$t" || exit 1; done
```

And the arcade's own check, with a browser, from a checkout of
`lokeshmohanty/games`:

```sh
just validate-game ../card-games/glowdown  # or every folder at once
```

## Ideas for later

Suggested, not built: Bluff, Rummy, Kachuful (Judgement), Hearts.

## Shipping a change

Commit and push here, then open a pull request on `lokeshmohanty/games`
bumping `"commit"` in `registry/lokeshmohanty/card-games.json` to the new
sha. The workflow is the same for anyone: see
[CONTRIBUTING.md](https://github.com/lokeshmohanty/games/blob/main/CONTRIBUTING.md).

MIT licensed.
