import { render } from "preact-render-to-string";
import { Fragment, h } from "preact";
import { getItemList } from "../core/items.ts";

const htmlContent = render(
  <dl>
    {getItemList().map(([id, item]) => {
      return (
        <>
          <dt>{item.name.ja}{item.key && `(${item.key})`}</dt>
          <dd>{item.description.ja}</dd>
        </>
      );
    })}
  </dl>,
);
console.log(htmlContent);
