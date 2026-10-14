import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroAccessory } from '../js/accessory.js';
import { wearHeroArmor } from '../js/armor.js';
import { rhack } from '../js/cmd.js';
import { FIRE_TRAP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { LEATHER_ARMOR, RIN_FIRE_RESISTANCE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';

for (const wornResistance of [false, true]) {
    void test(`a fire trap ${wornResistance ? 'protects armor through a worn fire-resistance ring' : 'burns armor despite innate fire resistance'}`, async () => {
        const level = freshObjectRoom({ hero: { fireResistance: true } });
        requirePlayingGame(game);
        const armor = await addInventoryObject(LEATHER_ARMOR, { oeroded: 0 });
        wearHeroArmor(armor);
        if (wornResistance)
            await wearHeroAccessory(await addInventoryObject(RIN_FIRE_RESISTANCE), 'uleft');
        addTrap(level, FIRE_TRAP, 11, 10);
        const input = resetInputState();
        input.beforeRead = () => input.feed(' ');
        initRng(1n);

        await rhack('l'.charCodeAt(0));

        assert.equal(armor.oeroded, wornResistance ? 0 : 1);
        assert.equal(game.u.ux, 11);
    });
}
