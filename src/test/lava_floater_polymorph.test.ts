import assert from 'node:assert/strict';
import test from 'node:test';
import { applyHeroLocationEffects } from '../js/hack.js';
import { LAVAPOOL, TT_LAVA } from '../js/const.js';
import { displayLiquidName } from '../js/do_name.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { polymonHero } from '../js/polyself.js';
import { freshObjectRoom } from './support/object-room.js';

// C polymon() calls spoteffects() for a non-levitating hero in lava.  With
// the terrainstatus option off iflags.terrain_typ stays MAX_TYPE, so
// switch_terrain() runs and float_up() reports the stuck lower body.
void test('a hero stuck in lava who becomes a floater strains upward but stays stuck', async () => {
    const level = await freshObjectRoom();
    requirePlayingGame(game);
    level.requireAt(game.u.ux, game.u.uy).typ = LAVAPOOL;
    game.u.fireResistance = true;
    game.u.utrap = 1 << 8;
    game.u.utraptype = TT_LAVA;
    const messages: string[] = [];
    const input = resetInputState();
    input.beforeRead = () => {
        messages.push(game._pending_message || game._last_message || '');
        input.feed(' ');
    };
    // An earlier spot effect on this square, as when the hero sank there.
    await applyHeroLocationEffects();
    messages.length = 0;

    await polymonHero(MONSTER_NAME.indexOf('floating eye'));

    messages.push(game._pending_message || game._last_message || '');
    assert.ok(messages.some(message => /Your body pulls upward, but your .+ are still stuck\./.test(message)),
        messages.join(' | '));
    assert.equal(game.u.utraptype, TT_LAVA);
});

for (const { hallucinating, seed } of [
    { hallucinating: false, seed: 1n },
    { hallucinating: true, seed: 1n },
    { hallucinating: true, seed: 18n },
]) {
    void test(`becoming a salamander describes the released lava trap (hallucinating=${hallucinating}, seed=${seed})`, async () => {
        const room = {
            gameplaySeed: seed,
            hero: { hallucinationTurns: hallucinating ? 20 : 0 },
            flags: { verbose: false },
        };
        const salamander = MONSTER_NAME.indexOf('salamander');
        const freeLevel = await freshObjectRoom(room);
        freeLevel.requireAt(10, 10).typ = LAVAPOOL;
        resetInputState().feed(' '.repeat(10));
        await polymonHero(salamander);
        // The trapped form change adds a liquid description to the same
        // display choices made by a free form change. Lava remains a choice.
        const liquid = displayLiquidName('lava');
        const nextLiquid = displayLiquidName('lava');

        const level = await freshObjectRoom(room);
        level.requireAt(10, 10).typ = LAVAPOOL;
        game.u.utrap = 1 << 8;
        game.u.utraptype = TT_LAVA;
        const messages: string[] = [];
        const input = resetInputState();
        input.beforeRead = () => {
            messages.push(game._pending_message);
            input.feed(' ');
        };

        await polymonHero(salamander);

        messages.push(game._pending_message);
        const soothing = messages.join(' | ').match(/The (.+?) now feels soothing\./);
        assert.ok(soothing, messages.join(' | '));
        assert.equal(soothing[1], liquid);
        assert.equal(displayLiquidName('lava'), nextLiquid);
        assert.equal(game.u.utrap, 0);
    });
}
