import test from 'node:test';
import assert from 'node:assert/strict';
import { CORR, VAULT, VWALL } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pline } from '../js/display.js';
import { resetInputState } from '../js/input.js';
import { setHeroGoldAmount } from '../js/hero_gold.js';
import { addCreatedObjectToContainer } from '../js/object_container.js';
import { GOLD_PIECE, SACK } from '../js/object_data.js';
import { continueVaultGuardArrival, maintainVaultResidence } from '../js/vault.js';
import type { PromptAnswer } from './support/input-boundaries.js';
import { answerPrompts } from './support/input-boundaries.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { createRoom } from './support/topology.js';

for (const goldLocation of ['none', 'purse', 'sack', 'both'] as const) {
    void test(`guard arrival pages unread prose and requests gold kept in ${goldLocation}`, async () => {
        const level = freshObjectRoom({ left: 9, right: 10, top: 9, bottom: 10 });
        requirePlayingGame(game);
        level.rooms.push(createRoom({ lx: 9, hx: 10, ly: 9, hy: 10, rtype: VAULT }));
        level.requireAt(16, 10).typ = CORR;
        level.requireAt(11, 10).typ = VWALL;
        setHeroGoldAmount(game, goldLocation === 'purse' || goldLocation === 'both' ? 37 : 0);
        if (goldLocation === 'sack' || goldLocation === 'both') {
            const sack = await addInventoryObject(SACK);
            await addCreatedObjectToContainer(sack, await knownObject(GOLD_PIECE, { quan: 37 }));
        }
        game.u.uinvault = 29;
        await pline('You see here 398 gold pieces.');
        const input = resetInputState();
        assert.equal(maintainVaultResidence(), true);

        const answers: PromptAnswer[] = [
            { prompt: /You see here 398 gold pieces\.--More--/, keys: ' ' },
            { prompt: /Suddenly one of the Vault's guards enters!--More--/, keys: ' ' },
            { prompt: /Hello stranger, who are you\?/, keys: 'TestHero\n' },
        ];
        if (goldLocation !== 'none') {
            answers.push(
                { prompt: goldLocation === 'sack'
                    ? /"I don't know you\."  "You have hidden gold\."--More--/
                    : /"I don't know you\."--More--/, keys: ' ' },
                { prompt: /"Most likely all your gold was stolen from this vault\."--More--/, keys: ' ' },
            );
        }

        const arrived = await answerPrompts(continueVaultGuardArrival(), input, answers);

        assert.equal(arrived, true);
        assert.match(game._pending_message, goldLocation === 'none'
            ? /"I don't know you\."  "Please follow me\."/
            : /"Please drop that gold and follow me\."/);
        assert.equal(level.monsters.filter(monster => monster.isgd).length, 1);
        const guard = level.monsters.find(monster => monster.isgd);
        assert.equal(guard?._egd?.dropgoldcnt, goldLocation === 'none' ? 0 : 1);
    });
}
