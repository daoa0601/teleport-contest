import test from 'node:test';
import assert from 'node:assert/strict';
import { DB_ICE, DB_MOAT, DB_UNDER, DRAWBRIDGE_UP } from '../js/const.js';
import { vomitHero } from '../js/hero_illness.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';

void test('an acidic hero vomiting melts ice below a raised drawbridge', async () => {
    const level = freshObjectRoom();
    installPolymorphedHero('yellow dragon', { hitPoints: 1000 });
    const square = level.requireAt(10, 10);
    square.typ = DRAWBRIDGE_UP;
    square.drawbridgemask = DB_ICE;

    await vomitHero({ publish: () => {} });

    assert.equal((square.drawbridgemask ?? 0) & DB_UNDER, DB_MOAT);
});
