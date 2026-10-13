import test from 'node:test';
import assert from 'node:assert/strict';
import { applyArmorOnEffects, wearHeroArmor } from '../js/armor.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { objectLightRadius } from '../js/light.js';
import { GOLD_DRAGON_SCALE_MAIL, SCR_LIGHT } from '../js/object_data.js';
import { readInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
for (const cursed of [false, true]) {
    void test(`a ${cursed ? 'cursed' : 'blessed'} light scroll changes worn gold armor's blessing and light radius`, async () => {
        freshObjectRoom({ gameplaySeed: 17n });
        requirePlayingGame(game);
        const input = resetInputState();
        const messages = [];
        input.beforeRead = () => { messages.push(game._pending_message); input.feed(' '); };
        const armor = await addInventoryObject(GOLD_DRAGON_SCALE_MAIL, { blessed: false, cursed: false });
        wearHeroArmor(armor);
        await applyArmorOnEffects(armor);
        const scroll = await addInventoryObject(SCR_LIGHT, { cursed, blessed: !cursed, typeKnown: true });
        await readInventoryObject(scroll);
        assert.equal(armor.cursed, cursed);
        assert.equal(armor.blessed, !cursed);
        assert.equal(objectLightRadius(armor), cursed ? 2 : 4);
        assert.equal(armor.lamplit, true);
        assert.equal(armor.bknown, true);
        assert.match([...messages, game._pending_message].join('\n'), cursed
            ? /glows with a black aura\..*\nIt shines less brightly\./
            : /glows with a light blue aura\..*\nIt shines brighter\./);
        assert.equal(scroll.where, 'gone');
        assert.equal(game.context.move, 1);
    });
}
//# sourceMappingURL=read_light_scrolls.test.js.map