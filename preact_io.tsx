/// <reference lib="dom" />
import { Game } from "./game.ts";
import { Fragment, h } from "preact";
import { useEffect, useState } from "preact/hooks";
import { DisplayState, GameI, Item } from "./interfaces.ts";
import { ITEMS } from "./items.ts";
import { UI_TEXT } from "./ui_text.ts";

const LANG = "ja";

export function GameGrid(
  props: { displayState?: DisplayState; runGameLoop: () => void },
) {
  if (!props.displayState) {
    return <></>;
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
            const isRevealed = gridCell.isRevealed ||
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
                    (isPlayer ? "cell-number--player-present" : "")}
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
    console.log(gameResult);

    document.body.dataset.gameState = gameResult.gameState;

    if (gameResult.gameState != "gameover" && gameResult.newItemAcquired) {
      const item = gameResult.newItemAcquired;
      const message = `${UI_TEXT.itemAcquisition[LANG]}: ${item.name[LANG]}`;
      // showNotification(message, 3000);
      alert(message);
      gameInstance.clearJustAcquiredItem();
    }

    setDisplayState(gameResult.displayState);

    const gameState = gameResult.gameState;

    if (gameState === "confirm_next_floor") {
      // renderConfirmDialog(gameResult.message);
      runGameLoop(confirm(gameResult.message) ? "yes" : "no");
    } else if (gameState === "choosing_item") {
      const itemNum = parseInt(
        prompt(gameResult.displayState.currentItemChoices.join("\n")) ?? "",
      );
    } else if (gameState === "gameover") {
      alert(JSON.stringify(gameResult.result));
    } else if (
      ["playing", "jumping_direction", "recon_direction"].includes(gameState)
    ) {
      // setupControlButtons();
    }

    if (gameResult.gameState != "gameover" && gameResult.lastActionMessage) {
      alert(gameResult.lastActionMessage[LANG]);
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
      alert(gameResult.message);
    }

    if (
      gameResult.gameState != "gameover" && gameResult.uiEffect === "flash_red"
    ) {
      // flashScreenRed();
      // gameInstance.clearUiEffect();
    }

    if (gameResult.gameState != "gameover" && gameResult.tutorialToShow) {
      alert(
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
      <GameGrid displayState={displayState} runGameLoop={runGameLoop}>
      </GameGrid>
      <button
        type="button"
        onClick={() => {
          runGameLoop("w");
        }}
      >
        w
      </button>
      <button
        type="button"
        onClick={() => {
          runGameLoop("a");
        }}
      >
        a
      </button>
      <button
        type="button"
        onClick={() => {
          runGameLoop("s");
        }}
      >
        s
      </button>
      <button
        type="button"
        onClick={() => {
          runGameLoop("d");
        }}
      >
        d
      </button>
    </div>
  );
}
