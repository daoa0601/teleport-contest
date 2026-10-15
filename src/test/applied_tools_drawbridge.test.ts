import test from 'node:test';
import assert from 'node:assert/strict';
import { DB_FLOOR, DB_ICE, DRAWBRIDGE_UP, P_BASIC, P_FLAIL, W_WEP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { BULLWHIP, GRAPPLING_HOOK } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { installHeroWeaponSkills } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';

for (const under of [DB_FLOOR, DB_ICE] as const) {
    void test(`a whip aimed down below a raised bridge over ${under === DB_FLOOR ? 'ground' : 'ice'} hits the hero's foot`, async () => {
        const level = freshObjectRoom();
        requirePlayingGame(game);
        const square = level.requireAt(10, 10);
        square.typ = DRAWBRIDGE_UP;
        square.drawbridgemask = under;
        const whip = await addInventoryObject(BULLWHIP, { wielded: true, owornmask: W_WEP });
        game.uwep = game.u.uwep = whip;
        const oldHp = game.u.uhp;

        await applyInventoryObject(whip, '>          ');

        assert.ok(game.u.uhp < oldHp);
        assert.match(game._pending_message, /hit your foot with your bullwhip/);
    });

    void test(`a hook can grip ${under === DB_FLOOR ? 'ground' : 'ice'} below a raised bridge`, async () => {
        const level = freshObjectRoom();
        const square = level.requireAt(12, 10);
        square.typ = DRAWBRIDGE_UP;
        square.drawbridgemask = under;
        const hook = await addInventoryObject(GRAPPLING_HOOK, { wielded: true, owornmask: W_WEP });
        game.uwep = game.u.uwep = hook;
        installHeroWeaponSkills({ [P_FLAIL]: P_BASIC });
        game._travelTipShown = true;
        initRng(2n);

        await applyInventoryObject(hook, 'll.          ');

        assert.equal(game.u.ux, 11);
        assert.match(game._pending_message, /You are yanked toward the (ground|ice)/);
    });
}
