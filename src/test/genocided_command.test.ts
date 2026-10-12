import test from 'node:test';
import assert from 'node:assert/strict';
import { G_EXTINCT, G_GENOD } from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { resetInputState } from '../js/input.js';
import { freshGameplayRoom } from './support/playable-room.js';

for (const wizard of [false, true]) {
    void test(`#genocided reads species history${wizard ? ' and reveals extinctions in wizard mode' : ''}`, async () => {
        freshGameplayRoom({ flags: { debug: wizard } });
        requirePlayingGame(game);
        game.mvitals = [];
        game.mvitals[MONSTER_NAME.indexOf('gnome')] = { born: 0, died: 0, mvflags: G_GENOD };
        game.mvitals[MONSTER_NAME.indexOf('giant ant')] = { born: 120, died: 0, mvflags: G_EXTINCT };
        game.mvitals[MONSTER_NAME.indexOf('Medusa')] = { born: 1, died: 1, mvflags: G_EXTINCT };
        const input = resetInputState();
        let listing = '';
        input.beforeRead = () => {
            const display = game.nhDisplay;
            const text = display?.grid.map(row => row.map(cell => cell.ch).join('')).join('\n') ?? '';
            if (text.includes('species:')) listing = text;
        };
        input.feed('genocided\n    ');

        await rhack('#'.charCodeAt(0));

        assert.match(listing, /gnomes/);
        assert.match(listing, /1 species genocided\./);
        if (wizard) {
            assert.match(listing, /giant ants \(extinct\)/);
            assert.match(listing, /1 species extinct\./);
        } else assert.doesNotMatch(listing, /giant ants/);
        assert.doesNotMatch(listing, /Medusa/);
        assert.equal(game.context.move, 0);
    });
}
