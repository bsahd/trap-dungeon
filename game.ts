import {
  Cell,
  GameI,
  GameLoopResult,
  Item,
  MultilingualText,
} from "./interfaces.ts";
import { ITEMS } from "./items.ts";
import {
  forEachCell,
  getEightDirectionsNeighbors,
  isGoalInitiallyVisible,
  isSolvable,
  isValidCell,
} from "./utils.ts";

export class Game implements GameI {
  grid: GameI["grid"] = [];
  rows: GameI["rows"] = 8;
  cols: GameI["cols"] = 8;
  player: GameI["player"] = { r: 0, c: 0, items: [] };
  exit: GameI["exit"] = { r: 0, c: 0 };
  floorNumber: GameI["floorNumber"] = 1;
  turn: GameI["turn"] = 0;
  gameState: GameI["gameState"] = "playing"; // playing, confirm_next_floor, choosing_item, jumping_direction, recon_direction, gameover
  exitRevealedThisFloor: GameI["exitRevealedThisFloor"] = false;
  REVELATION_THRESHOLD = 0.5; // 開示率のしきい値 (50%)
  uiEffect: string | null = null;
  justAcquiredItem: GameI["justAcquiredItem"] = null;

  currentItemChoices: GameI["currentItemChoices"] = [];

  floorRevelationRates: GameI["floorRevelationRates"] = [];
  finalFloorNumber: GameI["finalFloorNumber"] = 0;
  finalItems: GameI["finalItems"] = [];
  lastActionMessage?: MultilingualText;
  tutorialToShow: { title: string; content: string } | null = null;

  resetGame() {
    this.grid = [];
    this.rows = 8;
    this.cols = 8;
    this.player = { r: 0, c: 0, items: [] };
    this.exit = { r: 0, c: 0 };
    this.floorNumber = 1;
    this.turn = 0;
    this.gameState = "playing";
    this.exitRevealedThisFloor = false;
    this.justAcquiredItem = null;
    this.currentItemChoices = [];
    this.floorRevelationRates = [];
    this.finalFloorNumber = 0;
    this.finalItems = [];
    this.lastActionMessage = undefined;
    this.tutorialToShow = null;
  }
  getAvailableItems() {
    const currentFloor = this.floorNumber;
    return Object.keys(ITEMS).filter((id) => {
      const item = ITEMS[id];
      const minFloor = item.minFloor || 1;
      const maxFloor = item.maxFloor || Infinity;
      return currentFloor >= minFloor && currentFloor <= maxFloor;
    });
  }

  hasItem(itemId: string) {
    return this.player.items.includes(itemId);
  }

  setupFloor() {
    this.player.r = Math.floor(Math.random() * this.rows);
    this.player.c = Math.floor(Math.random() * this.cols);

    Object.assign(this, {
      turn: 0,
      gameState: "playing",
      exitRevealedThisFloor: false,
    });

    if (this.floorNumber === 1) {
      this.floorRevelationRates = [];
      this.finalFloorNumber = 0;
      this.finalItems = [];
    }

    if (this.floorNumber === 5) {
      this.tutorialToShow = {
        title: "新ギミック：見通しの悪いマス",
        content: `このフロアから、ひび割れた「見通しの悪いマス」が登場します。

このマスに表示される数字は、そのマスの「上下左右」4方向にある罠の数のみを示しており、「斜め」方向の罠はカウントしません。

開示して初めて判明するため、注意深く探索しましょう。`,
      };
    }

    this.rows = 8 + Math.floor(this.floorNumber / 3);
    this.cols = 8 + Math.floor(this.floorNumber / 3);

    const trapCount = 6 + this.floorNumber * 2;

    if (this.floorNumber === 1) {
      const allAvailableItemIds = this.getAvailableItems();
      const availableItems = allAvailableItemIds.filter((id: string) =>
        !this.player.items.includes(id)
      );
      if (availableItems.length > 0) {
        const randomItemId =
          availableItems[Math.floor(Math.random() * availableItems.length)];
        this.player.items.push(randomItemId);
      }
    }

    let solvable = false;
    let goalInitiallyVisible = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 100;

    do {
      attempts++;
      if (attempts > MAX_ATTEMPTS) {
        console.warn(
          "Failed to generate a valid grid after",
          MAX_ATTEMPTS,
          "attempts. Forcing generation.",
        );
        break;
      }

      this.generateGrid();
      this.placeTraps(trapCount);
      this.calculateNumbers();

      const validCells: { r: number; c: number }[] = [];
      forEachCell(this.grid, (cell, r, c) => {
        if (
          !cell.isTrap && cell.adjacentTraps === 0 &&
          !(r === this.player.r && c === this.player.c)
        ) {
          validCells.push({ r, c });
        }
      });

      if (validCells.length < 2) {
        solvable = false;
        continue;
      }

      const exitIndex = Math.floor(Math.random() * validCells.length);
      const exitPos = validCells.splice(exitIndex, 1)[0];
      this.exit.r = exitPos.r;
      this.exit.c = exitPos.c;

      const allPlaceableAvailable = this.getAvailableItems();
      const placeableItems = allPlaceableAvailable.filter((
        id: string | number,
      ) => ITEMS[id].key !== null);
      const numberOfItemsToPlace = 2;

      for (let i = 0; i < numberOfItemsToPlace; i++) {
        if (placeableItems.length > 0 && validCells.length > 0) {
          const validCellIndex = Math.floor(Math.random() * validCells.length);
          const itemPos = validCells.splice(validCellIndex, 1)[0];
          const randomItemId =
            placeableItems[Math.floor(Math.random() * placeableItems.length)];
          this.grid[itemPos.r][itemPos.c].itemId = randomItemId;
        }
      }

      solvable = isSolvable(
        this.grid,
        this.player.r,
        this.player.c,
        this.exit.r,
        this.exit.c,
      );
      goalInitiallyVisible = isGoalInitiallyVisible(
        this.grid,
        this.player.r,
        this.player.c,
        this.exit.r,
        this.exit.c,
      );
    } while (!solvable || goalInitiallyVisible);

    // --- 「見通しの悪いマス」の配置と数字の再計算 ---
    // ループで盤面が確定した後に、ギミックを適用する
    if (this.floorNumber >= 5) {
      const safeCells: Cell[] = [];
      // プレイヤーの周囲9マスは安全地帯とする
      const playerArea = new Set();
      const playerNeighbors = getEightDirectionsNeighbors(
        this.player.r,
        this.player.c,
        this.rows,
        this.cols,
      );
      playerArea.add(`${this.player.r},${this.player.c}`);
      playerNeighbors.forEach((pos) => playerArea.add(`${pos.r},${pos.c}`));

      forEachCell(this.grid, (cell, r, c) => {
        const isExit = r === this.exit.r && c === this.exit.c;
        // 罠でもなく、プレイヤーの周囲でもなく、アイテムマスでもなく、出口でもないマスを候補とする
        if (
          !cell.isTrap && !playerArea.has(`${r},${c}`) && !cell.itemId &&
          !isExit
        ) {
          safeCells.push(cell);
        }
      });

      // 安全なマスの15%を「見通しの悪いマス」にする
      const obscureCount = Math.floor(safeCells.length * 0.15);
      for (let i = 0; i < obscureCount; i++) {
        if (safeCells.length === 0) break;
        const randomIndex = Math.floor(Math.random() * safeCells.length);
        const selectedCell = safeCells.splice(randomIndex, 1)[0];
        selectedCell.isObscured = true;
      }

      // 「見通しの悪いマス」を適用したことで数字が変わるため、再計算する
      this.calculateNumbers();
    }

    this.revealFrom(this.player.r, this.player.c);
  }

  generateGrid() {
    this.grid = Array.from(
      { length: this.rows },
      () =>
        Array.from({ length: this.cols }, () => ({
          isTrap: false,
          isRevealed: false,
          adjacentTraps: 0,
          isFlagged: false,
          isObscured: false,
        })),
    );
  }

  placeTraps(trapCount: number) {
    const forbiddenTrapZones = getEightDirectionsNeighbors(
      this.player.r,
      this.player.c,
      this.rows,
      this.cols,
    );
    forbiddenTrapZones.push({ r: this.player.r, c: this.player.c });

    let trapsPlaced = 0;
    while (trapsPlaced < trapCount) {
      const r = Math.floor(Math.random() * this.rows);
      const c = Math.floor(Math.random() * this.cols);

      const isForbidden = forbiddenTrapZones.some((pos) =>
        pos.r === r && pos.c === c
      );
      const isExit = r === this.exit.r && c === this.exit.c;

      if (!this.grid[r][c].isTrap && !isExit && !isForbidden) {
        this.grid[r][c].isTrap = true;
        trapsPlaced++;
      }
    }
  }

  calculateNumbers() {
    forEachCell(this.grid, (cell, r, c) => {
      if (cell.isTrap) return;
      let trapCount = 0;
      const neighbors = getEightDirectionsNeighbors(r, c, this.rows, this.cols);

      if (cell.isObscured) {
        // 「見通しの悪いマス」は上下左右4方向のみチェック
        const crossNeighbors = neighbors.filter((n) => n.r === r || n.c === c);
        for (const neighbor of crossNeighbors) {
          if (this.grid[neighbor.r][neighbor.c].isTrap) {
            trapCount++;
          }
        }
      } else {
        // 通常のマスは8方向をチェック
        for (const neighbor of neighbors) {
          if (this.grid[neighbor.r][neighbor.c].isTrap) {
            trapCount++;
          }
        }
      }
      cell.adjacentTraps = trapCount;
    });
  }

  revealFrom(r: number, c: number) {
    if (
      !isValidCell(r, c, this.rows, this.cols) || this.grid[r][c].isRevealed
    ) return;

    const cell = this.grid[r][c];
    cell.isRevealed = true;
    cell.isFlagged = false;

    // 罠のマスでは再帰しない、かつ、隣接する罠が0のマスでのみ再帰する
    if (!cell.isTrap && cell.adjacentTraps === 0) {
      let neighbors;
      if (cell.isObscured) {
        // 「見通しの悪いマス」からは4方向にのみ再帰
        const allNeighbors = getEightDirectionsNeighbors(
          r,
          c,
          this.rows,
          this.cols,
        );
        neighbors = allNeighbors.filter((n) => n.r === r || n.c === c);
      } else {
        // 通常のマスからは8方向に再帰
        neighbors = getEightDirectionsNeighbors(r, c, this.rows, this.cols);
      }

      for (const neighbor of neighbors) {
        this.revealFrom(neighbor.r, neighbor.c);
      }
    }
  }

  toggleFlag(r: number, c: number) {
    if (isValidCell(r, c, this.rows, this.cols)) {
      const cell = this.grid[r][c];
      if (!cell.isRevealed) {
        cell.isFlagged = !cell.isFlagged;
      }
    }
  }

  calculateRevelationRate() {
    let revealedCount = 0;
    forEachCell(this.grid, (cell) => {
      if (cell.isRevealed) {
        revealedCount++;
      }
    });
    return revealedCount / (this.rows * this.cols);
  }

  getDisplayState() {
    return {
      grid: this.grid,
      player: { r: this.player.r, c: this.player.c },
      exit: this.exit,
      floorNumber: this.floorNumber,
      items: this.player.items,
      turn: this.turn,
      gameState: this.gameState,
      currentItemChoices: this.currentItemChoices,
      exitRevealedThisFloor: this.exitRevealedThisFloor,
    };
  }

  handleInput(key: string) {
    key = key.toLowerCase();

    if (this.gameState === "confirm_next_floor") {
      if (key === "yes") {
        const currentRevelationRate = this.calculateRevelationRate();
        this.floorRevelationRates.push({
          floor: this.floorNumber,
          rate: currentRevelationRate,
        });
        if (currentRevelationRate < this.REVELATION_THRESHOLD) {
          this.lastActionMessage = {
            ja: `フロア開示率が${
              (this.REVELATION_THRESHOLD * 100).toFixed(0)
            }%未満のため、アイテムボーナスはありませんでした。（${
              (currentRevelationRate * 100).toFixed(0)
            }%)`,
            en:
              `There were no item bonuses as the floor disclosure rate was less than ${
                (this.REVELATION_THRESHOLD * 100).toFixed(0)
              }%.${(currentRevelationRate * 100).toFixed(0)}%)`,
          };
          this.floorNumber++;
          this.setupFloor();
        } else {
          this.gameState = "choosing_item";
          this.showItemChoiceScreen();
        }
      } else {
        this.gameState = "playing";
      }
    } else if (this.gameState === "choosing_item") {
      const selectedIndex = parseInt(key, 10) - 1;
      if (
        selectedIndex >= 0 && selectedIndex < this.currentItemChoices.length
      ) {
        const chosenId = this.currentItemChoices[selectedIndex];
        this.player.items.push(chosenId);
      }
      return { action: "next_floor_after_delay" };
    } else if (this.gameState === "recon_direction") {
      let dr = 0, dc = 0, directionChosen = false;
      switch (key) {
        case "w":
          dr = -1;
          directionChosen = true;
          break;
        case "a":
          dc = -1;
          directionChosen = true;
          break;
        case "s":
          dr = 1;
          directionChosen = true;
          break;
        case "d":
          dc = 1;
          directionChosen = true;
          break;
        default:
          this.gameState = "playing";
          this.lastActionMessage = {
            ja: "偵察ドローンの使用をキャンセルしました。",
            en: "Cancelled the use of the recon drone.",
          };
          return this.gameLoop();
      }
      if (directionChosen) {
        const itemIndex = this.player.items.indexOf("recon_drone");
        if (itemIndex > -1) this.player.items.splice(itemIndex, 1);
        let r = this.player.r, c = this.player.c;
        while (true) {
          r += dr;
          c += dc;
          if (!isValidCell(r, c, this.rows, this.cols)) break;
          const cell = this.grid[r][c];
          if (cell.isTrap) {
            cell.isRevealed = true;
            cell.isFlagged = true;
            break;
          } else {
            this.revealFrom(r, c);
          }
        }
        this.gameState = "playing";
        this.turn++;
        this.processPlayerLocation();
      }
    } else if (this.gameState === "jumping_direction") {
      let jumpRow = this.player.r, jumpCol = this.player.c, jumped = false;
      switch (key) {
        case "w":
          jumpRow -= 2;
          jumped = true;
          break;
        case "a":
          jumpCol -= 2;
          jumped = true;
          break;
        case "s":
          jumpRow += 2;
          jumped = true;
          break;
        case "d":
          jumpCol += 2;
          jumped = true;
          break;
        default:
          this.gameState = "playing";
          this.lastActionMessage = {
            ja: "跳躍のブーツの使用をキャンセルしました。",
            en: "Cancelled use of Jumping Boots.",
          };
          return this.gameLoop();
      }
      if (jumped && isValidCell(jumpRow, jumpCol, this.rows, this.cols)) {
        const itemIndex = this.player.items.indexOf("long_jump");
        if (itemIndex > -1) this.player.items.splice(itemIndex, 1);
        this.player.r = jumpRow;
        this.player.c = jumpCol;
        this.gameState = "playing";
        this.turn++;
        this.processPlayerLocation();
      } else {
        this.gameState = "playing";
      }
    } else if (this.gameState === "playing") {
      let newRow = this.player.r,
        newCol = this.player.c,
        moved = false,
        itemUsed = false;
      const itemToUseId = Object.keys(ITEMS).find((id) =>
        ITEMS[id].key === key
      );
      if (itemToUseId && this.hasItem(itemToUseId)) {
        const item = ITEMS[itemToUseId];
        if (item.use) {
          const result = item.use(this);
          itemUsed = true;
          if (result.consumed) {
            const itemIndex = this.player.items.indexOf(itemToUseId);
            if (itemIndex > -1) this.player.items.splice(itemIndex, 1);
          }
          if (result.message) this.lastActionMessage = result.message;
        }
      } else {
        switch (key) {
          case "w":
            newRow--;
            moved = true;
            break;
          case "a":
            newCol--;
            moved = true;
            break;
          case "s":
            newRow++;
            moved = true;
            break;
          case "d":
            newCol++;
            moved = true;
            break;
        }
      }
      if (moved) {
        if (isValidCell(newRow, newCol, this.rows, this.cols)) {
          if (this.grid[newRow][newCol].isFlagged) {
            this.lastActionMessage = {
              ja: "チェックしたマスには移動できません。",
              en: "You cannot move to a checked square.",
            };
            return this.gameLoop();
          }
          this.player.r = newRow;
          this.player.c = newCol;
        } else {
          return this.gameLoop();
        }
      }
      if (moved || (itemUsed && this.gameState === "playing")) {
        this.turn++;
        this.processPlayerLocation();
      }
    }
    return this.gameLoop();
  }

  processPlayerLocation() {
    const currentCell = this.grid[this.player.r][this.player.c];
    if (this.player.r === this.exit.r && this.player.c === this.exit.c) {
      this.gameState = "confirm_next_floor";
    }
    if (currentCell.isTrap) {
      if (this.hasItem("trap_shield")) {
        const index = this.player.items.indexOf("trap_shield");
        this.player.items.splice(index, 1);
        currentCell.isTrap = false;
        this.calculateNumbers();
        this.revealFrom(this.player.r, this.player.c);
        this.uiEffect = "flash_red";
        this.lastActionMessage = {
          ja: "鉄の心臓が身代わりになった！",
          en: "The Iron Heart has taken its place!",
        };
      } else {
        currentCell.isRevealed = true;
        this.gameState = "gameover";
        this.lastActionMessage = {
          ja: "罠を踏んでしまった！",
          en: "I stepped into a trap!",
        };
      }
    }
    if (currentCell.itemId) {
      const itemId = currentCell.itemId;
      this.player.items.push(itemId);
      currentCell.itemId = undefined;
      this.justAcquiredItem = itemId;
    }
    if (this.gameState !== "gameover") {
      this.revealFrom(this.player.r, this.player.c);
    }
  }

  showItemChoiceScreen() {
    const choices: string[] = [];
    const itemIds = this.getAvailableItems();
    while (choices.length < 3 && choices.length < itemIds.length) {
      const randomId = itemIds[Math.floor(Math.random() * itemIds.length)];
      if (!choices.includes(randomId)) {
        choices.push(randomId);
      }
    }
    this.currentItemChoices = choices;
  }

  gameLoop(): GameLoopResult {
    if (this.gameState === "gameover") {
      this.finalFloorNumber = this.floorNumber;
      this.finalItems = [...this.player.items];
      return {
        displayState: this.getDisplayState(),
        message: "!!! GAME OVER !!!",
        gameState: "gameover",
        result: {
          floorRevelationRates: this.floorRevelationRates,
          finalFloorNumber: this.finalFloorNumber,
          finalItems: this.finalItems.reduce((counts, id) => {
            counts[id] = (counts[id] || 0) + 1;
            return counts;
          }, {} as { [x: string]: number }),
        },
      };
    }
    let promptText = "Move (w/a/s/d)";
    const itemActions = this.player.items
      .map((id) => ITEMS[id])
      .filter((item) => item.key)
      .map((item) => `${item.key}: ${item.name}`);
    if (itemActions.length > 0) {
      promptText += ` | Use Item (${itemActions.join(", ")})`;
    }
    promptText += " > ";
    let message = "";
    if (this.gameState === "choosing_item") {
      message = "Floor Cleared! Choose your reward:";
    } else if (this.gameState === "jumping_direction") {
      message = "Jump direction (w/a/s/d):";
    } else if (this.gameState === "recon_direction") {
      message = "Recon direction (w/a/s/d):";
    } else if (this.gameState === "confirm_next_floor") {
      message = "Go next floor?";
    }
    const result: GameLoopResult = {
      displayState: this.getDisplayState(),
      prompt: promptText,
      message: message,
      lastActionMessage: this.lastActionMessage,
      uiEffect: this.uiEffect,
      gameState: this.gameState,
      newItemAcquired: null as (Item & { id: string }) | null,
      tutorialToShow:
        undefined as ({ title: string; content: string } | undefined),
    };
    if (this.justAcquiredItem) {
      result.newItemAcquired = {
        id: this.justAcquiredItem,
        ...ITEMS[this.justAcquiredItem],
      };
    }
    if (this.tutorialToShow) {
      result.tutorialToShow = this.tutorialToShow;
    }
    return result;
  }

  clearLastActionMessage() {
    this.lastActionMessage = undefined;
  }

  clearUiEffect() {
    this.uiEffect = null;
  }

  clearJustAcquiredItem() {
    this.justAcquiredItem = null;
  }

  clearTutorial() {
    this.tutorialToShow = null;
  }
}
