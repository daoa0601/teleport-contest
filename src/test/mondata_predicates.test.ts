import assert from 'node:assert/strict';
import test from 'node:test';
import { LONG_SWORD } from '../js/object_data.js';
import { artifactByName, nameArtifact } from '../js/artifacts.js';
import { canTrack } from '../js/mondata.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import {
    MONSTER_NAME,
    monsterCanTeleport,
    monsterControlsTeleport,
    monsterHasEyes,
    monsterHasProperName,
    monsterHasRangedAttack,
    monsterHidesUnder,
    monsterIsAmphibious,
    monsterIsBig,
    monsterIsBreathless,
    monsterIsClinger,
    monsterIsDemon,
    monsterIsFemale,
    monsterIsFloater,
    monsterIsFlyer,
    monsterIsGiant,
    monsterIsGolem,
    monsterIsHider,
    monsterIsSilent,
    monsterIsSwimmer,
    monsterIsVerySmall,
    monsterPassesWalls,
    monsterPerceives,
    monsterThrowsRocks,
} from '../js/monster_data.js';
import { freshObjectRoom } from './support/object-room.js';
import { addInventoryObject } from './support/game-objects.js';

const pm = (name: string) => {
    const index = MONSTER_NAME.indexOf(name);
    assert.ok(index >= 0, `pinned data has no species ${name}`);
    return index;
};

// C include/mondata.h — each row pins one macro's pinned-data value for a
// species whose mons[] flags, size or class are not in dispute.
const rows: readonly (readonly [string, (mnum: number) => boolean, string, boolean])[] = [
    ['bigmonst', monsterIsBig, 'ogre', true],          // msize MZ_LARGE
    ['bigmonst', monsterIsBig, 'purple worm', true],   // msize MZ_GIGANTIC
    ['bigmonst', monsterIsBig, 'kobold', false],       // msize MZ_SMALL
    ['bigmonst', monsterIsBig, 'giant ant', false],    // msize MZ_TINY
    ['verysmall', monsterIsVerySmall, 'giant ant', true],
    ['verysmall', monsterIsVerySmall, 'kobold', false], // MZ_SMALL is not verysmall
    ['is_flyer', monsterIsFlyer, 'vampire bat', true],  // M1_FLY
    ['is_flyer', monsterIsFlyer, 'jackal', false],
    ['is_floater', monsterIsFloater, 'floating eye', true],  // S_EYE
    ['is_floater', monsterIsFloater, 'vampire bat', false],
    ['is_clinger', monsterIsClinger, 'rock piercer', true],  // M1_CLING
    ['is_clinger', monsterIsClinger, 'jackal', false],
    ['is_swimmer', monsterIsSwimmer, 'water elemental', true], // M1_SWIM
    ['is_swimmer', monsterIsSwimmer, 'jackal', false],
    ['breathless', monsterIsBreathless, 'gas spore', true], // M1_BREATHLESS
    ['breathless', monsterIsBreathless, 'jackal', false],
    ['amphibious', monsterIsAmphibious, 'water elemental', true], // M1_AMPHIBIOUS
    ['amphibious', monsterIsAmphibious, 'jackal', false],
    ['passes_walls', monsterPassesWalls, 'xorn', true],   // M1_WALLWALK
    ['passes_walls', monsterPassesWalls, 'jackal', false],
    ['haseyes', monsterHasEyes, 'gray unicorn', true],
    ['haseyes', monsterHasEyes, 'blue jelly', false],     // M1_NOEYES
    ['hides_under', monsterHidesUnder, 'cave spider', true], // M1_CONCEAL
    ['hides_under', monsterHidesUnder, 'jackal', false],
    ['is_hider', monsterIsHider, 'small mimic', true],    // M1_HIDE
    ['is_hider', monsterIsHider, 'jackal', false],
    ['perceives', monsterPerceives, 'mind flayer', true], // M1_SEE_INVIS
    ['perceives', monsterPerceives, 'jackal', false],
    ['can_teleport', monsterCanTeleport, 'tengu', true],  // M1_TPORT
    ['can_teleport', monsterCanTeleport, 'jackal', false],
    ['control_teleport', monsterControlsTeleport, 'tengu', true], // M1_TPORT_CNTRL
    ['control_teleport', monsterControlsTeleport, 'jackal', false],
    ['is_demon', monsterIsDemon, 'horned devil', true],  // M2_DEMON
    ['is_demon', monsterIsDemon, 'tengu', false],
    ['is_golem', monsterIsGolem, 'stone golem', true],   // S_GOLEM
    ['is_golem', monsterIsGolem, 'jackal', false],
    ['is_silent', monsterIsSilent, 'gas spore', true],   // MS_SILENT
    ['is_silent', monsterIsSilent, 'jackal', false],     // MS_BARK
    ['type_is_pname', monsterHasProperName, 'Croesus', true], // M2_PNAME
    ['type_is_pname', monsterHasProperName, 'ogre', false],
    ['throws_rocks', monsterThrowsRocks, 'stone giant', true], // M2_ROCKTHROW
    ['throws_rocks', monsterThrowsRocks, 'minotaur', false],
    ['is_giant', monsterIsGiant, 'stone giant', true],   // M2_GIANT
    ['is_giant', monsterIsGiant, 'ogre', false],
    ['is_female', monsterIsFemale, 'wood nymph', true],  // M2_FEMALE
    ['is_female', monsterIsFemale, 'jackal', false],
    // C mondata.c:ranged_attk() — monattk.h DISTANCE_ATTK_TYPE covers
    // AT_SPIT/AT_BREA/AT_MAGC/AT_GAZE; a pure weapon attack is not ranged.
    ['ranged_attk', monsterHasRangedAttack, 'winter wolf', true],   // AT_BREA
    ['ranged_attk', monsterHasRangedAttack, 'hobbit', false],       // AT_WEAP only
];

for (const [macro, predicate, species, expected] of rows) {
    void test(`mondata.h ${macro}(${species}) is ${expected}`, () => {
        assert.equal(predicate(pm(species)), expected);
    });
}

// C mondata.c:can_track(): u_wield_art(ART_EXCALIBUR) returns TRUE before
// haseyes() is consulted, so an eyeless tracker still follows the hero's
// tracks while Excalibur is wielded (monmove.c doit() then reads gettrack()).
void test('can_track: Excalibur lets an eyeless species track', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    const blueJelly = pm('blue jelly');
    const jackal = pm('jackal');
    assert.equal(monsterHasEyes(blueJelly), false);

    assert.equal(canTrack(blueJelly, game), false, 'eyeless, no Excalibur');
    assert.equal(canTrack(jackal, game), true, 'eyed species track regardless');

    const sword = await addInventoryObject(LONG_SWORD);
    nameArtifact(sword, artifactByName('Excalibur'));
    game.uwep = game.u.uwep = sword;

    assert.equal(canTrack(blueJelly, game), true, 'Excalibur first, then haseyes');
});
