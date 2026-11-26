/**
 * Engine `Criterion` (id = row id as text, or a temporary id for a custom criterion not saved yet) ↔ `saveCriteria`
 * inputs. Rows of C1…C10 match by code; custom ones (CX) by row id.
 */
import type { Criterion } from '@/engine';
import type { CriterionInput } from '@/db/repos/criteria';

/** Temporary id of a custom criterion added in the editor ('new-1'…), never a row id. */
export const NEW_ID_PREFIX = 'new-';

export function rowIdOf(engineId: string): number | undefined {
  return /^\d+$/.test(engineId) ? Number(engineId) : undefined;
}

export function criteriaToRows(list: readonly Criterion[]): CriterionInput[] {
  return list.map((c, i) => {
    const id = rowIdOf(c.id);
    const row: CriterionInput = { code: c.code, enabled: c.enabled, params: c.params, order: c.order ?? i };
    return id === undefined ? row : { ...row, id };
  });
}
