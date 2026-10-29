import assert from 'node:assert/strict';
import test from 'node:test';
import { displayConfigurationErrors } from '../js/config_errors.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { parseNethackrc } from '../js/options.js';
import { freshObjectRoom } from './support/object-room.js';

for (const statement of ['BIND=;:menu_search', 'OPTIONS=menu_search:;']) {
    void test(`overflowing menu aliases with ${statement} prints a notice without pausing`, async () => {
        freshObjectRoom();
        const configuration = parseNethackrc([
            ...Array.from({ length: 32 }, () => 'BIND=;:menu_search'), statement,
        ].join('\n'));
        const input = resetInputState();
        let reads = 0;
        input.beforeRead = () => {
            reads++;
            input.feed('\n');
        };
        try {
            await displayConfigurationErrors(configuration.configErrors);
        } finally {
            input.beforeRead = null;
        }

        const screen = game.nhDisplay?.grid.map(row => row.map(cell => cell.ch).join('')).join('\n') ?? '';
        assert.match(screen, /out of menu map space\./);
        assert.doesNotMatch(screen, /Line \d+:|error in|Hit return/);
        assert.equal(reads, 0);
        assert.equal(configuration.commandBindings.menuAliases.length, 32);
    });
}
