import assert from 'node:assert/strict';
import test from 'node:test';
import { useBullwhip } from '../js/bullwhip.js';
import { TT_BEARTRAP, W_WEP } from '../js/const.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { jumpHero } from '../js/jumping.js';
import { BULLWHIP, WAN_STRIKING } from '../js/object_data.js';
import { loadScoreRecords } from '../js/score_records.js';
import { breakWand } from '../js/apply.js';
import { addInventoryObject } from './support/game-objects.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { createDungeon } from './support/topology.js';
async function deathRoom(female, hitPoints = 1) {
    await freshObjectRoom({
        role: 'archeologist',
        hero: { uhp: hitPoints, uhpmax: 100, urexp: 100 },
        flags: { female, bones: false, disclose: '-i -a -v -c -o', tombstone: true },
        gameplaySeed: 1n,
    });
    game.storage = memoryStorage();
    game.iflags.toptenwin = true;
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 20 })];
    const input = resetInputState();
    const pages = [];
    input.beforeRead = () => {
        pages.push(requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n'));
    };
    installPagerInput(input, {
        expected: /bullwhip|bear trap|wand|blast|Boom|die|Goodbye|points|top ten|Killed/i,
        limit: 12,
    });
    return { input, pages };
}
function assertDeathCause(pages, cause) {
    assert.equal(game.program_state.gameover, true);
    const tombstone = pages.find(page => page.includes('REST'));
    assert.ok(tombstone, 'The death must display a tombstone.');
    const epitaph = tombstone.replace(/[|\s]+/gu, ' ');
    assert.ok(epitaph.includes(cause), `The tombstone must say "${cause}".`);
    assert.doesNotMatch(epitaph, /killed by a killed/u);
    assert.equal(loadScoreRecords()[0]?.death, cause);
    const capitalized = cause.charAt(0).toUpperCase() + cause.slice(1);
    assert.ok(pages.some(page => page.replace(/\s+/gu, ' ').includes(capitalized)), `The score list must say "${capitalized}".`);
}
for (const { female, reflexive, possessive } of [
    { female: false, reflexive: 'himself', possessive: 'his' },
    { female: true, reflexive: 'herself', possessive: 'her' },
]) {
    void test(`a hero fatally whipping ${reflexive} keeps the native epitaph and score cause`, async () => {
        const { pages } = await deathRoom(female);
        const whip = await addInventoryObject(BULLWHIP, { wielded: true, owornmask: W_WEP });
        game.uwep = game.u.uwep = whip;
        await useBullwhip(whip, { dx: 0, dy: 0, dz: 1 });
        assertDeathCause(pages, `killed ${reflexive} with ${possessive} bullwhip`);
    });
    void test(`a hero fatally breaking a wand uses ${reflexive} in the epitaph and score cause`, async () => {
        const { input, pages } = await deathRoom(female, 13);
        const wand = await addInventoryObject(WAN_STRIKING, { spe: 1 });
        input.feed('y');
        await breakWand(wand);
        assertDeathCause(pages, `killed ${reflexive} by breaking a wand`);
    });
}
void test('a fatal bear-trap escape is killed by the jump without an added article', async () => {
    const { input, pages } = await deathRoom(false);
    requirePlayingGame(game);
    game.u.utrap = 4;
    game.u.utraptype = TT_BEARTRAP;
    input.feed('lll.');
    await jumpHero(1);
    assertDeathCause(pages, 'killed by jumping out of a bear trap');
});
//# sourceMappingURL=apply_death_causes.test.js.map