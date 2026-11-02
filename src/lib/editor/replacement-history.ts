/**
 * Session-scoped undo/redo for server-side object replacement.
 * A step records the product link before/after; the inverse replays the
 * replacement API (productId null = restore the source reconstruction).
 */
export type ReplacementTarget = { productId: string | null };
export type ReplacementStep = {
  objectId: string;
  from: ReplacementTarget;
  to: ReplacementTarget;
};
export type ReplacementHistory = {
  past: ReplacementStep[];
  future: ReplacementStep[];
};
export type ReplacementInverse = {
  objectId: string;
  productId: string | null;
};

export function emptyReplacementHistory(): ReplacementHistory {
  return { past: [], future: [] };
}

export function recordReplacement(
  state: ReplacementHistory,
  step: ReplacementStep,
): ReplacementHistory {
  return { past: [...state.past.slice(-49), step], future: [] };
}

export function undoReplacement(state: ReplacementHistory): {
  history: ReplacementHistory;
  inverse: ReplacementInverse | null;
} {
  const step = state.past.at(-1);
  if (!step) return { history: state, inverse: null };
  return {
    history: { past: state.past.slice(0, -1), future: [...state.future, step] },
    inverse: { objectId: step.objectId, productId: step.from.productId },
  };
}

export function redoReplacement(state: ReplacementHistory): {
  history: ReplacementHistory;
  inverse: ReplacementInverse | null;
} {
  const step = state.future.at(-1);
  if (!step) return { history: state, inverse: null };
  return {
    history: { past: [...state.past.slice(-49), step], future: state.future.slice(0, -1) },
    inverse: { objectId: step.objectId, productId: step.to.productId },
  };
}
