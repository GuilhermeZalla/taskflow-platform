import test from "node:test";
import assert from "node:assert/strict";
import { adjacentStage, droppedStage } from "./board.ts";
test("keyboard movement respects workflow boundaries and unknown statuses", () => {
  assert.equal(adjacentStage("todo", 1), "inprogress");
  assert.equal(adjacentStage("review", -1), "inprogress");
  assert.equal(adjacentStage("todo", -1), null);
  assert.equal(adjacentStage("done", 1), null);
  assert.equal(adjacentStage("unknown", 1), null);
});
test("dropping ignores clicks, the current stage and outside targets", () => {
  assert.equal(droppedStage("todo", "review", 80, 10), "review");
  assert.equal(droppedStage("todo", "review", 2, 2), null);
  assert.equal(droppedStage("todo", "todo", 80, 10), null);
  assert.equal(droppedStage("todo", "", 80, 10), null);
  assert.equal(droppedStage("todo", "unknown", 80, 10), null);
});
