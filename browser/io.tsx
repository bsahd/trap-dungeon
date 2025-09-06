import { Game } from "../core/game.ts";
import { Fragment, h } from "preact";
import { MutableRef, useEffect, useRef, useState } from "preact/hooks";
import { DisplayState, GameLoopResult } from "../core/interfaces.ts";
import { getItem, getItemList } from "../core/items.ts";
import { UI_TEXT } from "../core/ui_text.ts";
import { Language } from "./main.tsx";

export function NotifyArea(
  { notifications }: { notifications: string[] },
) {
  return (
    <>
      {notifications.map((notify, i) => (
        <div class="game-popup" key={i}>{notify}</div>
      ))}
    </>
  );
}

export function GameStatus(
  { latestGameResult, language, runGameLoop, gameInstance }: {
    latestGameResult?: GameLoopResult;
    language: Language;
    runGameLoop: (key?: string) => void;
    gameInstance: Game;
  },
) {
  if (!latestGameResult) {
    return (
      <div class="game-status">
        <div class="status-main">
          <span class="floor-number">
            Floor: {1}
          </span>
        </div>
        <ul class="item-list">
        </ul>
      </div>
    );
  }
  const itemCounts = (latestGameResult.displayState.items || []).reduce(
    (counts, id) => {
      counts[id] = (counts[id] || 0) + 1;
      return counts;
    },
    {} as ({ [x: string]: number }),
  );
  const revelationRate = gameInstance.calculateRevelationRate();
  return (
    <div class="game-status">
      <div class="status-main">
        <span class="floor-number">
          Floor: {latestGameResult.displayState.floorNumber}
        </span>{" "}
        <span
          class={revelationRate > 0.5
            ? "status-achieved"
            : "status-not-achieved"}
        >
          {revelationRate > 0.5
            ? UI_TEXT.reveal_rate_achieved[language]
            : UI_TEXT.reveal_rate_not_achieved[language]}
          ({(revelationRate * 100).toFixed(0)}%)
        </span>
      </div>
      <ul class="item-list">
        {Object.entries(itemCounts).map((itemCount) => {
          const item = getItem(itemCount[0]);
          return (
            <li key={itemCount[0]}>
              <button
                type="button"
                class="item-link"
                onClick={() =>
                  showModalDialog(
                    item.name[language],
                    item.description[language],
                    ["OK"],
                  )}
              >
                {item.name[language]}
                {item.key && `(${item.key})`} x{itemCount[1]}
              </button>
              {item.key !== null && (
                <button
                  type="button"
                  class="app-btn"
                  onClick={() => runGameLoop(item.key!)}
                >
                  {UI_TEXT.use[language]}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {latestGameResult.gameState == "gameover" && (
        <>
          {UI_TEXT.reveal_rate_for_each_floor[language]}
          <ul>
            {latestGameResult.result.floorRevelationRates.length == 0 && (
              <li>{UI_TEXT.none[language]}</li>
            )}
            {latestGameResult.result.floorRevelationRates.map((revRate) => (
              <li key={revRate.floor}>
                {revRate.floor}: {(revRate.rate * 100).toFixed(0)}%
              </li>
            ))}
          </ul>
          <button
            type="button"
            class="btn-reset"
            onClick={() => {
              gameInstance.resetGame();
              gameInstance.setupFloor();
              runGameLoop();
            }}
          >
            {UI_TEXT.play_again[language]}
          </button>
        </>
      )}
    </div>
  );
}

export function GameGrid(
  { displayState, runGameLoop, gameInstance }: {
    displayState?: DisplayState;
    runGameLoop: () => void;
    gameInstance: Game;
  },
) {
  const gridGap = 2;
  const totalGridGapWidth = ((displayState?.grid[0].length ?? 8) - 1) * gridGap;
  const availableWidth = 460;
  const optimalWidthCellSize = (availableWidth - totalGridGapWidth) /
    (displayState?.grid[0].length ?? 8);

  const MIN_CELL_SIZE = 16;
  const MAX_CELL_SIZE = 40;
  const optimalCellSize = Math.floor(Math.max(
    MIN_CELL_SIZE,
    Math.min(MAX_CELL_SIZE, optimalWidthCellSize),
  ));

  if (!displayState) {
    return (
      <table
        class="game-table skeleton"
        style={{ "--dynamic-cell-size": `40px` }}
      >
        <tbody>
          {Array.from({ length: 8 }, (_, k) => k).map((r) => (
            <tr key={r}>
              {Array.from({ length: 8 }, (_, k) => k).map((c) => (
                <td key={c}></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  return (
    <table
      class="game-table"
      style={{ "--dynamic-cell-size": `${optimalCellSize}px` }}
    >
      <tbody>
        {displayState.grid.map((row, r) => (
          <tr key={r}>
            {row.map((gridCell, c) => {
              const cellClasses = ["game-cell"];

              const isPlayer = r === displayState.player.r &&
                c === displayState.player.c;
              const isExit = r === displayState.exit.r &&
                c === displayState.exit.c;
              const isRevealed = displayState.gameState == "gameover" ||
                gridCell.isRevealed;

              // 開示されていて、かつ見通しの悪いマスの場合にのみスタイルを適用

              const flagAction = (event: Event) => {
                if (isRevealed) return;
                event.preventDefault();
                gameInstance.grid[r][c].isFlagged =
                  !(gameInstance.grid[r][c].isFlagged);
                runGameLoop();
              };

              let numberContent = "";
              let entityContent = "";
              let playerContent = "";

              if (isPlayer) {
                playerContent = "@";

                if (gridCell.type == "trap") {
                  cellClasses.push("game-cell--trap");
                  numberContent = "X";
                } else {
                  cellClasses.push("game-cell--player");
                  numberContent = gridCell.adjacentTraps === 0
                    ? ""
                    : gridCell.adjacentTraps.toString();
                }
                if (gridCell.itemId) entityContent = "I";
                if (isExit) entityContent = "E";
              } else if (isRevealed) {
                if (isExit) {
                  cellClasses.push("game-cell--exit");
                  numberContent = "E";
                } else if (gridCell.itemId) {
                  cellClasses.push("game-cell--item");
                  numberContent = "I";
                } else if (gridCell.type == "trap") {
                  cellClasses.push("game-cell--trap");
                  numberContent = "X";
                } else {
                  cellClasses.push("game-cell--revealed");
                  numberContent = gridCell.adjacentTraps === 0
                    ? ""
                    : gridCell.adjacentTraps.toString();
                }
              } else if (gridCell.isFlagged) {
                cellClasses.push("game-cell--flagged");
                numberContent = "⚑";
              } else {
                cellClasses.push("game-cell--hidden");
              }

              return (
                <td
                  class={cellClasses.join(" ")}
                  onClick={flagAction}
                  onContextMenu={flagAction}
                  key={c}
                >
                  <span
                    class={"cell-number" +
                      (isPlayer ? " cell-number--player-present" : "")}
                  >
                    {numberContent}
                  </span>
                  {entityContent && (
                    <span class="cell-entity">{entityContent}</span>
                  )}
                  {playerContent && (
                    <span class="cell-player-icon">{playerContent}</span>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Controls(
  { runGameLoop, message, lastInputTime }: {
    runGameLoop: (key?: string) => void;
    message?: string;
    lastInputTime: MutableRef<number>;
  },
) {
  const btns = [
    { key: "up", label: "↑" },
    { key: "down", label: "↓" },
    { key: "left", label: "←" },
    { key: "right", label: "→" },
  ];
  return (
    <>
      {message && <div class="action-prompt">{message}</div>}
      <div class="controls">
        {btns.map((btn) => (
          <button
            type="button"
            class={`control-btn btn-${btn.key}`}
            key={btn.key}
            onClick={() => {
              if (
                lastInputTime.current + 150 > performance.now()
              ) return;
              lastInputTime.current = performance.now();
              runGameLoop(btn.key);
            }}
          >
            {btn.label}
          </button>
        ))}
      </div>
    </>
  );
}

let modalShowing = false;

export function showModalDialog(
  heading: string,
  content: string,
  buttons: string[],
): Promise<number> {
  if (modalShowing) {
    throw new Error("other modal exists");
  }
  return new Promise((resolve) => {
    const modalElem = document.createElement("dialog");
    modalElem.returnValue = "0";
    modalElem.classList.add("modal-content");
    const headingElem = document.createElement("h3");
    modalElem.appendChild(headingElem);
    headingElem.innerText = heading;
    const contentElem = document.createElement("p");
    modalElem.appendChild(contentElem);
    contentElem.innerText = content;
    buttons.map((btn, i) => {
      const btnElem = document.createElement("button");
      modalElem.appendChild(btnElem);
      btnElem.type = "button";
      btnElem.innerText = btn;
      btnElem.addEventListener("click", () => {
        modalElem.returnValue = i.toString();
        modalElem.close();
      });
    });
    modalElem.addEventListener("close", () => {
      modalShowing = false;
      modalElem.remove();
      resolve(parseInt(modalElem.returnValue));
    });
    document.body.appendChild(modalElem);
    modalShowing = true;
    modalElem.showModal();
  });
}

export function Footer({ language }: { language: Language }) {
  return (
    <footer>
      <a href="./browser_classic/index.html" target="_blank">
        Classic
      </a>{" "}
      |{" "}
      <a href="./docs/index.html" target="_blank">
        {language != "ja" ? "Docs(Japanese Only)" : "Docs"}
      </a>{" "}
      |{" "}
      <a href="https://github.com/bsahd/trap-dungeon" target="_blank">
        GitHub
      </a>{" "}
      |{" "}
      <button
        type="button"
        class="app-btn"
        onClick={() => {
          if (navigator.share) {
            navigator.share({ url: location.href, title: "Trap Dungeon" });
          } else {
            showModalDialog(
              UI_TEXT.error[language],
              UI_TEXT.this_browser_does_not_support_sharing[language],
              [
                "OK",
              ],
            );
          }
        }}
      >
        {UI_TEXT.share[language]}
      </button>
    </footer>
  );
}

export function GameMain({ debugInterface }: { debugInterface: boolean }) {
  const { current: gameInstance } = useRef(new Game());
  const lastInputTime = useRef(performance.now());
  useEffect(() => {
    if (debugInterface) {
      (globalThis as any).debugGame = gameInstance;
    }
  }, []);
  useEffect(() => {
    gameInstance.setupFloor();
  }, []);
  const [displayState, setDisplayState] = useState<DisplayState>();
  const [latestGameResult, setLatestGameResult] = useState<GameLoopResult>();
  const [notifications, setNotifications] = useState<string[]>([]);
  const [language, setLanguage] = useState<Language>("ja");
  const notify = (text: string) => {
    setNotifications((notifications) => notifications.concat(text));
    setTimeout(
      () => setNotifications((notifications) => notifications.slice(1)),
      2000,
    );
  };
  const runGameLoop = (key?: string) => {
    if (key) {
      const actionResult = gameInstance.handleInput(key);
      if (
        "action" in actionResult &&
        actionResult.action === "next_floor_after_delay"
      ) {
        gameInstance.floorNumber++;
        gameInstance.setupFloor();
      }
    }
    const gameResult = gameInstance.gameLoop();

    if (gameResult.gameState != "gameover" && gameResult.newItemAcquired) {
      const item = gameResult.newItemAcquired;
      const message = `${UI_TEXT.item_acquisition[language]}: ${
        item.name[language]
      }`;
      // showNotification(message, 3000);
      notify(message);
      gameInstance.clearJustAcquiredItem();
    }
    setLatestGameResult(gameResult);
    setDisplayState(gameResult.displayState);

    const gameState = gameResult.gameState;

    if (gameState === "confirm_next_floor") {
      // renderConfirmDialog(gameResult.message);
      showModalDialog(gameResult.message, "", [
        UI_TEXT.no[language],
        UI_TEXT.yes[language],
      ]).then((num) => {
        setTimeout(() => runGameLoop(num == 1 ? "yes" : "no"), 100);
      });
    } else if (gameState === "choosing_item") {
      showModalDialog(
        UI_TEXT.choose_reward[language],
        "",
        gameResult.displayState.currentItemChoices.map((id) =>
          getItem(id).name[language]
        ),
      ).then((num) => {
        runGameLoop((num + 1).toString());
      });
    }

    if (gameResult.gameState != "gameover" && gameResult.lastActionMessage) {
      notify(gameResult.lastActionMessage[language]);
      gameInstance.clearLastActionMessage();
    }

    if (
      gameResult.message &&
      ![
        "choosing_item",
        "confirm_next_floor",
        "jumping_direction",
        "recon_direction",
      ].includes(gameState)
    ) {
      notify(gameResult.message);
    }

    if (gameResult.gameState != "gameover" && gameResult.tutorialToShow) {
      showModalDialog(
        gameResult.tutorialToShow.title,
        gameResult.tutorialToShow.content,
        ["OK"],
      ).then(() => gameInstance.clearTutorial());
    }
  };

  useEffect(() => {
    runGameLoop();
    const handleGlobalKeyboardInput = (event: KeyboardEvent) => {
      if (lastInputTime.current + 150 > performance.now()) return;
      lastInputTime.current = performance.now();
      if (event.target !== document.body) return;
      if (modalShowing || displayState?.gameState == "gameover") return;

      let key = event.key.toLowerCase();
      switch (event.key) {
        case "w":
          key = "up";
          break;
        case "a":
          key = "left";
          break;
        case "s":
          key = "down";
          break;
        case "d":
          key = "right";
          break;

        case "ArrowUp":
          key = "up";
          break;
        case "ArrowDown":
          key = "down";
          break;
        case "ArrowLeft":
          key = "left";
          break;
        case "ArrowRight":
          key = "right";
          break;
      }

      let handled = true;

      if (gameInstance.gameState === "confirm_next_floor") {
        // pass
      } else if (gameInstance.gameState === "choosing_item") {
        // pass
      } else if (
        ["jumping_direction", "recon_direction"].includes(
          gameInstance.gameState,
        )
      ) {
        if (["up", "down", "left", "right"].includes(key)) {
          runGameLoop(key);
        } else {
          handled = false;
        }
      } else if (gameInstance.gameState === "playing") {
        const itemKeys = getItemList().map(([_itemId, item]) => item.key)
          .filter((
            k,
          ) => k).join("");

        if (
          itemKeys.includes(key) ||
          ["up", "down", "left", "right"].includes(key)
        ) {
          runGameLoop(key);
        } else {
          handled = false;
        }
      } else {
        handled = false;
      }

      if (handled) {
        event.preventDefault();
      }
    };
    document.addEventListener("keydown", handleGlobalKeyboardInput);
    return () => {
      document.removeEventListener("keydown", handleGlobalKeyboardInput);
    };
  }, []);
  return (
    <>
      <main class="game-container">
        <h1>Trap Dungeon</h1>
        <div class="game-language">
          <label>
            <input
              type="radio"
              name="language"
              checked={language == "ja"}
              onChange={(e) => {
                e.currentTarget.checked && setLanguage("ja");
              }}
            />日本語
          </label>
          <label>
            <input
              type="radio"
              name="language"
              checked={language == "en"}
              onChange={(e) => {
                e.currentTarget.checked && setLanguage("en");
              }}
            />English
          </label>
        </div>
        <NotifyArea notifications={notifications} />
        <GameStatus
          latestGameResult={latestGameResult}
          language={language}
          runGameLoop={runGameLoop}
          gameInstance={gameInstance}
        />
        <div class="game-grid">
          <GameGrid
            displayState={displayState}
            runGameLoop={runGameLoop}
            gameInstance={gameInstance}
          />
        </div>

        {displayState?.gameState != "gameover" && (
          <Controls
            runGameLoop={runGameLoop}
            message={latestGameResult?.message}
            lastInputTime={lastInputTime}
          />
        )}
      </main>
      <Footer language={language}></Footer>
    </>
  );
}
