import test from 'node:test';
import assert from 'node:assert/strict';
import { A_CON, A_DEX, A_STR, D_BROKEN, D_CLOSED, D_NODOOR, D_TRAPPED, DOOR, SHARED, SHOP_DOOR_COST, VWALL, W_ARMF } from '../js/const.js';
import { canSpotMonster } from '../js/display.js';
import { game } from '../js/gstate.js';
import { setHeroGoldAmount } from '../js/hero_gold.js';
import { resetInputState } from '../js/input.js';
import { KICKING_BOOTS } from '../js/object_data.js';
import { vision_recalc, vision_reset_new_level } from '../js/vision.js';
import { kickDirection } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { requireFixtureGame } from './support/game-state.js';
import { installPagerInput } from './support/pager-input.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createStaffedShop } from './support/shop.js';
for (const trapped of [false, true]) {
    void test(`kicking a ${trapped ? 'trapped ' : ''}shop door on a shared corner charges for the damage`, async () => {
        const level = freshPlayableRoom({ bottom: 14, hero: { uhp: 100, uhpmax: 100 } });
        requireFixtureGame(game);
        for (const attribute of [A_STR, A_DEX, A_CON])
            game.u.acurr.a[attribute] = 25;
        game.uarmf = await addInventoryObject(KICKING_BOOTS, { initialize: false, owornmask: W_ARMF });
        const { shopkeeper } = await createStaffedShop({
            left: 12, right: 16, top: 11, bottom: 13,
            keeperX: 14, keeperY: 12, doorX: 11, doorY: 10,
        });
        const door = level.requireAt(11, 10);
        door.typ = DOOR;
        door.doormask = D_CLOSED | (trapped ? D_TRAPPED : 0);
        // Only the diagonal squares belong to the shop at this shared corner.
        door.roomno = SHARED;
        door.edge = true;
        installPagerInput(resetInputState(), {
            expected: /door|booby-trapped|stagger|appears|shop/, limit: 10,
        });
        await kickDirection('l');
        assert.equal(door.doormask, trapped ? D_NODOOR : D_BROKEN);
        assert.equal(level.damagelist?.length, 1);
        assert.equal(level.damagelist?.[0]?.cost, SHOP_DOOR_COST);
        assert.equal(shopkeeper.mpeaceful, 0);
        assert.equal(game._lastPlineMessage, '"How dare you break my door?"');
    });
}
for (const trapped of [false, true]) {
    for (const hidden of [false, true]) {
        void test(`kicking a ${trapped ? 'trapped ' : ''}shop door announces a ${hidden ? 'hidden' : 'visible'} keeper's arrival`, async () => {
            const level = freshPlayableRoom({ hero: { uhp: 100, uhpmax: 100 } });
            requireFixtureGame(game);
            game.uarmf = await addInventoryObject(KICKING_BOOTS, { initialize: false, owornmask: W_ARMF });
            const { roomno, shopkeeper } = await createStaffedShop({
                left: 12, right: 16, top: 8, bottom: 12,
                keeperX: 14, keeperY: hidden ? 10 : 8, doorX: 11, doorY: 10,
            });
            shopkeeper.eshk.shknam = '+Ada';
            setHeroGoldAmount(game, 500);
            if (hidden) {
                for (let y = 8; y <= 12; y++)
                    level.requireAt(11, y).typ = VWALL;
            }
            const door = level.requireAt(11, 10);
            door.typ = DOOR;
            door.doormask = D_CLOSED | (trapped ? D_TRAPPED : 0);
            door.roomno = roomno;
            door.edge = true;
            vision_reset_new_level();
            vision_recalc(0);
            assert.equal(canSpotMonster(shopkeeper), !hidden, 'The keeper must start on the intended side of the sight barrier.');
            const messages = [];
            const input = resetInputState();
            input.beforeRead = () => {
                messages.push(game._pending_message);
                if (/Pay\?$/.test(game._pending_message))
                    input.feed('n');
            };
            installPagerInput(input, { expected: /door|booby-trapped|stagger|Ada/, limit: 10 });
            await kickDirection('l');
            const prose = messages.join('\n');
            assert.match(prose, hidden
                ? /Ada appears next to you!/
                : /Ada vanishes and reappears next to you\./);
            if (hidden)
                assert.doesNotMatch(prose, /vanishes/);
            assert.equal(shopkeeper.mx, 11);
            assert.equal(shopkeeper.my, 10);
            assert.equal(canSpotMonster(shopkeeper), true);
        });
    }
}
//# sourceMappingURL=shop_door_kick.test.js.map