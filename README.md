<p align="center"><picture><source media="(prefers-color-scheme: dark)" srcset=".github/logo-dark.png"><img src=".github/logo-light.png" height="72" alt="Yoongo"></picture></p>

<p align="center">Go in the browser.<br>No accounts, no build step.</p>

<p align="center"><a href="https://yoonzky.github.io/yoongo/"><b>Play</b></a>&nbsp;&nbsp;&nbsp;&nbsp;<a href="#features">Features</a>&nbsp;&nbsp;&nbsp;&nbsp;<a href="#how-it-works">How it works</a>&nbsp;&nbsp;&nbsp;&nbsp;<a href="#license">License</a></p>

<p align="center"><img src=".github/preview.png" alt="Yoongo on a desktop and a phone"></p>

## Features

- Play the bot at four levels or a friend on one screen, on 7x7, 9x9, 13x13 and 19x19.
- Territory or capture go (first to take 1, 3 or 5 stones), handicap, komi, a clock with byo-yomi.
- Generated problems in four levels: capture, saving stones, life and death. Each has one correct first move, checked by a solver, and the opponent answers with the most stubborn defence.
- Two classic collections, Xuanxuan Qijing and Guanzi Pu, with the solution lines from the books.
- Optional jump to the next problem after a correct solution.
- Path: a rough strength estimate in kyu from games and first tries at problems.
- Russian and English, light and dark theme, a phone layout with a zoomed big board.
- Keyboard: arrows move over the board, Enter places a stone, Z undoes.

## Rules

Area scoring (Chinese), komi 7.5, positional superko, no suicide. After two passes the bot marks dead groups, a tap on a group changes that, then the score is counted.

## How it works

- `js/engine/` has no DOM and runs in a worker: rules with Zobrist hashing, an MCTS bot with RAVE and light playouts on a board with pseudo-liberties, a life and death solver (Benson for unconditional life, iterative deepening, transposition table).
- `js/app/` is the interface: i18n, storage, SVG board, pages, game, problems.
- `data/problems.js` holds the generated problems, `data/classics.js` the classic collections.
- Everything is kept in localStorage: settings, up to eight unfinished games, solved problems and a log for statistics.

The worker does not start from `file://`, so serve the folder with any static server, for example `python3 -m http.server`.

## License

Code and generated problems: [AGPL-3.0](LICENSE), Copyright (C) 2026 yoonzky. The classic collections come from third parties, see [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md).
