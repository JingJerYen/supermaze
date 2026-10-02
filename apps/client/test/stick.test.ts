import { describe, expect, it } from "vitest";
import { diagonalSide, pickDir } from "../src/input/stick.js";

describe("joystick direction", () => {
  it("takes the dominant axis from a standstill", () => {
    expect(pickDir(10, 2, null, 1.2)).toBe("east");
    expect(pickDir(-3, -9, null, 1.2)).toBe("north");
  });

  it("keeps the current axis near the diagonal until the other clearly wins", () => {
    // Slightly more vertical than horizontal, but not by the bias: still east.
    expect(pickDir(10, 11, "east", 1.2)).toBe("east");
    expect(pickDir(10, 13, "east", 1.2)).toBe("south");
    expect(pickDir(11, -10, "north", 1.2)).toBe("north");
    expect(pickDir(13, -10, "north", 1.2)).toBe("east");
  });

  it("flips within an axis at once", () => {
    expect(pickDir(-10, 1, "east", 1.2)).toBe("west");
  });
});

describe("joystick diagonals", () => {
  it("a push near the axis is one direction, near a diagonal two", () => {
    expect(diagonalSide(0, -10, "north", 20)).toBeNull();
    expect(diagonalSide(3, -10, "north", 20)).toBeNull(); // about 17 degrees off the axis
    expect(diagonalSide(7, -10, "north", 20)).toBe("east"); // about 35 degrees
    expect(diagonalSide(10, 8, "east", 20)).toBe("south");
    expect(diagonalSide(-10, -8, "west", 20)).toBe("north");
  });
});
