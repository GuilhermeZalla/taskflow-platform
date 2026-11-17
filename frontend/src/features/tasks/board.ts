export const boardStages = ["todo", "inprogress", "review", "done"] as const;
export function adjacentStage(current: string, direction: number): string | null {
  const index = boardStages.findIndex(stage => stage === current);
  const target = index + direction;
  return index >= 0 && target >= 0 && target < boardStages.length ? boardStages[target]! : null;
}
export function droppedStage(current: string, target: string, dx: number, dy: number): string | null {
  return Math.hypot(dx, dy) > 8 && target !== current && boardStages.some(stage => stage === target) ? target : null;
}

export function parseBoardOrder(value: string | null): string[] {
  try {
    const ids: unknown = JSON.parse(value || "[]");
    return Array.isArray(ids) && ids.every(id => typeof id === "string") ? [...new Set(ids)] : [];
  } catch { return []; }
}
export function orderCards<T extends { id: string }>(items: T[], order: string[]): T[] {
  const positions = new Map(order.map((id, index) => [id, index]));
  return [...items].sort((a, b) => (positions.get(a.id) ?? order.length) - (positions.get(b.id) ?? order.length));
}
export function reorderCard(ids: string[], id: string, beforeId: string | null): string[] {
  if (!ids.includes(id) || beforeId === id || (beforeId !== null && !ids.includes(beforeId))) return ids;
  const next = ids.filter(value => value !== id);
  next.splice(beforeId === null ? next.length : next.indexOf(beforeId), 0, id);
  return next;
}
