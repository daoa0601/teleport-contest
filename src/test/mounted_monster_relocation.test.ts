import { requireScreenRow } from './support/screen.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { wearHeroAccessory } from '../js/accessory.js';
import { P_BASIC, P_RIDING } from '../js/const.js';
import { flush_screen } from '../js/display.js';
import { game, requirePlayingGame, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { AMULET_OF_LIFE_SAVING, CORPSE, DIAMOND, RIN_TELEPORT_CONTROL } from '../js/object_data.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { monsterAtPosition } from '../js/monster_location.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { ensureHeroSkills } from '../js/skills.js';
import { randomMonsterRelocation } from '../js/teleport.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { createSaddledSteed } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { createDungeon } from './support/topology.js';

function answerTeleport(keys: string) {
    const input = resetInputState();
    const messages: string[] = [];
    const remaining = [...keys];
    let selectingDestination = false;
    input.beforeRead = () => { messages.push(game._pending_message || ''); };
    installPagerInput(input, {
        expected: /amulet of life saving.*being worn|lying here on the floor|teleport|pony|cockatrice|stone|medallion|But wait|die|much better|Goodbye|points/i,
        limit: 24,
    });
    const pager = input.display;
    assert.ok(pager);
    input.display = {
        async readKey() {
            const screen = requireGameDisplay().grid.map(row =>
                row.map(cell => cell.ch).join('')).join('\n');
            if (/Where do you and .*pony want to be teleported/.test(screen)) selectingDestination = true;
            if (/--More--|Hit space to continue/.test(screen)) return pager.readKey();
            assert.ok(selectingDestination, 'The native teleport question precedes cursor movement');
            assert.match(screen, /Where do you and .*pony want to be teleported|floor of a room|an uncursed diamond|cockatrice corpse|Move cursor|Pick an object|Use the cursor/i);
            const key = remaining.shift();
            assert.ok(key !== undefined, `Unexpected input request: ${screen}`);
            return key.charCodeAt(0);
        },
    };
    return messages;
}

for (const outcome of ['arrive', 'stay', 'cancel', 'blocked'] as const) {
    void test(`relocating a ridden pony uses the hero teleport rules: ${outcome}`, async () => {
        freshObjectRoom({
            role: 'knight', hero: { ulevel: 30 },
            flags: { tips: false, verbose: false, pickup: true },
        });
        requirePlayingGame(game);
        const pony = await createSaddledSteed();
        await runExtendedCommand('ride', 'l');
        assert.equal(game.u.usteed, pony);
        await wearHeroAccessory(await addInventoryObject(RIN_TELEPORT_CONTROL), 'uleft');
        const riding = ensureHeroSkills(game)?.[P_RIDING];
        assert.ok(riding, 'A Knight has a riding skill record');
        riding.skill = P_BASIC;
        game.u.uhunger = 1;
        game.u.uen = 0;
        const gem = await floorObject(DIAMOND, outcome === 'stay' ? 11 : 13, 10);
        game.level.flags.noteleport = outcome === 'blocked';
        const keys = { arrive: 'll.', stay: '.', cancel: '\x1b', blocked: '' };
        const messages = answerTeleport(keys[outcome]);

        const result = await randomMonsterRelocation(pony);
        await flush_screen();

        assert.ok(result, 'Native rloc reports success even if tele does not move the rider');
        const expected = outcome === 'arrive' ? [13, 10] : [11, 10];
        assert.deepEqual([game.u.ux, game.u.uy], expected);
        assert.deepEqual([pony.mx, pony.my], expected);
        assert.equal(result.moved, outcome === 'arrive');
        assert.equal(!!result.died, false);
        assert.equal(game.u.usteed, pony);
        assert.notEqual(monsterAtPosition(game.level, pony.mx, pony.my), pony);
        assert.equal(game.inventory.includes(gem), outcome === 'arrive' || outcome === 'stay');
        assert.equal(game.u.uhunger, 1, 'forced teleport has no at-will hunger cost');
        assert.equal(game.u.uen, 0);
        if (outcome === 'blocked') {
            const line = requireScreenRow(0).map(cell => cell.ch).join('');
            assert.match(line, /mysterious force prevents you from teleporting/);
        } else {
            assert.match(messages.join('\n'), /Where do you and .*pony want to be teleported/);
        }
    });
}

for (const lifeSaving of [false, true]) {
    void test(`mounted relocation reports ${lifeSaving ? 'recovery' : 'permanent death'} at its destination`, async () => {
        freshObjectRoom({
            role: 'knight', hero: { ulevel: 30 },
            flags: { tips: false, verbose: false, pickup: false },
        });
        requirePlayingGame(game);
        game.flags.disclose = '-i -a -v -c -o';
        game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom' })];
        const pony = await createSaddledSteed();
        await runExtendedCommand('ride', 'l');
        assert.equal(game.u.usteed, pony);
        await wearHeroAccessory(await addInventoryObject(RIN_TELEPORT_CONTROL), 'uleft');
        const riding = ensureHeroSkills(game)?.[P_RIDING];
        assert.ok(riding, 'A Knight has a riding skill record');
        riding.skill = P_BASIC;
        const messages = answerTeleport('ll.');
        let amulet;
        if (lifeSaving) {
            amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
            await wearHeroAccessory(amulet, 'uamul');
        }
        await floorObject(CORPSE, 13, 10, {
            initialize: false, corpsenm: MONSTER_NAME.indexOf('cockatrice'),
        });
        setHeroBlindnessTurns(20);

        const result = await randomMonsterRelocation(pony);

        assert.ok(result, 'Mounted relocation returns its landing result');
        assert.equal(result.died, !lifeSaving);
        assert.deepEqual([game.u.ux, game.u.uy], [13, 10]);
        assert.equal(game.u.umortality, 1);
        assert.equal(!!game.program_state.gameover, !lifeSaving);
        assert.match(messages.join('\n'), /cockatrice corpse/);
        if (lifeSaving) {
            assert.ok(amulet, 'The recovery setup supplied a life-saving amulet');
            assert.equal(amulet.where, 'gone');
            assert.ok(game.u.uhp > 0);
            assert.equal(game.u.usteed, pony);
        }
    });
}

void test('an uncontrolled mounted relocation keeps the ridden pony off the monster grid', async () => {
    freshObjectRoom({ role: 'knight', hero: { ulevel: 30 } });
    requirePlayingGame(game);
    const pony = await createSaddledSteed();
    await runExtendedCommand('ride', 'l');
    assert.equal(game.u.usteed, pony);
    answerTeleport('');

    const result = await randomMonsterRelocation(pony);

    assert.ok(result);
    assert.equal(result.died, false);
    assert.equal(game.u.usteed, pony);
    assert.deepEqual([pony.mx, pony.my], [game.u.ux, game.u.uy]);
    assert.notEqual(monsterAtPosition(game.level, pony.mx, pony.my), pony);
});
