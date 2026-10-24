import test from 'node:test';
import assert from 'node:assert/strict';
import { DOOR, D_LOCKED, D_NODOOR, SDOOR, STONE } from '../js/const.js';
import { flush_screen } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { putHeroToSleep } from '../js/hero_sleep.js';
import { WAN_PROBING } from '../js/object_data.js';
import { setPropertyTimeout } from '../js/properties.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { cansee, vision_note_blocker_change, vision_recalc } from '../js/vision.js';
import { zapMapAt } from '../js/wand_terrain_magic.js';
import { applyRayFloorFeatures } from '../js/zap.js';
import { knownObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createSpecialLevel } from './support/topology.js';
function secretDoor({ rogue = true, blind = true } = {}) {
    const level = freshPlayableRoom({ heroX: 11, flags: { verbose: false, acoustics: false } });
    requirePlayingGame(game);
    if (rogue)
        game.rogue_level = createSpecialLevel({ ...game.u.uz });
    setHeroBlindnessTurns(blind ? 10 : 0);
    const door = level.requireAt(12, 10);
    door.typ = SDOOR;
    door.doormask = D_LOCKED;
    vision_note_blocker_change(12, 10);
    vision_recalc(0);
    assert.equal(cansee(12, 10), !blind);
    return door;
}
for (const caller of [
    { name: 'a ray', reveal: async () => { await applyRayFloorFeatures('magic', 12, 10); } },
    { name: 'probing', reveal: async () => { await zapMapAt(12, 10, await knownObject(WAN_PROBING)); } },
]) {
    void test(`${caller.name} revealing an unseen Rogue door gives a draft without verbose messages`, async () => {
        const door = secretDoor();
        door.arboreal_sdoor = 1;
        door.candig = true;
        await caller.reveal();
        await flush_screen(1);
        assert.equal(door.typ, DOOR);
        assert.equal(door.doormask, D_NODOOR);
        assert.equal(door.arboreal_sdoor, 0);
        assert.equal(door.candig, false);
        assert.equal(game._pending_message, 'You feel a draft.');
    });
    void test(`${caller.name} gives a chaotic hallucinating hero a military draft reaction`, async () => {
        secretDoor();
        requirePlayingGame(game);
        game.u.hallucinationTurns = 10;
        game.u.ualign.type = -1;
        game.u.ualign.record = 4;
        await caller.reveal();
        await flush_screen(1);
        assert.match(game._pending_message ?? '', /^You feel like (protesting|fleeing)\.$/);
    });
    void test(`${caller.name} lets a sleeping hero dream about an unseen Rogue doorway draft`, async () => {
        secretDoor();
        await putHeroToSleep(3);
        await caller.reveal();
        await flush_screen(1);
        assert.equal(game._pending_message, 'You dream that you feel a draft.');
    });
    for (const condition of ['deaf', 'levitating', 'underwater']) {
        void test(`${caller.name} still gives the unseen Rogue doorway draft when the hero is ${condition}`, async () => {
            secretDoor();
            if (condition === 'deaf')
                setPropertyTimeout('deaf', 10);
            else if (condition === 'levitating')
                setPropertyTimeout('levitation', 10);
            else
                game.u.uinwater = true;
            await caller.reveal();
            await flush_screen(1);
            assert.equal(game._pending_message, 'You feel a draft.');
        });
    }
    void test(`${caller.name} gives a draft even when stone separates the hero from the Rogue doorway`, async () => {
        secretDoor({ blind: false });
        requirePlayingGame(game);
        game.u.ux = 10;
        for (let y = 8; y <= 12; y++) {
            game.level.requireAt(11, y).typ = STONE;
            vision_note_blocker_change(11, y);
        }
        vision_recalc(0);
        assert.equal(cansee(12, 10), false);
        await caller.reveal();
        await flush_screen(1);
        assert.equal(game._pending_message, 'You feel a draft.');
    });
    void test(`${caller.name} announces a visible Rogue door instead of a draft`, async () => {
        secretDoor({ blind: false });
        await caller.reveal();
        await flush_screen(1);
        assert.match(game._pending_message ?? '', /reveals a secret door\.$/);
    });
    void test(`${caller.name} revealing an unseen ordinary-level door gives no draft`, async () => {
        const door = secretDoor({ rogue: false });
        await caller.reveal();
        await flush_screen(1);
        assert.equal(door.typ, DOOR);
        assert.equal(door.doormask, D_LOCKED);
        assert.doesNotMatch(game._pending_message ?? '', /draft|feel like/);
    });
}
//# sourceMappingURL=draft_message.test.js.map