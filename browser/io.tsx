import { Game } from "../game.ts";
import { Fragment, h } from "preact";
import { useEffect, useState } from "preact/hooks";
import { DisplayState, GameLoopResult } from "../interfaces.ts";
import { ITEMS } from "../items.ts";
import { UI_TEXT } from "../ui_text.ts";
import { Language } from "./main.tsx";

export function NotifyArea(
  props: { notifications: string[] },
) {
  return (
    <>
      {props.notifications.map((notify) => (
        <div class="game-popup">{notify}</div>
      ))}
    </>
  );
}

export function GameStatus(
  props: {
    latestGameResult?: GameLoopResult;
    language: Language;
    runGameLoop: (key?: string) => void;
    gameInstance: Game;
  },
) {
  const lang = props.language;
  if (!props.latestGameResult) {
    return <>Error: No DisplayState for GameStatus</>;
  }
  const d = props.latestGameResult;
  const itemCounts = (d.displayState.items || []).reduce((counts, id) => {
    counts[id] = (counts[id] || 0) + 1;
    return counts;
  }, {} as ({ [x: string]: number }));
  return (
    <div id="game-status">
      <p id="floor-number">Floor: {d.displayState.floorNumber}</p>
      Items:
      <ul id="item-list">
        {Object.entries(itemCounts).map((itemCount) => {
          const item = ITEMS[itemCount[0]];
          return (
            <li key={itemCount[0]}>
              <button
                type="button"
                class="item-link"
                onClick={() => alert(item.description[lang])}
              >
                {item.name[lang]}
                {item.key && `(${item.key})`} x{itemCount[1]}
              </button>
              {item.key !== null && (
                <button
                  type="button"
                  onClick={() => props.runGameLoop(item.key!)}
                >
                  {UI_TEXT.use[lang]}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {d.gameState == "gameover" && (
        <>
          {UI_TEXT.floorDisclosureRate[lang]}
          <ul>
            {d.result.floorRevelationRates.length == 0 && (
              <li>{UI_TEXT.none[lang]}</li>
            )}
            {d.result.floorRevelationRates.map((revRate) => (
              <li key={revRate.floor}>
                {revRate.floor}: {(revRate.rate * 100).toFixed(0)}%
              </li>
            ))}
          </ul>
          <button
            type="button"
            id="btn-reset"
            onClick={() => {
              props.gameInstance.resetGame();
              props.gameInstance.setupFloor();
              props.runGameLoop();
            }}
          >
            {UI_TEXT.playAgain[lang]}
          </button>
        </>
      )}
    </div>
  );
}

export function GameGrid(
  props: {
    displayState?: DisplayState;
    runGameLoop: () => void;
    gameInstance: Game;
  },
) {
  if (!props.displayState) {
    return <>Error: No DisplayState for GameGrid</>;
  }
  const displayState = props.displayState;
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
                props.gameInstance.toggleFlag(r, c);
                props.runGameLoop();
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
  props: { runGameLoop: (key?: string) => void; message?: string },
) {
  const runGameLoop = props.runGameLoop;
  return (
    <>
      {props.message && <div id="action-prompt">{props.message}</div>}
      <div id="controls">
        <button
          id="btn-up"
          class="control-btn"
          type="button"
          onClick={() => {
            runGameLoop("w");
          }}
        >
          ↑
        </button>
        <button
          id="btn-down"
          class="control-btn"
          type="button"
          onClick={() => {
            runGameLoop("s");
          }}
        >
          ↓
        </button>
        <button
          id="btn-left"
          class="control-btn"
          type="button"
          onClick={() => {
            runGameLoop("a");
          }}
        >
          ←
        </button>
        <button
          id="btn-right"
          class="control-btn"
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
  const [gameInstance, _setGameInstance] = useState(new Game());
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

    document.body.dataset.gameState = gameResult.gameState;

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
      notify(
        gameResult.tutorialToShow.title + "\n" +
          gameResult.tutorialToShow.content,
      );
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
    <div id="game-container">
      <h1>bsahd/trap-dungeon</h1>
      <div id="game-language">
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
      <div id="game-grid">
        <GameGrid
          displayState={displayState}
          runGameLoop={runGameLoop}
          gameInstance={gameInstance}
        />
      </div>

      <Controls runGameLoop={runGameLoop} message={latestGameResult?.message} />
    </div>
  );
}
