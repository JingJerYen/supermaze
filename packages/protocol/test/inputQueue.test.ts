import { describe, expect, it } from "vitest";
import { InputQueue } from "../src/index.js";

describe("InputQueue", () => {
  it("applies inputs in order, one per tick, and acknowledges the last applied", () => {
    const q = new InputQueue();
    q.push({ moveX: 1, moveY: 0, seq: 1 });
    q.push({ moveX: 0, moveY: 1, seq: 2, action: true });
    expect(q.take()).toEqual({ moveX: 1, moveY: 0 });
    expect(q.acked).toBe(1);
    expect(q.take()).toEqual({ moveX: 0, moveY: 1, action: true });
    expect(q.acked).toBe(2);
  });

  it("keeps the last movement going when a packet is late, without repeating a press", () => {
    const q = new InputQueue();
    q.push({ moveX: 1, moveY: 0, seq: 1, action: true });
    q.take();
    expect(q.take()).toEqual({ moveX: 1, moveY: 0 });
    expect(q.acked).toBe(1);
  });

  it("drops the oldest beyond the limit but never loses a press", () => {
    const q = new InputQueue(2);
    q.push({ moveX: 1, moveY: 0, seq: 1, discard: true });
    q.push({ moveX: 1, moveY: 0, seq: 2 });
    q.push({ moveX: 0, moveY: 0, seq: 3 });
    expect(q.length).toBe(2);
    expect(q.take()).toEqual({ moveX: 1, moveY: 0, discard: true });
    expect(q.acked).toBe(2);
  });

  it("serves clients that do not number their inputs", () => {
    const q = new InputQueue();
    q.push({ moveX: -1, moveY: 0 });
    expect(q.take()).toEqual({ moveX: -1, moveY: 0 });
    expect(q.acked).toBe(0);
  });
});
