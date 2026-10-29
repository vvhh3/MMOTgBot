import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { factionRanking, playerRanking } from '../src/features/leaderboard/ranking.ts';
import LeaderboardPanel from '../src/features/leaderboard/components/LeaderboardPanel.tsx';

const players = Array.from({ length: 10 }, (_, index) => ({
  player: { id: index + 1, name: `Игрок ${index + 1}`, level: 12 - index }, points: 200 - index * 10,
}));
const render = (entries, extra = {}) => renderToStaticMarkup(createElement(LeaderboardPanel, {
  mode: 'players', onModeChange: () => {}, entries, hasIdentity: true, playerPoints: 17, ...extra,
}));

test('player ranking preserves server positions, levels and scores and marks the player by ID', () => {
  const ranked = playerRanking(players, 6);
  assert.deepEqual(ranked.map(entry => entry.rank), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(ranked.find(entry => entry.own)?.id, '6');
  assert.equal(ranked[5].level, players[5].player.level);
  assert.equal(ranked[5].points, players[5].points);
  assert.equal(playerRanking(players, null).some(entry => entry.own), false);
});

test('faction sorting keeps tied places, uses the secondary metric and does not mutate the response', () => {
  const factions = [
    { factionId: 'offniks', members: 10, totalPoints: 50 },
    { factionId: 'gamers', members: 10, totalPoints: 90 },
    { factionId: 'normies', members: 7, totalPoints: 100 },
  ];
  const original = structuredClone(factions);
  const byMembers = factionRanking(factions, 'members', 'gamers');
  assert.deepEqual(byMembers.map(entry => [entry.id, entry.rank]), [['gamers', 1], ['offniks', 1], ['normies', 3]]);
  assert.equal(byMembers[0].own, true);
  assert.deepEqual(factionRanking(factions, 'totalPoints', null).map(entry => [entry.id, entry.rank]), [['normies', 1], ['gamers', 2], ['offniks', 3]]);
  assert.deepEqual(factions, original);
});

test('podium supports fewer than three players and keeps first place between second and third', () => {
  for (const count of [1, 2, 3]) {
    const html = render(playerRanking(players.slice(0, count), 1));
    const podium = html.match(/<ol[^>]*aria-label="Первая тройка"[^>]*>(.*?)<\/ol>/s)?.[1];
    assert.ok(podium);
    assert.equal((podium.match(/<li\b/g) ?? []).length, count);
    if (count === 3) assert.deepEqual([...podium.matchAll(/<li\b[^>]*value="(\d+)"/g)].map(match => Number(match[1])), [2, 1, 3]);
  }
  const empty = render([]);
  assert.ok(empty.includes('Пока нет игроков в рейтинге.'));
  assert.ok(!empty.includes('aria-label="Первая тройка"'));
});

test('own score remains visible outside the top ten without inventing a rank during loading or errors', () => {
  const entries = playerRanking(players, 999);
  const outside = render(entries);
  const standing = outside.match(/<section[^>]*aria-label="Ваш результат"[^>]*>(.*?)<\/section>/s)?.[1];
  assert.ok(standing?.includes('Вне топ-10'));
  assert.ok(standing?.includes('>17</p>'));
  assert.ok(!outside.includes('11 место'));
  assert.ok(!render(entries, { loading: true }).includes('Вне топ-10'));
  assert.ok(!render(entries, { error: 'Не удалось загрузить рейтинг' }).includes('Вне топ-10'));
  assert.ok(render(entries, { error: 'Не удалось загрузить рейтинг' }).includes('role="alert"'));
});

test('unselected and empty factions do not receive a fake result or a podium', () => {
  const entries = factionRanking([
    { factionId: 'offniks', members: 0, totalPoints: 0 },
    { factionId: 'gamers', members: 0, totalPoints: 0 },
  ], 'members', null);
  const html = render(entries, { mode: 'factions', hasIdentity: false, playerPoints: null });
  assert.ok(html.includes('Группировка не выбрана'));
  assert.ok(html.includes('Пока никто не вступил.'));
  assert.ok(!html.includes('aria-label="Первая тройка"'));
  assert.ok(!html.includes('undefined'));
  const standing = html.match(/<section[^>]*aria-label="Ваша группировка"[^>]*>(.*?)<\/section>/s)?.[1];
  assert.ok(standing?.includes('>—</p>'));
});
