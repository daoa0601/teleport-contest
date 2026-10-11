import test from 'node:test';
import assert from 'node:assert/strict';

import {
    artifactByName,
    artifactDamageBonus,
    artifactDoublesWeaponDamage,
    artifactToHitBonus,
    initializeArtifacts,
    nameArtifact,
} from '../js/artifacts.js';
import { touchArtifactByHero } from '../js/artifact_touch.js';
import { NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { monsterCanCarryObject } from '../js/monster_carry.js';
import { mksobj } from '../js/mklev.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPolymorphedHero } from './support/hero-state.js';

async function makeMitre() {
    const artifact = artifactByName('The Mitre of Holiness');
    assert.ok(artifact);
    const mitre = await mksobj(artifact.baseType, false, false);
    nameArtifact(mitre, artifact);
    return mitre;
}

void test('the noncombat Mitre repels an undead covetous carrier', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    initializeArtifacts();
    const lich = await createMonsterAt('master lich', 12, 10, NO_MINVENT);
    const adventurer = await createMonsterAt('archeologist', 14, 10, NO_MINVENT);
    const mitre = await makeMitre();
    const ordinary = await mksobj(mitre.otyp, false, false);

    assert.equal(monsterCanCarryObject(lich, ordinary), true);
    assert.equal(monsterCanCarryObject(adventurer, mitre), true);
    assert.equal(monsterCanCarryObject(lich, mitre), false);
    assert.equal(artifactToHitBonus(mitre, lich), 0, 'a bane does not invent an attack bonus');
    assert.equal(artifactDamageBonus(mitre, lich, 7), 0);
    assert.equal(artifactDoublesWeaponDamage(mitre, lich), false);
});

for (const undead of [false, true]) {
    void test(`a coaligned priest touching the Mitre ${undead ? 'as an undead form is blasted' : 'is unharmed'}`, async () => {
        freshObjectRoom({ role: 'priest' });
        requirePlayingGame(game);
        initializeArtifacts();
        const mitre = await makeMitre();
        const artifact = artifactByName('The Mitre of Holiness');
        assert.ok(artifact);
        const alignment = artifact.alignment;
        assert.ok(alignment === -1 || alignment === 0 || alignment === 1);
        game.u.ualign.type = alignment;
        if (undead) installPolymorphedHero('vampire', { hitPoints: 100 });
        const hitPoints = undead ? game.u.mh : game.u.uhp;
        pushKeys(' '.repeat(30));

        const result = await touchArtifactByHero(mitre);

        assert.equal(result.allowed, true);
        assert.equal(result.died, false);
        assert.equal(result.blasted, undead);
        if (undead) assert.ok(game.u.mh < hitPoints);
        else assert.equal(game.u.uhp, hitPoints);
    });
}
