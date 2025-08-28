export interface Game {
  player: { r: number; c: number };
  rows: number;
  cols: number;
  grid: { isTrap: boolean; isRevealed: boolean; isFlagged: boolean }[][];
  exit: { r: number; c: number };
  exitRevealedThisFloor: boolean;
  gameState: string;
  revealFrom: Function;
  calculateNumbers: Function;
}
