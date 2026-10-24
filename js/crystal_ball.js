// C detect.c:use_crystal_ball(), furniture_detect(), level_distance().
import { formatSeenMessage } from './hero_speech.js';
import { A_INT, COLNO, IS_FURNITURE, M_AP_FURNITURE, M_AP_TYPE, ROWNO, TER_DETECT, TER_MAP, TER_MON, TER_OBJ, TER_TRP, } from './const.js';
import { currentAttribute } from './attrib.js';
import { artifactByName } from './artifacts.js';
import { heroResistsBlindingLight } from './blinding_attack.js';
import { nomul } from './command_state.js';
import { canSpotMonster, currentBoulderSymbol, displayColorName, flushPendingTopline, glyphAt, magic_map_background, map_invisible, plineWithContinuation as pline, } from './display.js';
import { game, requireGameLevel } from './gstate.js';
import { cmapToGlyph, CmapSymbol } from './glyph_numbers.js';
import { depth } from './hacklib.js';
import { loseHeroHp } from './hero_damage.js';
import { useUpInventoryStack } from './hero_inventory.js';
import { makeConfused, makeHallucinated } from './hero_mental_status.js';
import { heroPolyGender } from './hero_species.js';
import { detectMonsters, detectObjects } from './magic_detection.js';
import { browseDetectionMap, redisplayDetectionMap, unconstrainMap } from './magic_map_display.js';
import { MAP_SYMBOLS } from './map_symbols.js';
import { MONSTER_CLASS_SYMBOLS } from './mondata.js';
import { revealMonsterAppearance } from './monster_appearance.js';
import { definiteName, objectCombatName } from './objnam.js';
import { verbForSubject } from './object_grammar.js';
import { learnObjectType, OBJECT_CLASS_SYMBOLS } from './object_knowledge.js';
import { consumeObjectCharge } from './object_charge.js';
import { CRYSTAL_BALL } from './object_data.js';
import { rn2, rnd } from './rng.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { makeBlinded } from './sight_change.js';
import { detectTraps } from './trap_detection.js';
import { promptKey } from './tty_prompts.js';
const ROCK_CLASS = 14;
export async function useCrystalBall(object) {
    if (heroIsBlind()) {
        await pline(`Too bad you can't see ${definiteName(objectCombatName(object))}.`);
        return object;
    }
    const charged = object.spe > 0;
    const intelligence = currentAttribute(A_INT);
    const questArtifact = !!object.oartifact
        && object.oartifact === artifactByName(game.urole?.artifactName)?.id;
    const difficulty = questArtifact ? 8 : object.blessed ? 16 : 20;
    if (charged && (object.cursed || rnd(difficulty) > intelligence))
        return crystalBallMishap(object, intelligence);
    if (heroIsHallucinating()) {
        delayGazing(rnd(charged ? 4 : 2), 'gazing into a Magic 8-Ball (tm)');
        if (!charged) {
            await pline(`All you see is funky ${displayColorName(null)} haze.`);
            return implodeCancelledBall(object);
        }
        await hallucinatedVision();
        await consumeObjectCharge(object);
        return object;
    }
    if (game.flags.verbose)
        await pline('You may look for an object, monster, or special map symbol.');
    await flushPendingTopline();
    let symbol = String.fromCharCode(await promptKey('What do you look for? '));
    // C's quitchars matches NUL too; space remains a ghost-class search.
    if ('\0\r\n\x1b'.includes(symbol)) {
        if (game.flags.verbose)
            await pline('Never mind.');
        return object;
    }
    await pline(`You peer into ${definiteName(objectCombatName(object))}...`);
    delayGazing(rnd(charged ? 10 : 2), 'gazing into a crystal ball');
    if (!charged) {
        await pline('The vision is unclear.');
        return implodeCancelledBall(object);
    }
    learnObjectType(CRYSTAL_BALL);
    await consumeObjectCharge(object);
    if (symbol === ']')
        symbol = 'm';
    const furniture = MAP_SYMBOLS.slice(CmapSymbol.upstair, CmapSymbol.fountain + 1)
        .some(feature => feature.ch === symbol);
    const objectClass = OBJECT_CLASS_SYMBOLS.indexOf(symbol);
    const monsterClass = MONSTER_CLASS_SYMBOLS.indexOf(symbol);
    let missing = false;
    if (furniture)
        await detectFurniture();
    else if (objectClass > 0)
        missing = (await detectObjects(null, { objectClass })).result !== 0;
    else if (monsterClass > 0)
        missing = (await detectMonsters(null, { monsterClass })).result !== 0;
    // detect.c also matches the search character against
    // showsyms[SYM_BOULDER + SYM_OFF_X], sending it to rock-class detection.
    else if (symbol === currentBoulderSymbol())
        missing = (await detectObjects(null, { objectClass: ROCK_CLASS })).result !== 0;
    else if (symbol === '^')
        missing = (await detectTraps(null)).result !== 0;
    else
        await distantVision();
    if (missing)
        await pline(rn2(100) === 0
            ? formatSeenMessage('the Wizard of Yendor gazing out at you.') : 'The vision is unclear.');
    return object;
}
async function crystalBallMishap(object, intelligence) {
    const impairment = rnd(100 - 3 * intelligence);
    switch (rnd(object.oartifact || object.blessed ? 4 : 5)) {
        case 1:
            await pline(`${ballSubject(object, 'are')} too much to comprehend!`);
            break;
        case 2:
            await pline(`${ballSubject(object, 'confuse')} you!`);
            await makeConfused((game.u.confusionTurns ?? 0) + impairment, { talk: false });
            break;
        case 3:
            if (heroResistsBlindingLight()) {
                await pline(`${ballSubject(object, 'assault')} your vision.`);
                await pline('You are unaffected!');
            }
            else {
                await pline(`${ballSubject(object, 'damage')} your vision!`);
                await makeBlinded((game.u.blindTurns ?? 0) + impairment, { talk: false });
                if (!heroIsBlind())
                    await pline('Your vision quickly clears.');
            }
            break;
        case 4:
            await pline(`${ballSubject(object, 'zap')} your mind!`);
            await makeHallucinated((game.u.hallucinationTurns ?? 0) + impairment, { talk: false });
            break;
        case 5: {
            await pline(`${ballSubject(object, 'explode')}!`);
            await useUpInventoryStack(object);
            const damage = rnd(30);
            await loseHeroHp(game.u.halfPhysicalDamage ? Math.ceil(damage / 2) : damage, 'exploding crystal ball');
            return null;
        }
    }
    await consumeObjectCharge(object);
    return object;
}
function ballSubject(object, verb) {
    const name = definiteName(objectCombatName(object));
    return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${verbForSubject(name, verb)}`;
}
function delayGazing(turns, reason) {
    nomul(-turns);
    game._helplessReason = reason;
    game._helplessDoneMessage = '';
}
async function implodeCancelledBall(object) {
    if (object.spe >= 0)
        return object;
    await pline(`${ballSubject(object, 'implode')}!`);
    await useUpInventoryStack(object);
    return null;
}
async function hallucinatedVision() {
    switch (rnd(6)) {
        case 1:
            await pline('You grok some groovy globs of incandescent lava.');
            break;
        case 2:
            await pline(`Whoa!  Psychedelic colors, ${heroPolyGender() === 1 ? 'babe' : 'dude'}!`);
            break;
        case 3:
            await pline(`The crystal pulses with sinister ${displayColorName(null)} light!`);
            break;
        case 4:
            await pline(formatSeenMessage('goldfish swimming above fluorescent rocks.'));
            break;
        case 5:
            await pline(formatSeenMessage('tiny snowflakes spinning around a miniature farmhouse.'));
            break;
        default:
            await pline('Oh wow... like a kaleidoscope!');
            break;
    }
}
async function distantVision() {
    const destinations = [
        { name: 'Delphi', level: game.oracle_level },
        { name: "Medusa's lair", level: game.medusa_level },
        { name: 'a castle', level: game.stronghold_level },
        { name: "the Wizard of Yendor's tower", level: game.specialLevels?.get('wizard1') },
    ];
    const destination = destinations[rn2(destinations.length)];
    if (!destination)
        throw new Error('Crystal-ball destination is outside its level list');
    if (!destination.level)
        throw new Error(`Crystal-ball destination ${destination.name} is not initialized`);
    await pline(formatSeenMessage(`${destination.name}, ${levelDistance(destination.level)}.`));
}
function levelDistance(destination) {
    const here = game.u.uz;
    if (!here)
        throw new Error('Crystal-ball vision requires the hero dungeon position');
    const difference = depth(here) - depth(destination);
    const sameDungeon = here.dnum === destination.dnum;
    if (difference < 0) {
        if (difference < -8 - rn2(3))
            return sameDungeon ? 'far below' : 'far away';
        if (difference < -1)
            return sameDungeon ? 'below you' : 'away below you';
        return sameDungeon ? 'just below' : 'in the distance';
    }
    if (difference > 0) {
        if (difference > 8 + rn2(3))
            return sameDungeon ? 'far above' : 'far away';
        if (difference > 1)
            return sameDungeon ? 'above you' : 'away above you';
        return sameDungeon ? 'just above' : 'in the distance';
    }
    return sameDungeon ? 'near you' : 'in the distance';
}
async function detectFurniture() {
    const level = requireGameLevel();
    const constraints = unconstrainMap();
    let found = 0, revealed = 0;
    try {
        for (let y = 0; y < ROWNO; y++) {
            for (let x = 1; x < COLNO; x++) {
                const previous = glyphAt(x, y)?.glyph;
                if (IS_FURNITURE(level.requireAt(x, y).typ)) {
                    found++;
                    magic_map_background(x, y, true);
                }
                else if (previous !== undefined && previous >= cmapToGlyph(CmapSymbol.upstair)
                    && previous < cmapToGlyph(CmapSymbol.pool)) {
                    found++;
                    const monster = level.monsters.find(monster => !monster.dead && monster.mx === x && monster.my === y);
                    if (monster && M_AP_TYPE(monster) === M_AP_FURNITURE)
                        revealMonsterAppearance(monster);
                    if (!monster || !canSpotMonster(monster))
                        map_invisible(x, y);
                }
                if (glyphAt(x, y)?.glyph !== previous)
                    revealed++;
            }
        }
        if (!found)
            await pline('There seems to be nothing of interest on this level.');
        else if (!revealed)
            await pline('Your map already shows all relevant locations.');
        if (!revealed)
            await flushPendingTopline();
        else
            await browseDetectionMap(TER_DETECT | TER_MAP | TER_TRP | TER_OBJ | TER_MON, 'location');
    }
    finally {
        await redisplayDetectionMap(constraints);
    }
}
//# sourceMappingURL=crystal_ball.js.map