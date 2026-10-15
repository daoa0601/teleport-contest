import assert from 'node:assert/strict';
import test from 'node:test';

import { artifactByName, nameArtifact } from '../js/artifacts.js';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { queueCommandKeys, resetInputState } from '../js/input.js';
import { ARROW, ELVEN_DAGGER, LONG_SWORD, SPE_NOVEL } from '../js/object_data.js';
import { setPrimaryWeapon, setSecondaryWeapon, setTwoWeaponCombat } from '../js/weapon_slots.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { planInput } from './support/planned-input.js';

void test('an individual naming prompt pluralizes a stack before its existing inscription', async t => {
    freshObjectRoom();
    const arrows = await addInventoryObject(ARROW, {
        invlet: 'a', quan: 4, oextra: { oname: 'First Flight' },
    });
    const input = resetInputState();
    input.feed('name\r');
    queueCommandKeys('ia');
    planInput(input, t, [{
        prompt: /What do you want to name these arrows named First Flight\?/,
        keys: 'Fletching\r',
    }]);

    await rhack('#'.charCodeAt(0));

    assert.equal(arrows.oextra?.oname, 'Fletching');
    assert.equal(arrows.quan, 4);
    assert.equal(game.context.move, 0);
});

void test('naming a wielded elven dagger Sting creates its artifact and warning', async () => {
    freshObjectRoom();
    const dagger = await addInventoryObject(ELVEN_DAGGER, { invlet: 'a' });
    await setPrimaryWeapon(dagger);
    const input = resetInputState();
    input.feed('name\rs t-iNg\r');
    queueCommandKeys('ia');

    await rhack('#'.charCodeAt(0));

    assert.equal(dagger.oartifact, artifactByName('Sting')?.id);
    assert.equal(dagger.oextra?.oname, 'Sting');
    assert.equal(game.u.warnOfMonster, true);
    assert.equal(game.u.uconduct?.literate, 1);
    assert.equal(game.context.move, 0);
});

void test('naming the alternate weapon Orcrist ends two-weapon combat', async () => {
    freshObjectRoom();
    const artifact = artifactByName('Orcrist');
    assert.ok(artifact);
    const weapon = await addInventoryObject(artifact.baseType, { invlet: 'a' });
    await setSecondaryWeapon(weapon);
    setTwoWeaponCombat(true);
    game.u.uconduct = { literate: 1 };
    const input = resetInputState();
    input.feed('name\rorcrist\r');
    queueCommandKeys('ia');

    await rhack('#'.charCodeAt(0));

    assert.equal(weapon.oartifact, artifact.id);
    assert.equal(game.u.twoweap, false);
    assert.equal(game._pending_message, 'You can no longer wield two weapons at once.');
    assert.ok(game.gamelog?.some(event => event.text === 'chose an elven broadsword to be named "Orcrist"'));
});

void test('restricted artifact lettering slips instead of creating Excalibur', async t => {
    freshObjectRoom();
    const sword = await addInventoryObject(LONG_SWORD, { invlet: 'a' });
    const input = resetInputState();
    input.feed('name\rExcalibur\r');
    queueCommandKeys('ia');
    planInput(input, t, [{ prompt: /While engraving, your hand slips\.[\s\S]*--More--/, keys: ' ' }]);

    await rhack('#'.charCodeAt(0));

    assert.equal(sword.oartifact ?? 0, 0);
    assert.notEqual(sword.oextra?.oname, 'Excalibur');
    assert.ok(sword.oextra?.oname);
    assert.equal(game.u.uconduct?.literate, 1);
});

void test('an existing artifact resists a new individual name', async () => {
    freshObjectRoom();
    const sword = await addInventoryObject(LONG_SWORD, { invlet: 'a' });
    const artifact = artifactByName('Excalibur');
    assert.ok(artifact);
    nameArtifact(sword, artifact);
    const input = resetInputState();
    input.feed('name\rNew name\r');
    queueCommandKeys('ia');

    await rhack('#'.charCodeAt(0));

    assert.equal(sword.oextra?.oname, 'Excalibur');
});

void test('novels reject individual naming before asking for a name', async t => {
    freshObjectRoom();
    const novel = await addInventoryObject(SPE_NOVEL, { invlet: 'a' });
    const publishedTitle = novel.oextra?.oname;
    const input = resetInputState();
    input.feed('name\r');
    queueCommandKeys('ia');
    planInput(input, t, []);

    await rhack('#'.charCodeAt(0));

    assert.equal(novel.oextra?.oname, publishedTitle);
});

void test('empty naming input preserves a name and spaces remove it', async () => {
    freshObjectRoom();
    const dagger = await addInventoryObject(ELVEN_DAGGER, { invlet: 'a', oname: 'Keepsake' });
    const input = resetInputState();
    input.feed('name\r\r');
    queueCommandKeys('ia');
    await rhack('#'.charCodeAt(0));
    assert.equal(dagger.oextra?.oname ?? dagger.oname, 'Keepsake');

    input.feed('name\r   \r');
    queueCommandKeys('ia');
    await rhack('#'.charCodeAt(0));
    assert.equal(dagger.oextra?.oname ?? dagger.oname, undefined);
});
