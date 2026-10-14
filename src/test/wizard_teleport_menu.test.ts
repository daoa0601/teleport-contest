import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { P_ESCAPE_SPELL, P_EXPERT } from '../js/const.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { nameToMonster } from '../js/mondata.js';
import { SPE_TELEPORT_AWAY } from '../js/object_data.js';
import { grantIntrinsicProperty, propertyIsActive } from '../js/properties.js';
import { forceLearnSpell } from '../js/spell.js';
import { ensureHeroSkills } from '../js/skills.js';
import { freshObjectRoom } from './support/object-room.js';

for (const command of ['m\x14', 'm#teleport\n']) {
    void test(`${command.includes('#') ? 'm #teleport' : 'm Ctrl-T'} cancels its mode menu without taking time or nutrition`, async () => {
        freshObjectRoom({ flags: { debug: true, tips: false, verbose: false } });
        requirePlayingGame(game);
        const hunger = game.u.uhunger;
        const energy = game.u.uen;
        const input = resetInputState();
        input.feed(command);
        let menu = '';
        input.display = {
            async readKey() {
                menu = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
                return 27;
            },
        };

        await rhack(0);

        assert.equal(game.context.move, 0, 'Cancelling the mode menu returns before dotele()');
        assert.equal(game.u.uhunger, hunger);
        assert.equal(game.u.uen, energy);
        assert.equal(game.u.ux, 10);
        assert.equal(game.u.uy, 10);
        assert.match(menu, /Which way do you want to teleport\?/);
        assert.match(menu, /w \* debug mode; ignore restrictions/);
    });
}

for (const choice of ['w', '\r']) {
    void test(`the teleport mode menu uses debug mode when ${choice === 'w' ? 'its preselection is toggled off' : 'Enter accepts its preselection'}`, async () => {
        freshObjectRoom({ flags: { debug: true, tips: false, verbose: false } });
        requirePlayingGame(game);
        const hunger = game.u.uhunger;
        const energy = game.u.uen;
        const input = resetInputState();
        input.feed('m\x14');
        let choosingMode = true;
        input.display = {
            async readKey() {
                const screen = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
                if (screen.includes('--More--')) return 32;
                if (choosingMode) {
                    assert.match(screen, /Which way do you want to teleport\?/);
                    choosingMode = false;
                    return choice.charCodeAt(0);
                }
                assert.match(screen, /Where do you want to be teleported/);
                input.feed('.');
                return 'l'.charCodeAt(0);
            },
        };

        await rhack(0);

        assert.equal(game.u.ux, 11);
        assert.equal(game.u.uhunger, hunger - 100);
        assert.equal(game.u.uen, energy, 'Debug teleport bypasses the energy requirement');
        assert.equal(game.context.move, 1);
    });
}

void test('the try-teleport mode suppresses intrinsic teleport and the known spell for this command', async () => {
    freshObjectRoom({ flags: { debug: true, tips: false, verbose: false } });
    requirePlayingGame(game);
    grantIntrinsicProperty('teleportation', 'outside');
    forceLearnSpell(SPE_TELEPORT_AWAY);
    const spell = game.spells[0];
    const hunger = game.u.uhunger;
    const input = resetInputState();
    input.feed('m\x14');
    input.display = {
        async readKey() {
            const screen = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            assert.match(screen, /Which way do you want to teleport\?/);
            return 't'.charCodeAt(0);
        },
    };

    await rhack(0);

    assert.match(game._pending_message, /You don't know that spell\./);
    assert.equal(game.context.move, 0);
    assert.equal(game.u.uhunger, hunger);
    assert.equal(propertyIsActive('teleportation'), true, 'The original intrinsic is restored');
    assert.equal(game.spells[0], spell, 'The original spell entry is restored');
});

void test('normal teleport mode grants a temporary intrinsic and charges energy and nutrition', async () => {
    freshObjectRoom({ hero: { ulevel: 12, uen: 50, uenmax: 50 }, flags: { debug: true, tips: false, verbose: false } });
    requirePlayingGame(game);
    forceLearnSpell(SPE_TELEPORT_AWAY);
    const spell = game.spells[0];
    const hunger = game.u.uhunger;
    const input = resetInputState();
    input.feed('m\x14');
    let choosingMode = true;
    input.display = {
        async readKey() {
            const screen = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            if (screen.includes('--More--')) return 32;
            if (choosingMode) {
                assert.match(screen, /Which way do you want to teleport\?/);
                choosingMode = false;
                return 'n'.charCodeAt(0);
            }
            assert.match(screen, /Where do you want to be teleported/);
            input.feed('.');
            return 'l'.charCodeAt(0);
        },
    };

    await rhack(0);

    assert.equal(game.u.ux, 11);
    assert.equal(game.u.uen, 20);
    assert.equal(game.u.uhunger, hunger - 100);
    assert.equal(game.context.move, 1);
    assert.equal(propertyIsActive('teleportation'), false, 'The temporary intrinsic is removed');
    assert.equal(game.spells[0], spell);
});

void test('normal teleport mode obeys the hero experience-level requirement without taking time', async () => {
    freshObjectRoom({ hero: { ulevel: 1, uen: 50 }, flags: { debug: true, tips: false, verbose: false } });
    requirePlayingGame(game);
    const input = resetInputState();
    input.feed('m\x14');
    input.display = {
        async readKey() {
            const screen = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            assert.match(screen, /Which way do you want to teleport\?/);
            return 'n'.charCodeAt(0);
        },
    };

    await rhack(0);

    assert.equal(game._pending_message, 'You are not able to teleport at will.');
    assert.equal(game.context.move, 0);
    assert.equal(game.u.uen, 50);
    assert.equal(propertyIsActive('teleportation'), false);
});

void test('the try-teleport mode suppresses teleportation in a teleporting polymorphed form', async () => {
    freshObjectRoom({
        hero: { umonnum: nameToMonster('tengu'), mtimedone: 100, mh: 20, mhmax: 20 },
        flags: { debug: true, tips: false, verbose: false },
    });
    requirePlayingGame(game);
    grantIntrinsicProperty('teleportation', 'outside');
    const input = resetInputState();
    input.feed('m\x14');
    input.display = {
        async readKey() {
            const screen = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            assert.match(screen, /Which way do you want to teleport\?/);
            return 't'.charCodeAt(0);
        },
    };

    await rhack(0);

    assert.equal(game._pending_message, "You don't know that spell.");
    assert.equal(game.context.move, 0);
    assert.equal(propertyIsActive('teleportation'), true);
});

void test('spell teleport mode casts on the hero and removes its temporarily learned spell', async () => {
    freshObjectRoom({
        role: 'wizard', hero: { ulevel: 30, uen: 50, uenmax: 50, acurr: { a: [18, 25, 18, 18, 18, 18] } },
        flags: { debug: true, tips: false, verbose: false },
    });
    requirePlayingGame(game);
    grantIntrinsicProperty('teleportation', 'outside');
    const skills = ensureHeroSkills(game);
    assert.ok(skills, 'The Wizard has initialized spell skills');
    const skill = skills[P_ESCAPE_SPELL];
    assert.ok(skill, 'The Wizard has an escape-spell skill entry');
    skill.skill = P_EXPERT;
    skill.maxSkill = P_EXPERT;
    const hunger = game.u.uhunger;
    const input = resetInputState();
    input.feed('m\x14');
    let choosingMode = true;
    input.display = {
        async readKey() {
            const screen = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            if (screen.includes('--More--')) return 32;
            if (choosingMode) {
                assert.match(screen, /Which way do you want to teleport\?/);
                choosingMode = false;
                return 's'.charCodeAt(0);
            }
            assert.match(screen, /Where do you want to be teleported/);
            input.feed('.');
            return 'l'.charCodeAt(0);
        },
    };

    await rhack(0);

    assert.equal(game.u.ux, 11);
    assert.equal(game.u.uen, 20);
    assert.equal(game.u.uhunger, hunger, 'A high-intelligence Wizard has no casting nutrition cost');
    assert.equal(game.context.move, 1);
    assert.equal(game.spells.length, 0);
    assert.equal(propertyIsActive('teleportation'), true);
});
