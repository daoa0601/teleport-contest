import { ensureQuestStatus } from '../js/quest.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { finishHeroThrownBlindness, prepareHeroThrownBlindness } from '../js/blinding_attack.js';
import { heroEyeCount } from '../js/body_parts.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pline } from '../js/display.js';
import { fixPrayerTrouble, Trouble } from '../js/prayer_trouble.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { BLINDING_VENOM, CREAM_PIE } from '../js/object_data.js';
import { polymonHero } from '../js/polyself.js';
import { heroIsBlind, setHeroBlindnessTurns } from '../js/senses.js';
import { addInventoryItem } from '../js/u_init.js';
import { cansee } from '../js/vision.js';
import { artifactObject } from './support/game-objects.js';
import { applyInventoryObject } from './support/commands.js';
import { freshObjectRoom } from './support/object-room.js';
void test('thrown venom leaves sight available until its pending blindness is applied', async () => {
    freshObjectRoom();
    assert.equal(cansee(11, 10), true);
    const effect = prepareHeroThrownBlindness(BLINDING_VENOM, game, () => 12);
    assert.ok(effect);
    assert.equal(effect.message, 'The venom blinds you.');
    assert.equal(heroIsBlind(), false);
    assert.equal(game.u.ucreamed ?? 0, 0);
    assert.equal(cansee(11, 10), true);
    await finishHeroThrownBlindness(effect);
    assert.equal(game.u.ucreamed, 12);
    assert.equal(game.u.blindTurns, 12);
    assert.equal(heroIsBlind(), true);
    assert.equal(cansee(11, 10), false);
});
void test('the Eyes of the Overworld keep sight after a cream pie covers the hero', async () => {
    freshObjectRoom({ role: 'monk' });
    ensureQuestStatus().touched_artifact = true;
    const eyes = await addInventoryItem(await artifactObject('The Eyes of the Overworld'));
    await applyInventoryObject(eyes);
    const effect = prepareHeroThrownBlindness(CREAM_PIE, game, () => 8);
    assert.ok(effect);
    const messages = [];
    await finishHeroThrownBlindness(effect, game, message => { messages.push(message); });
    assert.equal(game.u.ucreamed, 8);
    assert.equal(game.u.blindTurns, 8);
    assert.equal(heroIsBlind(), false);
    assert.equal(cansee(11, 10), true);
    assert.deepEqual(messages, ['Your vision quickly clears.']);
});
for (const [species, message] of [
    [null, 'Your eyes sting.'],
    ['floating eye', 'Your cornea stings.'],
    ['Cyclops', 'Your eye stings.'],
]) {
    void test(`venom in already-blind ${species || 'human'} eyes uses the current anatomy`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const input = resetInputState();
        input.beforeRead = () => input.feed(' ');
        if (species)
            await polymonHero(MONSTER_NAME.indexOf(species));
        setHeroBlindnessTurns(5);
        const result = prepareHeroThrownBlindness(BLINDING_VENOM);
        assert.ok(result);
        await finishHeroThrownBlindness(result);
        assert.equal(result.message, message);
        assert.ok((game.u.blindTurns ?? 0) > 5);
    });
}
void test('a pie covers the body of an already-blind floating eye', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');
    await polymonHero(MONSTER_NAME.indexOf('floating eye'));
    setHeroBlindnessTurns(5);
    const result = prepareHeroThrownBlindness(CREAM_PIE);
    assert.ok(result);
    await finishHeroThrownBlindness(result);
    assert.equal(result.message, "There's something sticky all over your body.");
    assert.ok((game.u.ucreamed ?? 0) > 0);
});
void test('eye count follows the body rather than its current blindness', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');
    assert.equal(heroEyeCount(), 2);
    setHeroBlindnessTurns(5);
    assert.equal(heroEyeCount(), 2);
    await polymonHero(MONSTER_NAME.indexOf('floating eye'));
    assert.equal(heroEyeCount(), 1);
    await polymonHero(MONSTER_NAME.indexOf('yellow light'));
    assert.equal(heroEyeCount(), 0);
    assert.equal(prepareHeroThrownBlindness(CREAM_PIE), null);
    assert.equal(prepareHeroThrownBlindness(BLINDING_VENOM), null);
});
for (const [species, message] of [
    [null, 'Your eyes feel better.'],
    ['floating eye', 'Your cornea feels better.'],
]) {
    void test(`prayer heals blind ${species || 'human'} eyes with matching anatomy`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const input = resetInputState();
        input.beforeRead = () => input.feed(' ');
        if (species)
            await polymonHero(MONSTER_NAME.indexOf(species));
        setHeroBlindnessTurns(5);
        await pline('');
        await fixPrayerTrouble(Trouble.BLIND);
        assert.equal(game._pending_message, message);
        assert.equal(game.u.blindTurns, 0);
    });
}
//# sourceMappingURL=blinding_anatomy.test.js.map