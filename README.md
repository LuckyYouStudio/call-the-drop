# Call the Drop

A dark-fantasy loot casino for the Chain casino SDK. Pick a boss, read its loot table, and call
which item it drops. Call it right and you win the payout **and** the item — wear it, raise your
Power, and push on to the raids.

- **One mechanic, fully legible:** each kill reveals exactly one item from the table shown on
  screen. Pick one item for long odds or several for a safer, smaller payout.
- **Pays = 96% ÷ your win chance.** A single 25% item pays 3.84×; three items totalling 60% pay 1.6×.
- **RPG on top, never in the odds:** 5 original classes, 10 dungeons and raids (31 bosses),
  levels, Power, bags and gear upgrades. Progression only decides where you may fight.
- **All original:** names, world and every picture (item icons, boss portraits, class emblems)
  are generated in code — no external art or third-party IP.
- English and 中文, hero and "called it" share cards, standalone demo with play gold.

## Math (declared RTP 96%)

A boss table has item weights `w₀…wₙ₋₁` (2 ≤ n ≤ 32). The player submits the table and a pick
mask. One VRF word gives a uniform roll in `[0, W)`, `W = Σw`, by rejection sampling; the item whose
cumulative weight first exceeds the roll drops. If it is picked, the payout is

```
payout = wager × 0.96 × W / P        P = Σ weights of the picked items
```

so `E[payout] = (P / W) × wager × 0.96 × W / P = 0.96 × wager` for **every** table and **every**
pick (up to wei rounding, which only rounds down). A player who forges the table changes the odds
they are offered, never the edge — so no game data lives on chain. Limits: at least one item left
unpicked, and `0.96 × W / P ≤ 1000` (max 1000×).

## Layout

```
game/
  contracts/CallTheDropGame.sol   ICasinoGameV2 implementation (pure, no constructor args)
  src/odds.ts                     exact TS mirror: gameData/gameState codecs, payout, demo roll
  src/contract.test.ts            compiles the contract with solc, runs it in an in-process EVM,
                                  checks it against odds.ts (random tables, caps, risk, reverts)
  src/world.ts                    hand-written world + seeded item generator
  src/art.ts                      all artwork, drawn on canvas
  src/character.ts                classes, gear rules, Power, progression
  src/main.ts                     UI, host bridge (live) and demo mode
  public/game.manifest.json
```

## Run

```sh
cd game
npm install
npm run dev     # http://localhost:5175 — opened directly it runs the demo
npm test        # contract + world tests
npm run build
```

Local simulator: copy `game/contracts/CallTheDropGame.sol` into the SDK's
`simulator/contracts/`, run `npm start` there, and open
`http://localhost:3300/?game=http://localhost:5175&gameAddress=<deployed address>`.
