import test from 'node:test';
import assert from 'node:assert/strict';
import { FOUNTAIN, POOL, SINK } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER, ELVEN_BOOTS, LEATHER_GLOVES, LENSES, POT_WATER } from '../js/object_data.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { planInput } from './support/planned-input.js';
for (const { type, name, terrain, source, pronoun } of [
    { type: ELVEN_BOOTS, name: 'boots', terrain: FOUNTAIN, source: 'fountain', pronoun: 'them' },
    { type: LEATHER_GLOVES, name: 'gloves', terrain: SINK, source: 'sink', pronoun: 'them' },
    { type: LENSES, name: 'lenses', terrain: POOL, source: 'pool of water', pronoun: 'them' },
    { type: DAGGER, name: 'dagger', terrain: FOUNTAIN, source: 'fountain', pronoun: 'it' },
]) {
    void test(`brief dip prompts use ${pronoun} for ${name} at a ${source}`, async (t) => {
        freshObjectRoom({ flags: { verbose: false } });
        requirePlayingGame(game);
        game.level.requireAt(game.u.ux, game.u.uy).typ = terrain;
        const target = await addInventoryObject(type);
        await addInventoryObject(POT_WATER);
        const input = resetInputState();
        planInput(input, t, [
            { prompt: /What do you want to dip\?/, keys: target.invlet },
            { prompt: new RegExp(`Dip ${pronoun} into the ${source}\\?`), keys: 'n' },
            { prompt: new RegExp(`What do you want to dip ${pronoun} into\\?`), keys: '\u001b' },
        ]);
        await runExtendedCommand('dip');
        assert.equal(target.quan, 1);
        assert.equal(game.context.move, 0);
    });
}
//# sourceMappingURL=potion_dip_prompt.test.js.map