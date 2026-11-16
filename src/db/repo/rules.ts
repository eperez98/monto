import { z } from 'zod';
import type { Engine } from '../engine';
import { categoryIdByName, getSetting, setSetting } from './core';
import { assertCan } from '../../domain/permissions';
import { matchRule, type CategoryRule } from '../../domain/rules';
import type { Actor } from '../types';
import { tr } from '../../lib/i18n';

const KEY = 'categoryRules';
const ruleSchema = z.array(z.object({ match: z.string().trim().min(2, tr('Escribe al menos 2 letras')).max(60), categoryId: z.string().min(1), kind: z.enum(['expense', 'income']) })).max(300);

export function getCategoryRules(e: Engine): CategoryRule[] {
  return getSetting<{ items: CategoryRule[] }>(e, KEY, { items: [] }).items;
}
export function saveCategoryRules(e: Engine, actor: Actor, rules: CategoryRule[]) {
  assertCan(actor.role, 'category.manage');
  setSetting(e, KEY, { items: ruleSchema.parse(rules) });
}

/** Category id for a description by the rules, or null when none applies (or the category no longer exists). */
export function categoryFor(e: Engine, description: string, kind: 'expense' | 'income', rules = getCategoryRules(e)): string | null {
  const r = matchRule(description, kind, rules);
  if (!r) return null;
  if (r.categoryId) return e.get<{ id: string }>('SELECT id FROM categories WHERE id = ? AND kind = ? AND archived = 0', [r.categoryId, kind])?.id ?? null;
  return r.categoryName ? categoryIdByName(e, r.categoryName, kind) : null;
}
