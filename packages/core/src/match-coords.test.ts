import { describe, it, expect } from "vitest";
import { centerOf } from "@spotterjs/base";
import {
  matchTapScreen,
  toLocal,
  toMatchBox,
  toScreen,
  type WindowFrame,
} from "./match-coords";

const secondaryFrame: WindowFrame = {
  left: 2203,
  top: 170,
  width: 939,
  height: 730,
};

describe("match-coords", () => {
  it("roundtrips local ↔ screen", () => {
    const local = { x: 157, y: 248 };
    const screen = toScreen(secondaryFrame, local);
    expect(toLocal(secondaryFrame, screen)).toEqual(local);
  });

  it("toMatchBox keeps localCenter aligned with screen center", () => {
    const screen = { left: 2324, top: 390, width: 94, height: 24 };
    const box = toMatchBox(secondaryFrame, screen);
    expect(box.localCenter).toEqual(centerOf(box.local));
    expect(toScreen(secondaryFrame, box.localCenter)).toEqual(
      centerOf(box.screen)
    );
  });

  it("matchTapScreen uses match box center for small templates", () => {
    const screen = { left: 2324, top: 390, width: 94, height: 24 };
    const box = toMatchBox(secondaryFrame, screen);
    expect(matchTapScreen(box)).toEqual({ x: 2371, y: 402 });
    expect(matchTapScreen(box)).not.toEqual({
      x: screen.left + 36,
      y: screen.top + 28,
    });
  });

  it("matchTapScreen is stable when frame moves but screen box unchanged", () => {
    const screen = { left: 2324, top: 390, width: 94, height: 24 };
    const box = toMatchBox(secondaryFrame, screen);
    const movedFrame: WindowFrame = {
      left: 2211,
      top: 170,
      width: 939,
      height: 730,
    };
    const rebased = toMatchBox(movedFrame, box.screen);
    expect(matchTapScreen(box)).toEqual(matchTapScreen(rebased));
    expect(rebased.local).not.toEqual(box.local);
  });
});
