import { Game } from "./game.ts";

const startTime = performance.now();
let totalAttempts = 0;
const range = (start: number, end: number) =>
  [...Array(end + 1).keys()].slice(start);
for (const _ of range(0, 100)) {
  const g = new Game();
  for (const floor of range(0, 100)) {
    g.floorNumber = floor;
    const { attempts } = g.setupFloor();
    totalAttempts += attempts;
  }
}
console.log(
  `${totalAttempts} attempts ( ${totalAttempts / 10000} attempts per setup )`,
);
console.log(performance.now() - startTime, "ms");
