import assert from 'node:assert/strict';
import test from 'node:test';

import { PL_PSIZ, RUST_TRAP, SQKY_BOARD } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';
import { triggerImmediateMonsterTrap, resumeDeferredMonsterTrap } from '../js/monmove.js';
import { beginMonsterRustTrap, finishMonsterRustTrap } from '../js/rust_trap.js';
import { applyNethackrc, parseNethackrc } from '../js/options.js';
import { makedog } from '../js/u_init.js';
import { freshMonsterTrapRoom } from './support/monster-traps.js';
import { freshObjectRoom } from './support/object-room.js';

for (const [target, message] of [
    [3, 'A gush of water hits Sirius!'],
    [1, "A gush of water hits Sirius's left foreleg!"],
] as const) {
    void test(`a rust trap preserves a pet's given name when targeting ${target}`, async () => {
        const { monster, trap } = await freshMonsterTrapRoom(RUST_TRAP, {
            monster: { species: 'little dog' },
        });
        setMonsterGivenName(monster, 'Sirius');
        const messages: string[] = [];

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
    const messages: string[] = [];

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

    assert.equal(settings.flags.dogname, 'Mélusine');
    assert.equal(settings.flags.catname, 'Señor');
    assert.equal(settings.flags.horsename, 'Björk');
});

void test('a configured pet uses the existing eight-bit input setting and replaces control bytes', async () => {
    freshObjectRoom({ role: 'ranger' });
    game.iflags.wc_eight_bit_input = true;
    game.preferred_pet = 'd';
    applyNethackrc('OPTIONS=dogname:M\x01élusine\x7f');

    const pet = await makedog();

    assert.ok(pet);
    assert.equal(pet.mgivenname, 'M.élusine.');
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
