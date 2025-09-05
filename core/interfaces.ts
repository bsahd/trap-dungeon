import { Cell, Game } from "./game.ts";

export interface DisplayState {
  grid: Cell[][];
  gameState: Game["gameState"];
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
        floorRevelationRates: Game["floorRevelationRates"];
        finalFloorNumber: number;
        finalItems: { [x: string]: number };
      };
    }
  );
