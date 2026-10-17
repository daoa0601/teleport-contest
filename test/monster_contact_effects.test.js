import test from 'node:test';
import assert from 'node:assert/strict';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { currentMulti } from '../js/command_state.js';
import { CLR_BRIGHT_BLUE } from '../js/terminal.js';
import { M_SEEN_FIRE, M_SEEN_SLEEP, NO_MINVENT, STONE } from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { flushPendingTopline, flush_screen, plineWithContinuation } from '../js/display.js';
import { game, requireGameDisplay, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { FOOD_RATION, RING_MAIL } from '../js/object_data.js';
import { dopray } from '../js/pray.js';
import { vision_note_blocker_change, vision_recalc } from '../js/vision.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
function visibleText() {
    return requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
}
async function contactAttacker(species) {
    freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, uac: 10 } });
    requirePlayingGame(game);
    const monster = await createMonsterAt(species, 11, 10, NO_MINVENT);
    monster.mpeaceful = 0;
    monster.m_lev = 20;
    monster.mux = game.u.ux;
    monster.muy = game.u.uy;
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');
    return monster;
}
for (const species of ['werejackal', 'homunculus', 'genetic engineer']) {
    void test(`a cancelled ${species} still inflicts its ordinary contact damage`, async () => {
        const monster = await contactAttacker(species);
        requirePlayingGame(game);
        monster.mcan = 1;
        await performMonsterHeroAttack(monster, game, { rollOne: () => 1, rollDice: () => 3 });
        assert.equal(game.u.uhp, 97);
        assert.equal(game.u.ulycn, -1);
        assert.equal(game._helplessTurns ?? 0, 0);
    });
}
void test('a werejackal bite infects the hero and still deals physical damage', async () => {
    const monster = await contactAttacker('werejackal');
    requirePlayingGame(game);
    await performMonsterHeroAttack(monster, game, {
        random: limit => limit === 10 ? 9 : limit === 30 ? 1 : 0,
        rollOne: () => 1, rollDice: () => 3,
    });
    assert.equal(game.u.ulycn, monster.mnum);
    assert.equal(game.u.uhp, 97);
});
for (const resistant of [false, true]) {
    void test(`a homunculus bite ${resistant ? 'does not put a sleep-resistant hero to sleep' : 'puts the hero to sleep'} and still hurts`, async () => {
        const monster = await contactAttacker('homunculus');
        requirePlayingGame(game);
        game.u.sleepResistance = resistant;
        await performMonsterHeroAttack(monster, game, {
            random: limit => limit === 10 ? 9 : 0,
            rollOne: sides => sides === 10 ? 4 : 1, rollDice: () => 3,
        });
        assert.equal(game.u.uhp, 97);
        assert.equal(game._helplessTurns ?? 0, resistant ? 0 : 4);
        assert.equal(!!game.u.usleep, !resistant);
    });
}
for (const delay of ['dressing', 'unprotected prayer', 'negative multi']) {
    void test(`a homunculus bite hurts without putting the hero to sleep during ${delay}`, async () => {
        const attacker = await contactAttacker('homunculus');
        requirePlayingGame(game);
        if (delay === 'dressing') {
            const armor = await addInventoryObject(RING_MAIL);
            assert.ok(armor.invlet);
            resetInputState().feed(armor.invlet);
            await rhack('W'.charCodeAt(0));
            assert.equal(game.uarm, armor);
        }
        else if (delay === 'unprotected prayer') {
            game.flags.paranoia_bits = 0;
            game.flags.debug = false;
            game.u.ublesscnt = 500;
            await dopray();
            assert.equal(game._helplessTurns, 3);
            assert.ok(!game.u.invulnerable);
        }
        else {
            game.multi = -3;
        }
        const input = resetInputState();
        input.beforeRead = () => input.feed(' ');
        const remainingDelay = currentMulti();
        await performMonsterHeroAttack(attacker, game, {
            random: limit => limit === 10 ? 9 : 0,
            rollOne: () => 1, rollDice: () => 3,
        });
        assert.equal(game.u.uhp, 97);
        assert.equal(currentMulti(), remainingDelay, 'A blocked sleep attack must preserve the current delay');
        assert.ok(!game.u.usleep);
    });
}
void test('magic resistance prevents a genetic engineer from changing the hero', async () => {
    const monster = await contactAttacker('genetic engineer');
    requirePlayingGame(game);
    game.u.antimagic = true;
    const species = game.u.umonnum;
    let sawShield = false;
    game.animationFrame = async () => {
        const cell = requireGameDisplay().grid[game.u.uy + 1]?.[game.u.ux - 1];
        if (cell && cell.color === CLR_BRIGHT_BLUE && cell.ch !== '@')
            sawShield = true;
    };
    await performMonsterHeroAttack(monster, game, {
        random: () => 9, rollOne: () => 1, rollDice: () => 3,
    });
    assert.equal(game.u.umonnum, species);
    assert.equal(game.u.uhp, 100, 'mon_poly returns before the ordinary damage tail');
    assert.ok(sawShield, 'Magic resistance displays a shield at the hero');
});
for (const resistant of [true, false]) {
    void test(`a homunculus bite teaches witnesses that the hero ${resistant ? 'resists' : 'can succumb to'} sleep`, async () => {
        const attacker = await contactAttacker('homunculus');
        requirePlayingGame(game);
        game.u.sleepResistance = resistant;
        const witness = await createMonsterAt('hill orc', 12, 10, NO_MINVENT);
        const blindWitness = await createMonsterAt('hill orc', 12, 9, NO_MINVENT);
        blindWitness.mcansee = 0;
        const hiddenWitness = await createMonsterAt('hill orc', 15, 10, NO_MINVENT);
        const remembered = M_SEEN_FIRE | (resistant ? 0 : M_SEEN_SLEEP);
        for (const monster of [attacker, witness, blindWitness, hiddenWitness])
            monster.seen_resistance = remembered;
        const level = requireGameLevel();
        for (let y = 6; y <= 14; y++) {
            const wall = level.at(13, y);
            assert.ok(wall);
            wall.typ = STONE;
            vision_note_blocker_change(13, y);
        }
        vision_recalc(0);
        await performMonsterHeroAttack(attacker, game, {
            random: limit => limit === 10 ? 9 : 0,
            rollOne: () => 1, rollDice: () => 3,
        });
        const observed = M_SEEN_FIRE | (resistant ? M_SEEN_SLEEP : 0);
        assert.equal(attacker.seen_resistance, observed);
        assert.equal(witness.seen_resistance, observed);
        assert.equal(blindWitness.seen_resistance, observed, 'Native m_canseeu checks line of sight without checking blindness');
        assert.equal(hiddenWitness.seen_resistance, remembered);
    });
}
for (const finished of [false, true]) {
    void test(`sleep from a homunculus bite ${finished ? 'finishes a pending meal' : 'reports the interrupted meal'}`, async () => {
        const attacker = await contactAttacker('homunculus');
        requirePlayingGame(game);
        const food = await addInventoryObject(FOOD_RATION);
        assert.ok(food.invlet);
        const input = resetInputState();
        const messages = [];
        input.beforeRead = () => { messages.push(game._pending_message || ''); input.feed(' '); };
        input.feed(food.invlet);
        await rhack('e'.charCodeAt(0));
        const meal = game.context.victual;
        assert.ok(meal);
        assert.ok(game._occupation);
        if (finished)
            meal.usedtime = meal.reqtime;
        await performMonsterHeroAttack(attacker, game, {
            random: limit => limit === 10 ? 9 : 0,
            rollOne: () => 1, rollDice: () => 3,
        });
        await flush_screen(1);
        messages.push(visibleText());
        assert.equal(game._occupation, null);
        assert.equal(game._helplessTurns, 1);
        const displayed = messages.join('\n');
        if (finished) {
            assert.equal(food.where, 'gone');
            assert.match(displayed, /You finish eating the food ration\./);
            assert.doesNotMatch(displayed, /You stop eating/);
        }
        else {
            assert.equal(food.where, 'inventory');
            assert.match(displayed, /You stop eating the food ration\./);
        }
        assert.match(displayed, /You are put to sleep by the homunculus!/);
    });
}
// C mhitu.c:mdamageu() reaches done_in_by() before hitmu() stops the
// occupation, so a fatal bite never reports the interrupted meal.
void test('a bite that kills an eating hero does not report the interrupted meal', async () => {
    const attacker = await contactAttacker('jackal');
    requirePlayingGame(game);
    game.flags.bones = false;
    game.flags.tombstone = false;
    game.storage = memoryStorage();
    const food = await addInventoryObject(FOOD_RATION);
    assert.ok(food.invlet);
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message || ''); input.feed(' '); };
    input.feed(food.invlet);
    await rhack('e'.charCodeAt(0));
    assert.ok(game._occupation);
    game.u.uhp = 1;
    await performMonsterHeroAttack(attacker, game, {
        random: limit => limit === 10 ? 9 : 0,
        rollOne: () => 1, rollDice: () => 3,
    });
    assert.equal(game.program_state.gameover, true);
    const displayed = messages.join('\n');
    assert.match(displayed, /You die\.\.\./);
    assert.doesNotMatch(displayed, /You stop eating/);
});
void test('Escape cannot suppress a werejackal infection warning', async () => {
    const attacker = await contactAttacker('werejackal');
    requirePlayingGame(game);
    await plineWithContinuation('A distant bell rings.');
    const input = resetInputState();
    input.feed('\x1b');
    await flushPendingTopline();
    input.beforeRead = () => input.feed(' ');
    await performMonsterHeroAttack(attacker, game, {
        random: limit => limit === 10 ? 9 : limit === 30 ? 1 : 0,
        rollOne: () => 1, rollDice: () => 3,
    });
    await flush_screen(1);
    assert.equal(game.u.ulycn, attacker.mnum);
    assert.match(visibleText(), /You feel feverish\./);
});
//# sourceMappingURL=monster_contact_effects.test.js.map