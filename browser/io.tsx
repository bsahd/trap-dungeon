import { Game } from "../core/game.ts";
import { Fragment, h } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { DisplayState, GameLoopResult } from "../core/interfaces.ts";
import { ITEMS } from "../core/items.ts";
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
    return <>Error: No DisplayState for GameStatus</>;
  }
  const itemCounts = (latestGameResult.displayState.items || []).reduce(
    (counts, id) => {
      counts[id] = (counts[id] || 0) + 1;
      return counts;
    },
    {} as ({ [x: string]: number }),
  );
  return (
    <div class="game-status">
      <p class="floor-number">
        Floor: {latestGameResult.displayState.floorNumber}
      </p>
      Items:
      <ul class="item-list">
        {Object.entries(itemCounts).map((itemCount) => {
          const item = ITEMS[itemCount[0]];
          return (
            <li key={itemCount[0]}>
              <button
                type="button"
                class="item-link"
                onClick={() => alert(item.description[language])}
              >
                {item.name[language]}
                {item.key && `(${item.key})`} x{itemCount[1]}
              </button>
              {item.key !== null && (
                <button
                  type="button"
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
          {UI_TEXT.floorDisclosureRate[language]}
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
            {UI_TEXT.playAgain[language]}
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
  if (!displayState) {
    return <>Error: No DisplayState for GameGrid</>;
  }
  return (
    <table class="game-table" style={{ "--dynamic-cell-size": "32px" }}>
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
                gridCell.isRevealed ||
                (isExit && displayState.exitRevealedThisFloor);

              // 開示されていて、かつ見通しの悪いマスの場合にのみスタイルを適用
              if (gridCell.isObscured && isRevealed) {
                cellClasses.push("game-cell--obscured");
              }

              const flagAction = (event: Event) => {
                if (isRevealed) return;
                event.preventDefault();
                gameInstance.toggleFlag(r, c);
                runGameLoop();
              };

              let numberContent = "";
              let entityContent = "";
              let playerContent = "";

              if (isPlayer) {
                playerContent = "@";

                if (gridCell.isTrap) {
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
                } else if (gridCell.isTrap) {
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
  { runGameLoop, message }: {
    runGameLoop: (key?: string) => void;
    message?: string;
  },
) {
  return (
    <>
      {message && <div class="action-prompt">{message}</div>}
      <div class="controls">
        <button
          class="control-btn btn-up"
          type="button"
          onClick={() => {
            runGameLoop("w");
          }}
        >
          ↑
        </button>
        <button
          class="control-btn btn-down"
          type="button"
          onClick={() => {
            runGameLoop("s");
          }}
        >
          ↓
        </button>
        <button
          class="control-btn btn-left"
          type="button"
          onClick={() => {
            runGameLoop("a");
          }}
        >
          ←
        </button>
        <button
          class="control-btn btn-right"
          type="button"
          onClick={() => {
            runGameLoop("d");
          }}
        >
          →
        </button>
      </div>
    </>
  );
}

export function GameMain() {
  const { current: gameInstance } = useRef(new Game());
  useEffect(() => gameInstance.setupFloor(), []);
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
      const message = `${UI_TEXT.itemAcquisition[language]}: ${
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
      runGameLoop(confirm(gameResult.message) ? "yes" : "no");
    } else if (gameState === "choosing_item") {
      let chosen: number | null = null;
      const choices = gameResult.displayState.currentItemChoices;

      while (chosen === null) {
        const input = prompt(
          UI_TEXT.chooseReward[language] + "\n" +
            choices.map((id, n) => `${n + 1}: ${ITEMS[id].name[language]}`)
              .join("\n"),
        );
        const num = parseInt(input ?? "");
        console.log(input, num);
        if (!isNaN(num) && num > 0 && num <= choices.length) {
          chosen = num;
          runGameLoop(num.toString());
          break;
        } else {
          alert("Invalid choice, try again.");
        }
      }
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
      alert(
        gameResult.tutorialToShow.title + "\n" +
          gameResult.tutorialToShow.content,
      );
      gameInstance.clearTutorial();
    }
  };

  useEffect(() => {
    runGameLoop();
    const handleGlobalKeyboardInput = (event: KeyboardEvent) => {
      const modal = document.querySelector(".modal-overlay");
      if (event.key === "Escape" && modal) {
        modal.remove();
        return;
      }
      if (modal) return;

      let key = event.key.toLowerCase();
      switch (event.key) {
        case "ArrowUp":
          key = "w";
          break;
        case "ArrowDown":
          key = "s";
          break;
        case "ArrowLeft":
          key = "a";
          break;
        case "ArrowRight":
          key = "d";
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
        if ("wasd".includes(key)) {
          runGameLoop(key);
        } else {
          handled = false;
        }
      } else if (gameInstance.gameState === "playing") {
        const itemKeys = Object.values(ITEMS).map((item) => item.key).filter((
          k,
        ) => k).join("");
        const validKeys = "wasd" + itemKeys;

        if (validKeys.includes(key)) {
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
    <div class="game-container">
      <h1>bsahd/trap-dungeon</h1>
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
        />
      )}
    </div>
  );
}
