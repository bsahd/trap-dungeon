import { GameLoopResult, MultilingualText } from "./interfaces.ts";
import { getItem, getItemList } from "./items.ts";
import {
  forEachCell,
  getEightDirectionsNeighbors,
  isGoalInitiallyVisible,
  isSolvable,
  isValidCell,
} from "./utils.ts";

export class Cell {
  type: "normal" | "trap" | "exit";
  isRevealed: boolean;
  isFlagged: boolean;
  get adjacentTraps() {
    return this.neighborCells.reduce((count, cell) => {
      return count + (cell.type == "trap" ? 1 : 0);
    }, 0);
  }
  itemId?: string;
  neighborCells: Cell[];
  constructor() {
    this.type = "normal";
    this.isRevealed = false;
    this.isFlagged = false;
    this.neighborCells = [];
  }
  setType(type: "trap" | "exit") {
    if (this.type != "normal") {
      throw new Error("cannot set type twice");
    }
    this.type = type;
  }
  enterPlayer(game: Game) {
    if (this.isFlagged) {
      game.lastActionMessage = {
        ja: "旗を立てたマスには移動できません。",
        en: "You cannot move to a flagged cell.",
      };
      return false;
    } else if (this.type == "exit") {
      game.gameState = "confirm_next_floor";
    } else if (this.type == "trap") {
      if (game.hasItem("heart_of_iron")) {
        const index = game.player.items.indexOf("heart_of_iron");
        game.player.items.splice(index, 1);
        this.type = "normal";
        this.reveal();
        game.uiEffect = "flash_red";
        game.lastActionMessage = {
          ja: "鉄の心臓が身代わりになった！",
          en: "The Iron Heart has taken its place!",
        };
      } else if (game.hasItem("indomitable_spirit")) {
        const index = game.player.items.indexOf("indomitable_spirit");
        game.player.items.splice(index, 1);
        game.setupFloor();
        game.uiEffect = "flash_red";
        game.lastActionMessage = {
          ja: "不屈の心で立ち上がり直す!",
          en: "Rise again with an indomitable spirit!",
        };
        return false;
      } else {
        this.isRevealed = true;
        game.gameState = "gameover";
        game.lastActionMessage = {
          ja: "罠を踏んでしまった！",
          en: "I stepped into a trap!",
        };
      }
    } else if (this.itemId) {
      const itemId = this.itemId;
      game.player.items.push(itemId);
      this.itemId = undefined;
      game.justAcquiredItem = itemId;
    } else if (game.gameState !== "gameover") {
      this.reveal();
    }
    return true;
  }
  reveal() {
    if (
      this.isRevealed
    ) return;
    this.isRevealed = true;
    if (this.type != "trap" && this.adjacentTraps === 0) {
      this.neighborCells.forEach((cell) => {
        cell.reveal();
      });
    }
  }
}

export class Game {
  grid: Cell[][] = [];
  rows = 8;
  cols = 8;
  player: { r: number; c: number; items: string[] } = {
    r: 0,
    c: 0,
    items: ["indomitable_spirit", "indomitable_spirit"],
  };
  exit = { r: 0, c: 0 };
  floorNumber = 1;
  turn = 0;
  gameState:
    | "playing"
    | "gameover"
    | "confirm_next_floor"
    | "choosing_item"
    | "recon_direction"
    | "jumping_direction" = "playing";
  REVELATION_THRESHOLD = 0.5;
  uiEffect: string | null = null;
  justAcquiredItem: string | null = null;
  currentItemChoices: string[] = [];
  floorRevelationRates: {
    floor: number;
    rate: number;
  }[] = [];
  lastActionMessage?: MultilingualText;
  tutorialToShow: { title: string; content: string } | null = null;

  resetGame() {
    this.grid = [];
    this.rows = 8;
    this.cols = 8;
    this.player = {
      r: 0,
      c: 0,
      items: ["indomitable_spirit", "indomitable_spirit"],
    };
    this.exit = { r: 0, c: 0 };
    this.floorNumber = 1;
    this.turn = 0;
    this.gameState = "playing";
    this.justAcquiredItem = null;
    this.currentItemChoices = [];
    this.floorRevelationRates = [];
    this.lastActionMessage = undefined;
    this.tutorialToShow = null;
  }
  getAvailableItems() {
    const currentFloor = this.floorNumber;
    return getItemList().map((x) => x[0]).filter((id) => {
      const item = getItem(id);
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
    });

    if (this.floorNumber === 1) {
      this.floorRevelationRates = [];
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
        const randomItemId = availableItems[
          Math.floor(Math.random() * availableItems.length)
        ];
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
      forEachCell(this.grid, (cell, r, c) => {
        cell.neighborCells = getEightDirectionsNeighbors(
          r,
          c,
          this.rows,
          this.cols,
        )
          .map((pos) => this.grid[pos.r][pos.c]);
      });
      this.placeTraps(trapCount);

      const validCells: { r: number; c: number }[] = [];
      forEachCell(this.grid, (cell, r, c) => {
        if (
          cell.type != "trap" && cell.adjacentTraps === 0 &&
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
      this.grid[exitPos.r][exitPos.c].setType("exit");

      const allPlaceableAvailable = this.getAvailableItems();
      const placeableItems = allPlaceableAvailable.filter((
        id: string,
      ) => getItem(id).key !== null);
      const numberOfItemsToPlace = 2 + this.floorNumber;

      for (let i = 0; i < numberOfItemsToPlace; i++) {
        if (placeableItems.length > 0 && validCells.length > 0) {
          const validCellIndex = Math.floor(Math.random() * validCells.length);
          const itemPos = validCells.splice(validCellIndex, 1)[0];
          const randomItemId = placeableItems[
            Math.floor(Math.random() * placeableItems.length)
          ];
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

    this.grid[this.player.r][this.player.c].reveal();
    return {
      attempts,
    };
  }

  generateGrid() {
    this.grid = Array.from(
      { length: this.rows },
      () => Array.from({ length: this.cols }, () => new Cell()),
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

      if (this.grid[r][c].type != "trap" && !isExit && !isForbidden) {
        this.grid[r][c].setType("trap");
        trapsPlaced++;
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
    };
  }

  handleInput(key: string) {
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
        case "up":
          dr = -1;
          directionChosen = true;
          break;
        case "left":
          dc = -1;
          directionChosen = true;
          break;
        case "down":
          dr = 1;
          directionChosen = true;
          break;
        case "right":
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
          if (cell.type == "trap") {
            cell.isRevealed = true;
            cell.isFlagged = true;
            break;
          } else {
            this.grid[r][c].reveal();
          }
        }
        this.gameState = "playing";
        this.turn++;
        this.processPlayerLocation();
      }
    } else if (this.gameState === "jumping_direction") {
      let jumpRow = this.player.r, jumpCol = this.player.c, jumped = false;
      switch (key) {
        case "up":
          jumpRow -= 2;
          jumped = true;
          break;
        case "left":
          jumpCol -= 2;
          jumped = true;
          break;
        case "down":
          jumpRow += 2;
          jumped = true;
          break;
        case "right":
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
        const itemIndex = this.player.items.indexOf("jumping_boots");
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
      const itemToUseId = getItemList().find(([_, item]) => item.key === key)
        ?.[0];
      if (itemToUseId && this.hasItem(itemToUseId)) {
        const item = getItem(itemToUseId);
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
          case "up_left":
            newRow--;
            newCol--;
            moved = true;
            break;
          case "up_right":
            newRow--;
            newCol++;
            moved = true;
            break;
          case "down_left":
            newRow++;
            newCol--;
            moved = true;
            break;
          case "down_right":
            newRow++;
            newCol++;
            moved = true;
            break;
          case "up":
            newRow--;
            moved = true;
            break;
          case "left":
            newCol--;
            moved = true;
            break;
          case "down":
            newRow++;
            moved = true;
            break;
          case "right":
            newCol++;
            moved = true;
            break;
        }
      }
      if (moved && isValidCell(newRow, newCol, this.rows, this.cols)) {
        const unchecked = this.grid[newRow][newCol].enterPlayer(this);
        if (unchecked) {
          this.player.r = newRow;
          this.player.c = newCol;
        }
      }
      if (moved || (itemUsed && this.gameState === "playing")) {
        this.turn++;
      }
    }
    return this.gameLoop();
  }

  processPlayerLocation() {
    const currentCell = this.grid[this.player.r][this.player.c];
    currentCell.enterPlayer(this);
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
      return {
        displayState: this.getDisplayState(),
        message: "!!! GAME OVER !!!",
        gameState: "gameover",
        result: {
          floorRevelationRates: this.floorRevelationRates,
          finalFloorNumber: this.floorNumber,
          finalItems: this.player.items.reduce((counts, id) => {
            counts[id] = (counts[id] || 0) + 1;
            return counts;
          }, {} as { [x: string]: number }),
        },
      };
    }
    let promptText = "Move (up/down/left/right)";
    const itemActions = this.player.items
      .map((id) => getItem(id))
      .filter((item) => item.key)
      .map((item) => `${item.key}: ${item.name.en}`);
    if (itemActions.length > 0) {
      promptText += ` | Use Item (${itemActions.join(", ")})`;
    }
    promptText += " > ";
    let message = "";
    if (this.gameState === "choosing_item") {
      message = "Floor Cleared! Choose your reward:";
    } else if (this.gameState === "jumping_direction") {
      message = "Jump direction (up/down/left/right):";
    } else if (this.gameState === "recon_direction") {
      message = "Recon direction (up/down/left/right):";
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
      newItemAcquired: null,
      tutorialToShow: undefined,
    };
    if (this.justAcquiredItem) {
      result.newItemAcquired = {
        id: this.justAcquiredItem,
        ...getItem(this.justAcquiredItem),
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
