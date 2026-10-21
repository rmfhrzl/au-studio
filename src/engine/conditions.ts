import type { Condition, Effect } from './schema';

/**
 * Condition & effect evaluation.
 *
 * Pure functions: they take the current story state and return a decision.
 * They never mutate anything, which makes them trivially testable and lets
 * the coverage analyser re-use them with hypothetical states.
 */

export interface EvaluableState {
  variables: Record<string, number | boolean | string>;
  flags: Record<string, boolean>;
  visited: Set<string>;
  choicesMade: Set<string>;
}

export function evaluateCondition(condition: Condition | undefined, state: EvaluableState): boolean {
  if (!condition) return true;

  switch (condition.kind) {
    case 'always':
      return true;

    case 'var': {
      const current = state.variables[condition.variableId];
      if (current === undefined) return false;
      switch (condition.op) {
        case 'eq':
          return current === condition.value;
        case 'neq':
          return current !== condition.value;
        case 'gt':
          return typeof current === 'number' && typeof condition.value === 'number' && current > condition.value;
        case 'gte':
          return typeof current === 'number' && typeof condition.value === 'number' && current >= condition.value;
        case 'lt':
          return typeof current === 'number' && typeof condition.value === 'number' && current < condition.value;
        case 'lte':
          return typeof current === 'number' && typeof condition.value === 'number' && current <= condition.value;
        case 'truthy':
          return Boolean(current);
        case 'falsy':
          return !current;
        default:
          return false;
      }
    }

    case 'flag':
      return Boolean(state.flags[condition.flag]) === condition.value;

    case 'visited':
      return state.visited.has(condition.nodeId);

    case 'choiceMade':
      return state.choicesMade.has(condition.optionId);

    case 'all':
      return condition.conditions.every((c) => evaluateCondition(c, state));

    case 'any':
      return condition.conditions.some((c) => evaluateCondition(c, state));

    case 'not':
      return !evaluateCondition(condition.condition, state);

    default:
      return false;
  }
}

export function applyEffects(
  effects: Effect[],
  variables: Record<string, number | boolean | string>,
): Record<string, number | boolean | string> {
  const next = { ...variables };
  for (const effect of effects) {
    const current = next[effect.variableId];
    switch (effect.op) {
      case 'set':
        if (effect.value !== undefined) next[effect.variableId] = effect.value;
        break;
      case 'add':
        if (typeof current === 'number' && typeof effect.value === 'number') {
          next[effect.variableId] = current + effect.value;
        }
        break;
      case 'subtract':
        if (typeof current === 'number' && typeof effect.value === 'number') {
          next[effect.variableId] = current - effect.value;
        }
        break;
      case 'toggle':
        next[effect.variableId] = !current;
        break;
      case 'append':
        if (typeof current === 'string' && typeof effect.value === 'string') {
          next[effect.variableId] = `${current}${effect.value}`;
        } else if (typeof effect.value === 'string') {
          next[effect.variableId] = effect.value;
        }
        break;
    }
  }
  return next;
}

/** Human readable summary used by the editor and by validation messages. */
export function describeCondition(condition: Condition | undefined): string {
  if (!condition) return 'selalu';
  switch (condition.kind) {
    case 'always':
      return 'selalu';
    case 'var':
      return `${condition.variableId} ${condition.op} ${String(condition.value)}`;
    case 'flag':
      return `flag ${condition.flag} = ${condition.value}`;
    case 'visited':
      return `sudah melewati ${condition.nodeId}`;
    case 'choiceMade':
      return `pilihan ${condition.optionId} pernah dipilih`;
    case 'all':
      return `(${condition.conditions.map(describeCondition).join(' AND ')})`;
    case 'any':
      return `(${condition.conditions.map(describeCondition).join(' OR ')})`;
    case 'not':
      return `NOT ${describeCondition(condition.condition)}`;
    default:
      return '?';
  }
}
