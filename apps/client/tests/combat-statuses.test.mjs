import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Theme } from '@radix-ui/themes';
import BattleScreen from '../src/features/combat/components/BattleScreen.tsx';
import ItemDetails from '../src/features/items/components/ItemDetails.tsx';
import { BATTLE_STATUS_INFO } from '@mmobot/shared';

const status = (kind, value, remainingRounds, extra = {}) => ({ kind, ...BATTLE_STATUS_INFO[kind], value, remainingRounds, description: 'Описание эффекта', ...extra });
const fighter = (name, statuses = []) => ({ name, hp: 50, maxHp: 100, image: 'fighter.svg', statuses });
const screen = (player, opponent) => renderToStaticMarkup(createElement(Theme, null, createElement(BattleScreen, {
  battleId: 'test', background: 'background.svg', player, opponent, actions: null, round: 2,
})));

test('battle health cards expose named, accessible status controls on both fighters', () => {
  const html = screen(fighter('Игрок', [status('shield', 12, 2)]), fighter('Противник', [status('poison', 4, 1), status('debt', 15, 2, { stacks: 2 })]));
  assert.ok(html.includes('aria-label="Эффекты: Игрок"'));
  assert.ok(html.includes('aria-label="Эффекты: Противник"'));
  assert.ok(html.includes('aria-label="Щит: 12 HP · 2 раунд(а). Описание эффекта"'));
  assert.ok(html.includes('aria-label="Отравление: 1 раунд(а). Описание эффекта"'));
  assert.ok(html.includes('aria-label="Долг: ×2 · 2 раунд(а). Описание эффекта"'));
});

test('ready bonuses show until-next-attack text; clean health cards have no empty effect rows', () => {
  assert.ok(screen(fighter('Игрок', [status('aim', 25, null)]), fighter('Противник')).includes('до следующей атаки'));
  assert.ok(!screen(fighter('Игрок'), fighter('Противник')).includes('aria-label="Эффекты:'));
});

test('old item parameters receive description defaults and dumpling clearly distinguishes battle healing', () => {
  const base = { id: 1, name: 'Предмет', rarity: 'rare', type: 'weapon', passiveId: 'questionable_freshness', passiveParams: { healingReductionPercent: 15 } };
  const html = renderToStaticMarkup(createElement(ItemDetails, { item: base }));
  assert.ok(html.includes('шансом 20%'));
  assert.ok(!html.includes('undefined'));
  assert.ok(!html.includes('пока не действует'));
  const dumpling = renderToStaticMarkup(createElement(ItemDetails, { item: { ...base, type: 'potion', healAmount: 45, passiveId: 'primordial_dumpling', passiveParams: { healingPercent: 50 } } }));
  assert.ok(dumpling.includes('Вне боя восстанавливает 45 HP'));
  assert.ok(dumpling.includes('50% максимального HP'));
});
