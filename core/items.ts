import {
  forEachCell,
  getEightDirectionsNeighbors,
  getLineCells,
  isValidCell,
} from "./utils.ts";
import { Cell, Items } from "./interfaces.ts";

export const ITEMS: Items = {
  // 通常アイテム (F1+)
  reveal_one_trap: {
    name: { ja: "千里眼の巻物", en: "Scroll of Clairvoyance" },
    description: {
      ja: "プレイヤーの周囲8マスにある罠をすべて明らかにする。",
      en: "Reveals all traps within 8 squares of the player.",
    },
    key: "r",
    minFloor: 1,
    maxFloor: Infinity,
    use: function (game) {
      const neighborsToReveal = getEightDirectionsNeighbors(
        game.player.r,
        game.player.c,
        game.rows,
        game.cols,
      );
      let cellRevealed = false;
      for (const neighbor of neighborsToReveal) {
        const cell = game.grid[neighbor.r][neighbor.c];
        if (!cell.isRevealed) cellRevealed = true;
        if (cell.isTrap) {
          cell.isRevealed = true;
          cell.isFlagged = true; // Mark revealed trap
        } else {
          game.revealFrom(neighbor.r, neighbor.c);
        }
      }
      if (cellRevealed) {
        return { consumed: true };
      } else {
        return { consumed: false };
      }
    },
  },
  trap_shield: {
    name: { ja: "鉄の心臓", en: "Heart of Iron" },
    description: {
      ja: "罠を踏んだ時に1度だけ身代わりになる。(パッシブ)",
      en:
        "When stepping on a trap, you can become a substitute once. (Passive)",
    },
    key: null,
    minFloor: 1,
    maxFloor: Infinity,
  },
  reduce_traps: {
    name: { ja: "解体の手引き", en: "Disassembly Guide" },
    description: {
      ja: "プレイヤーから周囲8マスのランダムな罠1つを無効化する。",
      en: "Disables one random trap within 8 squares of the player.",
    },
    key: "t",
    minFloor: 1,
    maxFloor: 10,
    use: function (game) {
      const neighborsForTrapCheck = getEightDirectionsNeighbors(
        game.player.r,
        game.player.c,
        game.rows,
        game.cols,
      );
      const trapsInVicinity = neighborsForTrapCheck.filter((cellPos) =>
        game.grid[cellPos.r][cellPos.c].isTrap
      );

      if (trapsInVicinity.length > 0) {
        const trapToDemolish =
          trapsInVicinity[Math.floor(Math.random() * trapsInVicinity.length)];
        const cellToClear = game.grid[trapToDemolish.r][trapToDemolish.c];
        cellToClear.isTrap = false;
        cellToClear.isFlagged = false; // 罠と同時にフラグも解除
        game.calculateNumbers();
        return { consumed: true };
      } else {
        return {
          consumed: false,
          message: {
            ja: "解除対象の罠は存在しない。",
            en: "No trap within 8 squares of the player.",
          },
        };
      }
    },
  },
  reveal_exit: {
    name: { ja: "出口の地図", en: "Map of Exit" },
    description: {
      ja: "現在のフロアの出口(E)の位置を明らかにする。",
      en: "Reveal the location of exit(E) on the current floor.",
    },
    key: "e",
    minFloor: 1,
    maxFloor: 8,
    use: function (game) {
      if (!game.grid[game.exit.r][game.exit.c].isRevealed) {
        game.grid[game.exit.r][game.exit.c].isRevealed = true;
        return { consumed: true };
      }
      return {
        consumed: false,
        message: {
          ja: "出口はすでに判明している。",
          en: "The exit is already revealed.",
        },
      };
    },
  },
  long_jump: {
    name: { ja: "跳躍のブーツ", en: "Jumping Boots" },
    description: {
      ja: "指定した方向に1マス飛び越えて、2マス先に進む。",
      en:
        "Jump one square in the specified direction and move two squares forward.",
    },
    key: "j",
    minFloor: 1,
    maxFloor: Infinity,
    use: function (game) {
      game.gameState = "jumping_direction";
      return { consumed: false };
    },
  },
  // 拡張アイテム (F5+)
  recon_drone: {
    name: { ja: "偵察ドローン", en: "Reconnaissance Drone" },
    description: {
      ja:
        "使用時、上下左右のいずれかの方向を指定する。ドローンがその方向へ一直線に飛び、通路（数字が書かれたマス）を次々と開示していく。もし進路上に罠があった場合、その罠を開示して停止する。",
      en:
        "When used, you can choose a direction: up, down, left, or right. The drone will fly in a straight line in that direction, revealing passages (squares with numbers written on them) one after another. If there is a trap in its path, it will reveal the trap and stop.",
    },
    key: "c",
    minFloor: 5,
    maxFloor: Infinity,
    use: function (game) {
      game.gameState = "recon_direction";
      return { consumed: false };
    },
  },
  ariadnes_thread: {
    name: { ja: "アリアドネの糸", en: "Ariadne's Thread" },
    description: {
      ja:
        "使用すると、プレイヤーから出口までの「最短経路」がマップ上に示される。経路上のマスはすべて開示されるが、そこにある罠もすべて表示される。",
      en:
        'When used, the "shortest path" from the player to the exit is displayed on the map, revealing all squares along the path, including any traps.',
    },
    key: "g",
    minFloor: 5,
    maxFloor: Infinity,
    use: function (game) {
      const path = getLineCells(
        game.player.r,
        game.player.c,
        game.exit.r,
        game.exit.c,
      );
      if (path && path.length > 0) {
        path.forEach((pos) => {
          const cell = game.grid[pos.r][pos.c];
          cell.isRevealed = true;
          if (cell.isTrap) {
            cell.isFlagged = true; // Mark revealed trap
          } else {
            cell.isFlagged = false;
          }
        });
      }
      return { consumed: true };
    },
  },
  detailed_map_of_exit: {
    name: { ja: "詳細な出口の地図", en: "Detailed exit map" },
    description: {
      ja:
        "出口の位置を明らかにすると同時に、出口に隣接する周囲8マスの状態もすべて開示する。",
      en:
        "When revealing the location of the exit, the state of all eight squares surrounding the exit is also revealed.",
    },
    key: "x",
    minFloor: 5,
    maxFloor: Infinity,
    use: function (game) {
      const cellsToReveal = getEightDirectionsNeighbors(
        game.exit.r,
        game.exit.c,
        game.rows,
        game.cols,
      );
      cellsToReveal.push({ r: game.exit.r, c: game.exit.c });

      // これから開示しようとするマスの中に、まだ開示されていないマスがあるかチェック
      const hasUnrevealedCell = cellsToReveal.some((pos) =>
        isValidCell(pos.r, pos.c, game.rows, game.cols) &&
        !game.grid[pos.r][pos.c].isRevealed
      );

      if (hasUnrevealedCell) {
        game.grid[game.exit.r][game.exit.c].isRevealed = true; // 出口の位置は判明済みにする
        for (const pos of cellsToReveal) {
          // revealFromは内部でisRevealedチェックをするので、そのまま呼んでもOK
          //念のためisValidCellも実行
          if (
            isValidCell(pos.r, pos.c, game.rows, game.cols)
          ) {
            game.revealFrom(pos.r, pos.c);
          }
        }
        return { consumed: true };
      } else {
        // 開示する新しいマスが何もない場合
        return {
          consumed: false,
          message: {
            ja: "出口の周囲はすべて判明している。",
            en: "The entire area surrounding the exit is revealed.",
          },
        };
      }
    },
  },
  // 上位アイテム (F10+)
  philosophers_stone: {
    name: { ja: "賢者の石", en: "Philosopher's Stone" },
    description: {
      ja: "使用すると、プレイヤーの周囲5x5の広大な範囲を一度に開示する。",
      en: "When used, it reveals a vast 5x5 area around the player at once.",
    },
    key: "p",
    minFloor: 10,
    maxFloor: Infinity,
    use: function (game) {
      let cellRevealed = false;

      for (let i = -2; i <= 2; i++) {
        for (let j = -2; j <= 2; j++) {
          const nR = game.player.r + i;
          const nC = game.player.c + j;
          if (
            isValidCell(nR, nC, game.rows, game.cols)
          ) {
            const cell = game.grid[nR][nC];
            if (!cell.isRevealed) cellRevealed = true;
            if (cell.isTrap) {
              cell.isRevealed = true;
              cell.isFlagged = true; // Mark revealed trap
            } else {
              game.revealFrom(nR, nC);
            }
          }
        }
      }
      if (cellRevealed) {
        return { consumed: true };
      } else {
        return { consumed: false };
      }
    },
  },
  scroll_of_chaos: {
    name: { ja: "無秩序の巻物", en: "Scroll of Chaos" },
    description: {
      ja:
        "使用すると、まだ開示もフラグもされていない全てのマスで、罠の配置をシャッフル（再配置）する。罠の総数は変わらない。",
      en:
        "When used, it shuffles (rearranges) trap placements on all squares that have not yet been revealed or flagged, but the total number of traps remains the same.",
    },
    key: "k",
    minFloor: 10,
    maxFloor: Infinity,
    use: function (game) {
      // 1. 出口とアイテムマスの隣接マスを「罠配置禁止ゾーン」として定義
      const protectedCells: { r: number; c: number }[] = [];
      forEachCell(game.grid, (cell, r, c) => {
        if ((r === game.exit.r && c === game.exit.c) || cell.itemId) {
          protectedCells.push({ r, c });
        }
      });

      const forbiddenZones = new Set();
      protectedCells.forEach((pos) => {
        // 自分自身も禁止ゾーンに含める
        forbiddenZones.add(`${pos.r},${pos.c}`);
        // 隣接マスを禁止ゾーンに追加
        const neighbors = getEightDirectionsNeighbors(
          pos.r,
          pos.c,
          game.rows,
          game.cols,
        );
        neighbors.forEach((n) => forbiddenZones.add(`${n.r},${n.c}`));
      });

      // 2. シャッフル対象のセルを決定
      const shufflableCells: Cell[] = [];
      let trapCountToShuffle = 0;
      forEachCell(game.grid, (cell, r, c) => {
        if (
          !cell.isRevealed && !cell.isFlagged &&
          !forbiddenZones.has(`${r},${c}`)
        ) {
          shufflableCells.push(cell);
          if (cell.isTrap) {
            trapCountToShuffle++;
            cell.isTrap = false; // 一旦すべての罠をクリア
          }
        }
      });

      // 3. シャッフル実行 (Fisher-Yates shuffle)
      for (let i = shufflableCells.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shufflableCells[i], shufflableCells[j]] = [
          shufflableCells[j],
          shufflableCells[i],
        ];
      }

      // 4. 新しい位置に罠を配置
      for (let i = 0; i < trapCountToShuffle; i++) {
        shufflableCells[i].isTrap = true;
      }

      // 5. 盤面を更新
      game.calculateNumbers();
      return { consumed: true };
    },
  },
};
