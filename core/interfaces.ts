import { Game } from "./game.ts";

export interface Cell {
  isTrap: boolean;
  isRevealed: boolean;
  isFlagged: boolean;
  adjacentTraps: number;
  itemId?: string;
}
export interface GameI {
  player: { r: number; c: number; items: string[] };
  rows: number;
  cols: number;
  grid: Cell[][];
  exit: { r: number; c: number };
  floorNumber: number;
  turn: number;
  justAcquiredItem: string | null;
  currentItemChoices: string[];
  floorRevelationRates: {
    floor: number;
    rate: number;
  }[];
  tutorialToShow?: { title: string; content: string } | null;
  lastActionMessage?: MultilingualText;
  gameState:
    | "playing"
    | "gameover"
    | "confirm_next_floor"
    | "choosing_item"
    | "recon_direction"
    | "jumping_direction";
}

export interface DisplayState {
  grid: Cell[][];
  gameState: GameI["gameState"];
  player: { r: number; c: number };
  exit: { r: number; c: number };
  floorNumber: number;
  items: string[];
  turn: number;
  currentItemChoices: string[];
}

export interface MultilingualText {
  ja: string;
  en: string;
}

export interface Item {
  name: MultilingualText;
  description: MultilingualText;
  key: string | null;
  minFloor: number;
  maxFloor: number;
  use?: (
    game: Game,
  ) => { consumed: boolean; message?: MultilingualText };
}
export type GameLoopResult =
  & {
    displayState: DisplayState;
    message: string;
  }
  & (
    {
      gameState:
        | "playing"
        | "confirm_next_floor"
        | "choosing_item"
        | "recon_direction"
        | "jumping_direction";
      prompt: string;
      lastActionMessage?: MultilingualText;
      uiEffect: string | null;
      newItemAcquired: (Item & { id: string }) | null;
      tutorialToShow: { title: string; content: string } | undefined;
    } | {
      gameState: "gameover";
      result: {
        floorRevelationRates: GameI["floorRevelationRates"];
        finalFloorNumber: number;
        finalItems: { [x: string]: number };
      };
    }
  );
