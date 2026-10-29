import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import FriendsPanel from '../src/features/friends/components/FriendsPanel.tsx';
import { FriendRow } from '../src/features/friends/components/FriendUi.tsx';

const person = { id: 301, friendId: 90003, name: 'Артём', level: 8, online: true };
const noop = () => {};
const render = (overview, extra = {}) => renderToStaticMarkup(createElement(FriendsPanel, {
  friendCode: 90002, overview,
  search: { query: '90003', results: [person], onChange: noop, onSubmit: noop },
  onCopy: noop, onAdd: noop, onRespond: noop, onRemove: noop, onCancel: noop,
  ...extra,
}));
const searchButton = html => {
  const match = html.match(/<button\b([^>]*)>(Уже в друзьях|Заявка отправлена|Принять заявку|Добавить в друзья)<\/button>/);
  assert.ok(match, 'Search result has a relationship action');
  return { label: match[2], disabled: /\bdisabled=/.test(match[1]) };
};

test('friend search distinguishes player IDs from request IDs and friendship codes', () => {
  const empty = { friends: [], requests: [] };
  assert.deepEqual(searchButton(render(empty)), { label: 'Добавить в друзья', disabled: false });
  assert.deepEqual(searchButton(render({ friends: [person], requests: [] })), { label: 'Уже в друзьях', disabled: true });

  const request = { id: 52, playerId: person.id, name: person.name, level: person.level };
  assert.deepEqual(searchButton(render({ friends: [], requests: [{ ...request, direction: 'incoming' }] })), { label: 'Принять заявку', disabled: false });
  assert.deepEqual(searchButton(render({ friends: [], requests: [{ ...request, direction: 'outgoing' }] })), { label: 'Заявка отправлена', disabled: true });

  // A different player's request can have the same row ID as this player's ID.
  const unrelated = { ...request, id: person.id, playerId: 999, direction: 'outgoing' };
  assert.deepEqual(searchButton(render({ friends: [], requests: [unrelated] })), { label: 'Добавить в друзья', disabled: false });
});

test('friend actions stay disabled during a mutation or while the overview is loading', () => {
  const empty = { friends: [], requests: [] };
  assert.equal(searchButton(render(empty, { busy: true })).disabled, true);
  const loading = render(empty, { loading: true });
  assert.equal(searchButton(loading).disabled, true);
  assert.ok(loading.includes('Загружаем список друзей…'));
  assert.ok(!loading.includes('Добавьте первого друга'));
});

test('requests do not invent an online status that the API does not provide', () => {
  const request = { name: 'Миша', level: 7 };
  const html = renderToStaticMarkup(createElement(FriendRow, { person: request }));
  assert.ok(html.includes('Миша'));
  assert.ok(!html.includes('В сети'));
  assert.ok(!html.includes('Не в сети'));
  assert.ok(renderToStaticMarkup(createElement(FriendRow, { person })).includes('В сети'));
});
