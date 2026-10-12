import test from 'node:test';
import assert from 'node:assert/strict';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { FAINTED, NO_MINVENT, W_ARMC } from '../js/const.js';
import { canSeeMonster, flush_screen } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { putHeroToSleep } from '../js/hero_sleep.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { resetInputState } from '../js/input.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { vision_recalc } from '../js/vision.js';
import { summonWereAttackHelp } from '../js/were.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { addInventoryObject, artifactObject } from './support/game-objects.js';
import { CLOAK_OF_PROTECTION } from '../js/object_data.js';
import { installPagerInput } from './support/pager-input.js';

async function attacker() {
    const level = freshObjectRoom({ gameplaySeed: 314 });
    requirePlayingGame(game);
    const monster = await createMonsterAt(263, 11, 10, NO_MINVENT);
    monster.mux = game.u.ux;
    monster.muy = game.u.uy;
    monster.mpeaceful = 0;
    monster.mhp = 4;
    monster.mhpmax = 20;
    game.u.invulnerable = true;
    game._prayerTurnsRemaining = 2;
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');
    return { level, monster };
}

void test('an attacking human werewolf transforms, heals, and calls wild wolves before respecting prayer', async () => {
    const { level, monster } = await attacker();
    requirePlayingGame(game);

    await performMonsterHeroAttack(monster, game, { random: () => 0 });

    assert.equal(monster.mnum, 21);
    assert.equal(monster.mhp, 8);
    const helpers = level.monsters.filter(other => other !== monster);
    assert.ok(helpers.length >= 1 && helpers.length <= 5);
    assert.ok(helpers.every(other =>
        ['wolf', 'warg', 'winter wolf'].includes(MONSTER_NAME[other.mnum] ?? '')));
    assert.ok(helpers.every(other => !other.mtame));
});

for (const reason of ['cancelled', 'shapechanger', 'distant-image'] as const) {
    void test(`a werewolf with ${reason} does not transform or summon during its attack`, async () => {
        const { level, monster } = await attacker();
        requirePlayingGame(game);
        if (reason === 'cancelled') monster.mcan = 1;
        if (reason === 'shapechanger') monster.cham = 263;
        if (reason === 'distant-image') monster.mux = monster.mx + 4;

        await performMonsterHeroAttack(monster, game, { random: () => 0 });

        assert.equal(monster.mnum, 263);
        assert.equal(level.monsters.length, 1);
    });
}

for (const condition of ['sleeping', 'fainted', 'paralyzed', 'awake'] as const) {
    void test(`${condition} heroes feel unseen werewolf helpers surrounding them`, async () => {
        const level = freshObjectRoom({ gameplaySeed: 314 });
        requirePlayingGame(game);
        const monster = await createMonsterAt('human werewolf', 11, 10, NO_MINVENT);
        setHeroBlindnessTurns(5);
        vision_recalc(0);
        if (condition === 'sleeping') putHeroToSleep(5);
        if (condition === 'fainted') {
            game.u.uhs = FAINTED;
            game._helplessTurns = 5;
        }
        if (condition === 'paralyzed') game._helplessTurns = 5;
        installPagerInput(resetInputState(), {
            expected: /Something|hemmed in/,
            limit: 2,
        });

        await summonWereAttackHelp(monster, game, () => 0);
        await flush_screen();

        const helpers = level.monsters.filter(other => other !== monster);
        assert.ok(helpers.length > 0);
        assert.ok(helpers.every(helper => !canSeeMonster(helper)));
        const message = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('') ?? '';
        assert.match(message, condition === 'sleeping' || condition === 'fainted'
            ? /You dream that you feel hemmed in\./ : /You feel hemmed in\./);
    });
}

for (const protection of ['none', 'already infected', 'shapechanger protection', 'cancelled', 'magic negation', 'Werebane'] as const) {
    void test(`a werejackal bite ${protection === 'none' ? 'infects' : 'respects ' + protection} after its hit message`, async () => {
        freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, uac: 10 } });
        requirePlayingGame(game);
        const jackal = await createMonsterAt('werejackal', 11, 10, NO_MINVENT);
        jackal.mpeaceful = false;
        jackal.mux = game.u.ux;
        jackal.muy = game.u.uy;
        if (protection === 'already infected') game.u.ulycn = MONSTER_NAME.indexOf('wererat');
        if (protection === 'shapechanger protection') game.u.protectionFromShapeChangers = true;
        if (protection === 'cancelled') jackal.mcan = 1;
        if (protection === 'magic negation') {
            const cloak = await addInventoryObject(CLOAK_OF_PROTECTION, { owornmask: W_ARMC });
            game.uarmc = cloak;
        }
        if (protection === 'Werebane') game.uwep = await artifactObject('Werebane', { where: 'inventory' });
        const input = resetInputState();
        const messages: string[] = [];
        input.beforeRead = () => { messages.push(game._pending_message); };
        installPagerInput(input, { expected: /werejackal|feverish|harm/, limit: 5 });

        await performMonsterHeroAttack(jackal, game, {
            // Permit the bite and infection without summoning or transformation.
            random: sides => sides === 4 ? 0 : sides === 10 && protection === 'magic negation' ? 0 : sides - 1,
            rollOne: () => 1, rollDice: () => 2,
        });

        const prose = [...messages, game._pending_message].join('\n');
        if (protection === 'none') {
            assert.match(prose, /The werejackal bites!.*You feel feverish\./s);
            assert.equal(game.u.ulycn, jackal.mnum);
            assert.equal(game.u.drainResistance, true);
        } else {
            assert.doesNotMatch(prose, /feverish/);
            assert.equal(game.u.ulycn, protection === 'already infected' ? MONSTER_NAME.indexOf('wererat') : -1);
        }
        assert.equal(game.u.uhp, 98, 'The bite still deals its physical damage');
    });
}
