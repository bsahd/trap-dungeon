/// <reference lib="dom" />
import { Game } from "./game.ts";
import { Fragment, h } from "preact";
import { useEffect, useState } from "preact/hooks";
import { DisplayState, GameI, GameLoopResult, Item } from "./interfaces.ts";
import { ITEMS } from "./items.ts";
import { UI_TEXT } from "./ui_text.ts";

export type Language = "ja" | "en";

export function NotifyArea(props: { notifications: string[] }) {
  return (
    <>
      {props.notifications.map((notify) => (
        <div class="game-popup">{notify}</div>
      ))}
    </>
  );
}

export function GameStatus(
  props: { latestGameResult?: GameLoopResult; LANG: Language },
) {
  const LANG = props.LANG;
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
        {Object.entries(itemCounts).map((item) => {
          return (
            <li key={item[0]}>
              <button
                class="item-link"
                onClick={() => alert(ITEMS[item[0]].description[LANG])}
              >
                {ITEMS[item[0]].name[LANG]}({ITEMS[item[0]].key}) x{item[1]}
              </button>
            </li>
          );
        })}
      </ul>
      {d.gameState == "gameover" && (
        <>
          {UI_TEXT.floorDisclosureRate[LANG]}
          <ul>
            {d.result.floorRevelationRates.length == 0 && (
              <li>{UI_TEXT.none[LANG]}</li>
            )}
            {d.result.floorRevelationRates.map((revRate) => (
              <li key={revRate.floor}>
                {revRate.floor}: {(revRate.rate * 100).toFixed(0)}%
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function GameGrid(
  props: { displayState?: DisplayState; runGameLoop: () => void },
) {
  if (!props.displayState) {
    return <>Error: No DisplayState for GameGrid</>;
  }
  const displayState = props.displayState;
  return (
    <table class="game-table" style={{ "--dynamic-cell-size": "32px" }}>
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
    </table>
  );
}

const gameInstance = new Game();
gameInstance.setupFloor();

export function GameMain() {
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
            choices.map((id) => ITEMS[id].name[language]).join("\n"),
        );
        if (input === null) {
          // キャンセル押されたら抜ける（ゲーム仕様次第）
          break;
        }
        const num = parseInt(input);
        console.log(input, num);
        if (!isNaN(num) && num > 0 && num <= choices.length) {
          chosen = num;
          runGameLoop(num.toString());
          break;
        } else {
          alert("Invalid choice, try again.");
        }
      }
    } else if (gameState === "gameover") {
      // notify(JSON.stringify(gameResult.result));
    } else if (
      ["playing", "jumping_direction", "recon_direction"].includes(gameState)
    ) {
      // setupControlButtons();
    }

    if (gameResult.gameState != "gameover" && gameResult.lastActionMessage) {
      notify(gameResult.lastActionMessage[language]);
      gameInstance.clearLastActionMessage();
    }

    if (
      ["jumping_direction", "recon_direction"].includes(gameState) &&
      gameResult.message
    ) {
      // dom.actionPrompt.textContent = gameResult.message;
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

    if (
      gameResult.gameState != "gameover" && gameResult.uiEffect === "flash_red"
    ) {
      // flashScreenRed();
      // gameInstance.clearUiEffect();
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
        // event.preventDefault();
        // const choices = ["yes", "no"];
        // switch (key) {
        //   case "w":
        //     selectedConfirmIndex = (selectedConfirmIndex > 0)
        //       ? selectedConfirmIndex - 1
        //       : choices.length - 1;
        //     updateConfirmHighlight();
        //     break;
        //   case "s":
        //     selectedConfirmIndex = (selectedConfirmIndex < choices.length - 1)
        //       ? selectedConfirmIndex + 1
        //       : 0;
        //     updateConfirmHighlight();
        //     break;
        //   case "enter":
        //     processBrowserInput(choices[selectedConfirmIndex]);
        //     break;
        //   default:
        //     break;
        // }
      } else if (gameInstance.gameState === "choosing_item") {
        // event.preventDefault();
        // const choices = document.querySelectorAll(".item-choice-btn");
        // if (!choices.length) return;

        // if (isInputDebounced(key)) return;

        // switch (key) {
        //   case "w":
        //     selectedChoiceIndex = (selectedChoiceIndex > 0)
        //       ? selectedChoiceIndex - 1
        //       : choices.length - 1;
        //     updateChoiceHighlight();
        //     break;
        //   case "s":
        //     selectedChoiceIndex = (selectedChoiceIndex < choices.length - 1)
        //       ? selectedChoiceIndex + 1
        //       : 0;
        //     updateChoiceHighlight();
        //     break;
        //   case "enter":
        //     {
        //       const selectedButton = choices[selectedChoiceIndex];
        //       if (selectedButton) {
        //         (selectedButton as HTMLButtonElement).click();
        //       }
        //     }
        //     break;
        //   default:
        //     handled = false;
        //     break;
        // }
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
    <div>
      <form action="#">
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
      </form>
      <NotifyArea notifications={notifications} />
      <GameStatus latestGameResult={latestGameResult} LANG={language} />
      <GameGrid displayState={displayState} runGameLoop={runGameLoop} />

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
    </div>
  );
}
