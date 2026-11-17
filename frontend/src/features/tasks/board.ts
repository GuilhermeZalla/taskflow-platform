export const boardStages = ["todo", "inprogress", "review", "done"] as const;
export function adjacentStage(current: string, direction: number): string | null {
  const index = boardStages.findIndex(stage => stage === current);
  const target = index + direction;
  return index >= 0 && target >= 0 && target < boardStages.length ? boardStages[target]! : null;
}
export function droppedStage(current: string, target: string, dx: number, dy: number): string | null {
  return Math.hypot(dx, dy) > 8 && target !== current && boardStages.some(stage => stage === target) ? target : null;
}
