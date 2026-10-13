import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { PL_PSIZ, RUST_TRAP, SQKY_BOARD } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';
import { triggerImmediateMonsterTrap, resumeDeferredMonsterTrap } from '../js/monmove.js';
import { beginMonsterRustTrap, finishMonsterRustTrap } from '../js/rust_trap.js';
import { applyNethackrc, parseNethackrc } from '../js/options.js';
import { makedog } from '../js/u_init.js';
import { initRng } from '../js/rng.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshMonsterTrapRoom } from './support/monster-traps.js';
import { freshObjectRoom } from './support/object-room.js';
import { freshTurnRoom } from './support/playable-room.js';
for (const [trapType, label, deaf, message] of [
    [SQKY_BOARD, 'squeaky board', false, 'A board beneath spot squeaks a C note loudly.'],
    [SQKY_BOARD, 'squeaky board', true, 'Spot stops momentarily and appears to cringe.'],
    [RUST_TRAP, 'rust trap', false, 'A gush of water hits spot'],
]) {
    void test(`a ${label} ${deaf ? 'capitalizes' : 'preserves'} a pet's lowercase name${deaf ? ' at the start of the cringe message' : ' within its message'}`, async () => {
        const input = freshTurnRoom({ left: 10, right: 14, top: 10, bottom: 10 });
        requirePlayingGame(game);
        const pet = await createMonsterAt('little dog', 12, 10);
        initializePet(pet);
        setMonsterGivenName(pet, 'spot');
        pet.msleeping = 0;
        pet.movement = 12;
        const trap = addTrap(game.level, trapType, 11, 10, { tnote: 0 });
        game.deaf = deaf;
        const messages = [];
        input.beforeRead = () => { messages.push(game._screen_output.split('\n')[0] ?? ''); };
        initRng(1n);
        pushKeys('.' + ' '.repeat(20) + '\x1b');
        await moveloop_core();
        await moveloop_core();
        assert.ok(messages.some(text => text.includes(message)), `Expected ${JSON.stringify(message)} after the pet entered the trap; saw ${messages.join(' | ')}`);
        assert.equal(trap.tseen ?? false, !deaf);
    });
}
for (const [target, message] of [
    [3, 'A gush of water hits Sirius!'],
    [1, "A gush of water hits Sirius's left foreleg!"],
]) {
    void test(`a rust trap preserves a pet's given name when targeting ${target}`, async () => {
        const { monster, trap } = await freshMonsterTrapRoom(RUST_TRAP, {
            monster: { species: 'little dog' },
        });
        setMonsterGivenName(monster, 'Sirius');
        const messages = [];
        const event = await beginMonsterRustTrap(monster, trap, game, { random: () => target });
        await finishMonsterRustTrap(monster, event, game, { publish: text => { messages.push(text); } });
        assert.equal(messages[0], message);
    });
}
void test('a squeaky board addresses a named pet without a species article', async () => {
    const { monster } = await freshMonsterTrapRoom(SQKY_BOARD, {
        monster: { species: 'little dog' }, trap: { tnote: 10 },
    });
    setMonsterGivenName(monster, 'Idefix');
    requirePlayingGame(game);
    const messages = [];
    const action = await triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterTrap(action, game, { publish: text => { messages.push(text); } });
    assert.equal(messages[0], 'A board beneath Idefix squeaks a B flat loudly.');
});
void test('configured pet names sanitize each UTF-8 byte for the tty', () => {
    const settings = parseNethackrc('OPTIONS=dogname:Ā,catname:Mélusine,horsename:€');
    assert.equal(settings.flags.dogname, '_.');
    assert.equal(settings.flags.catname, 'M__lusine');
    assert.equal(settings.flags.horsename, '_._');
});
void test('eight-bit tty input preserves printable bytes in each configured pet name', () => {
    const settings = parseNethackrc('OPTIONS=dogname:Mélusine,catname:Señor,horsename:Björk,eight_bit_tty');
    assert.equal(settings.flags.dogname, 'MÃ©lusine');
    assert.equal(settings.flags.catname, 'SeÃ±or');
    assert.equal(settings.flags.horsename, 'BjÃ¶rk');
});
void test('a configured pet uses the existing eight-bit input setting and replaces control bytes', async () => {
    freshObjectRoom({ role: 'ranger' });
    game.iflags.wc_eight_bit_input = true;
    game.preferred_pet = 'd';
    applyNethackrc('OPTIONS=dogname:M\x01élusine\x7f');
    const pet = await makedog();
    assert.ok(pet);
    assert.equal(pet.mgivenname, 'M.Ã©lusine.');
});
void test('eight-bit pet names retain printable characters beside sanitized controls', () => {
    const settings = parseNethackrc('OPTIONS=dogname:Ā,catname:€,eight_bit_tty');
    assert.equal(settings.flags.dogname, 'Ä.');
    assert.equal(settings.flags.catname, 'â.¬');
});
void test('eight-bit pet names retain the last character at the native name limit', async () => {
    freshObjectRoom({ role: 'ranger' });
    game.preferred_pet = 'd';
    const prefix = 'a'.repeat(PL_PSIZ - 2);
    applyNethackrc(`OPTIONS=dogname:${prefix}ĀZ,eight_bit_tty`);
    const pet = await makedog();
    assert.ok(pet);
    assert.equal(pet.mgivenname, `${prefix}Ä`);
});
void test('disabling eight-bit tty input strips high bytes from later pet names', () => {
    const settings = parseNethackrc('OPTIONS=eight_bit_tty\nOPTIONS=!eight_bit_tty\nOPTIONS=dogname:Mélusine');
    assert.equal(settings.flags.dogname, 'M__lusine');
});
void test('eight-bit tty input only affects pet names parsed after it', () => {
    const settings = parseNethackrc('OPTIONS=eight_bit_tty,dogname:Mélusine');
    assert.equal(settings.flags.dogname, 'M__lusine');
});
void test('configured pet names truncate at the native byte limit', () => {
    const prefix = 'a'.repeat(PL_PSIZ - 2);
    const settings = parseNethackrc(`OPTIONS=dogname:${prefix}ĀZ`);
    assert.equal(settings.flags.dogname, `${prefix}_`);
});
void test('configured pet names end at a null byte', () => {
    const settings = parseNethackrc('OPTIONS=dogname:Finn\x00Ghost');
    assert.equal(settings.flags.dogname, 'Finn');
});
void test('a configured dog name overrides the role default and preserves its case', async () => {
    const settings = parseNethackrc('OPTIONS=dogname:Sir Wags');
    freshObjectRoom({ role: 'ranger', flags: settings.flags });
    game.preferred_pet = 'd';
    const pet = await makedog();
    assert.ok(pet);
    assert.equal(pet.mgivenname, 'Sir Wags');
});
for (const option of ['dogname', 'catname', 'horsename']) {
    for (const suffix of ['', ':Replacement']) {
        void test(`negating ${option}${suffix ? ' with a value' : ''} preserves its configured name`, () => {
            const settings = parseNethackrc(`OPTIONS=${option}:Sirius\nOPTIONS=!${option}${suffix}`);
            assert.equal(settings.flags[option], 'Sirius');
        });
    }
    for (const value of ['none', '(none)']) {
        void test(`${option}:${value} explicitly clears a configured name`, () => {
            const settings = parseNethackrc(`OPTIONS=${option}:Sirius\nOPTIONS=${option}:${value}`);
            assert.equal(settings.flags[option], '');
        });
    }
}
//# sourceMappingURL=pool_pet_naming.test.js.map