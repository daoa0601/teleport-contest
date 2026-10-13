import assert from 'node:assert/strict';
import test from 'node:test';
import { farlookLocationDescription, rhack } from '../js/cmd.js';
import { TER_MAP } from '../js/const.js';
import { flush_screen, newsym } from '../js/display.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { nameToMonster } from '../js/mondata.js';
import { races } from '../js/roles.js';
import { freshObjectRoom } from './support/object-room.js';
for (const role of ['wizard', 'knight']) {
    void test(`farlook identifies the ${role} on the hero's square`, async () => {
        freshObjectRoom({ role });
        game.plname = 'Aster';
        newsym(game.u.ux, game.u.uy);
        assert.equal(await farlookLocationDescription(game.u.ux, game.u.uy), `human ${role} called Aster`);
    });
}
void test('farlook respects terrain-only mode on the hero square', async () => {
    freshObjectRoom({ role: 'wizard' });
    game.iflags.terrainmode = TER_MAP;
    newsym(game.u.ux, game.u.uy);
    assert.equal(await farlookLocationDescription(game.u.ux, game.u.uy), 'floor of a room');
});
for (const showrace of [true, false]) {
    void test(`self-farlook describes the displayed gnome glyph with showrace=${showrace}`, async () => {
        const race = races.find(candidate => candidate.name === 'gnome');
        assert.ok(race);
        freshObjectRoom({ role: 'wizard', race, flags: { tips: false, showrace } });
        game.plname = 'Aster';
        newsym(game.u.ux, game.u.uy);
        const input = resetInputState();
        input.feed(';.');
        await rhack(0);
        await flush_screen(1);
        const description = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trim();
        assert.ok(description);
        assert.match(description, showrace
            ? /^G.*a gnome \(gnomish wizard called Aster\)$/
            : /^@.*a human or elf or you \(gnomish wizard called Aster\)$/);
    });
    void test(`self-farlook describes a polymorphed gnome with showrace=${showrace}`, async () => {
        const race = races.find(candidate => candidate.name === 'gnome');
        assert.ok(race);
        freshObjectRoom({ role: 'wizard', race, flags: { tips: false, showrace },
            hero: { umonnum: nameToMonster('newt'), mh: 8, mhmax: 8 } });
        game.plname = 'Aster';
        newsym(game.u.ux, game.u.uy);
        const input = resetInputState();
        input.feed(';.');
        await rhack(0);
        await flush_screen(1);
        const description = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trim();
        assert.ok(description);
        assert.match(description, /^:.*a lizard \(newt called Aster\)$/);
    });
}
//# sourceMappingURL=farlook_self.test.js.map