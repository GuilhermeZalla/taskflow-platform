import test from "node:test";
import assert from "node:assert/strict";
import { adjacentStage, droppedStage, parseBoardOrder, orderCards, reorderCard } from "./board.ts";
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

test("manual order validates storage and keeps unranked tasks without mutating data", () => {
  assert.deepEqual(parseBoardOrder('{'), []);
  assert.deepEqual(parseBoardOrder('{"id":"a"}'), []);
  assert.deepEqual(parseBoardOrder('["a",2]'), []);
  assert.deepEqual(parseBoardOrder('["b","b","a"]'), ["b", "a"]);
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  assert.deepEqual(orderCards(items, ["deleted", "b", "a"]).map(item => item.id), ["b", "a", "c", "d"]);
  assert.equal(items[0].id, "a");
});
test("manual reordering retains filtered tasks and ignores invalid destinations", () => {
  const ids = ["a", "hidden", "b", "c"];
  assert.deepEqual(reorderCard(ids, "c", "a"), ["c", "a", "hidden", "b"]);
  assert.deepEqual(reorderCard(ids, "a", null), ["hidden", "b", "c", "a"]);
  assert.deepEqual(reorderCard(ids, "a", "missing"), ids);
  assert.deepEqual(reorderCard(ids, "a", "a"), ids);
  assert.deepEqual(reorderCard(ids, "missing", "b"), ids);
  assert.deepEqual(ids, ["a", "hidden", "b", "c"]);
});
