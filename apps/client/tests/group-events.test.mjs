import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Theme } from '@radix-ui/themes';
import BattleScreen from '../src/features/combat/components/BattleScreen.tsx';
import { PartySlotsView } from '../src/features/group-events/components/PartySlotsView.tsx';
import { eventIsOpen, newerGroupState, remainingEventSeconds } from '../src/features/group-events/lib/state.ts';

test('event invitations open exactly at the start and disappear at the end or on disable', () => {
  const event = { enabled:true, startsAt:'2026-10-27T10:00:00Z', endsAt:'2026-10-27T11:00:00Z' };
  assert.equal(eventIsOpen(null),false);
  assert.equal(eventIsOpen(event,Date.parse('2026-10-27T09:59:59Z')),false);
  assert.equal(eventIsOpen(event,Date.parse(event.startsAt)),true);
  assert.equal(eventIsOpen(event,Date.parse(event.endsAt)),false);
  assert.equal(eventIsOpen({...event,enabled:false},Date.parse(event.startsAt)),false);
});
test('late responses cannot resurrect a group after a confirmed exit', () => {
  const latest = { revision:12, party:null, run:null, invites:[], event:null };
  assert.equal(newerGroupState(latest,{...latest,revision:11,party:{id:1}}),latest);
  const newer = {...latest,revision:13,party:{id:2}};
  assert.equal(newerGroupState(latest,newer),newer);
});
test('countdown uses server time and elapsed time, and never goes below zero', () => {
  assert.equal(remainingEventSeconds('2026-10-27T10:01:00Z','2026-10-27T10:00:00Z',15000),45);
  assert.equal(remainingEventSeconds('2026-10-27T10:01:00Z','2026-10-27T10:00:00Z',61000),0);
});
test('two existing side places hide plus buttons outside the event and keep the player between them', () => {
  const props = { places:[{slot:1},{slot:2}], canInvite:false,onInvite(){},onOpenLobby(){},children:createElement('span',null,'Мой персонаж') };
  const closed = renderToStaticMarkup(createElement(PartySlotsView,props));
  assert.equal(closed.includes('Пригласить друга в группу'),false);
  const open = renderToStaticMarkup(createElement(PartySlotsView,{...props,canInvite:true}));
  assert.equal((open.match(/aria-label="Пригласить друга в группу"/g)??[]).length,2);
  assert.ok(open.indexOf('party-add-button') < open.indexOf('Мой персонаж'));
  assert.ok(open.lastIndexOf('party-add-button') > open.indexOf('Мой персонаж'));
  const joined = renderToStaticMarkup(createElement(PartySlotsView,{...props,canInvite:true,places:[{slot:1,member:{name:'Друг',image:'friend.svg',hp:75,maxHp:100,pending:false,ready:true}},{slot:2}]}));
  assert.ok(joined.includes('alt="Друг"')); assert.ok(joined.includes('75/100 HP'));
  assert.equal((joined.match(/aria-label="Пригласить друга в группу"/g)??[]).length,1);
});
test('group scene renders six individually named fighters and one selected target', () => {
  const f = i => ({id:`fighter-${i}`,name:`Участник ${i}`,hp:i === 4 ? 0 : 100,maxHp:100,image:'fighter.svg', selected:i === 3,onSelect:i >= 3 ? ()=>{} : undefined});
  const fighters = Array.from({length:6},(_,i)=>f(i));
  const html = renderToStaticMarkup(createElement(Theme,null,createElement(BattleScreen,{battleId:'group',background:'square.svg',player:fighters[0],opponent:fighters[3],teams:{allies:fighters.slice(0,3),enemies:fighters.slice(3)},actions:null})));
  for(let i=0;i<6;i++) assert.ok(html.includes(`aria-label="Участник ${i},`));
  assert.equal((html.match(/aria-pressed="true"/g)??[]).length,1);
  assert.ok(html.includes('is-defeated')); assert.ok(html.includes('Противники — выберите цель'));
});
