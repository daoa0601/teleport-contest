import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroAccessory } from '../js/accessory.js';
import { rhack } from '../js/cmd.js';
import { P_BASIC, P_RIDING, WEB } from '../js/const.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { AMULET_OF_LIFE_SAVING } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { installHeroWeaponSkills } from './support/hero-state.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt, createSaddledSteed } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const lifeSaving of [false, true]) {
    void test(`a web rescue interrupted by a lethal riding accident ${lifeSaving ? 'resumes after life saving' : 'ends without further rescue feedback'}`, async () => {
        const level = freshObjectRoom({ role: 'knight', hero: { ulevel: 30 } });
        requirePlayingGame(game);
        await createSaddledSteed('horse');
        await runExtendedCommand('ride', 'l');
        assert.ok(game.u.usteed);
        installHeroWeaponSkills({ [P_RIDING]: P_BASIC });
        const monster = await createMonsterAt('goblin', 12, 10);
        monster.mtrapped = 1;
        addTrap(level, WEB, 12, 10, { tseen: true });
        game.u.ulevel = 8;
        game.u.uhp = 1;
        game.flags.bones = false;
        game.flags.disclose = '-i -a -v -c -o';
        game.flags.tombstone = false;
        const input = resetInputState();
        const messages: string[] = [];
        input.beforeRead = () => {
            messages.push(game._pending_message || '');
            input.feed(' ');
        };
        if (lifeSaving) {
            const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
            await wearHeroAccessory(amulet, 'uamul');
        }
        input.feed('untrap\nl');
        initRng(1n);

        await rhack('#'.charCodeAt(0));

        assert.equal(!!game.program_state.gameover, !lifeSaving);
        assert.equal(game.u.umortality, 1);
        messages.push(game._pending_message || '');
        const screen = requireGameDisplay(game).grid
            .map(row => row.map(cell => cell.ch).join('')).join('\n');
        const feedback = messages.join('\n') + '\n' + screen;
        if (lifeSaving) assert.match(feedback, /remains entangled/);
        else assert.doesNotMatch(feedback, /remains entangled/);
    });
}
