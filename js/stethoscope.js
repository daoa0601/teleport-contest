// C apply.c:use_stethoscope() and its_dead().
import { heroHandName } from './body_parts.js';
import { CORR, Is_stronghold, M_AP_FURNITURE, M_AP_MONSTER, M_AP_OBJECT, M_AP_TYPE, SCORR, SDOOR, STATUE_TRAP, isok } from './const.js';
import { convertSecretDoor } from './detect.js';
import { canSpotMonster, feel_newsym, map_invisible, map_object, newsym, plineWithContinuation as pline, unmap_invisible } from './display.js';
import { heroCanReachFloor } from './floor_reach.js';
import { game, requirePlayingGame } from './gstate.js';
import { heroStatusLine } from './hero_status.js';
import { MAP_SYMBOLS } from './map_symbols.js';
import { revealMonsterAppearance } from './monster_appearance.js';
import { MONSTER_FLAGS2, MONSTER_GENO, MONSTER_SIZE, monsterIsHumanoid, monsterIsWhirly, monsterTypeName } from './monster_data.js';
import { monsterAtPosition } from './monster_location.js';
import { monsterName } from './monster_name.js';
import { monsterStatusLine } from './monster_status.js';
import { CORPSE, LENSES, SLIME_MOLD, STATUE } from './object_data.js';
import { OBJECT_TIMER_KIND, objectTimers } from './object_timers.js';
import { minimalObjectName, simpleObjectTypeName } from './objnam.js';
import { heroHasNoHands } from './polyself.js';
import { rn2 } from './rng.js';
import { heroIsBlind, heroIsDeaf, heroIsHallucinating } from './senses.js';
import { ceilingName, surfaceName } from './terrain_name.js';
import { confusePromptDirection, promptDirection } from './tty_prompts.js';
import { vision_note_blocker_change } from './vision.js';
import { heroHasFreeHand } from './weapon_type.js';
export async function useStethoscope(object) {
    requirePlayingGame(game);
    const hero = game.u;
    const holder = hero.ustuck;
    const interference = !!(hero.uswallow && holder && monsterIsWhirly(holder)
        && !rn2(game.urole.key === 'healer' ? 10 : 3));
    if (heroHasNoHands(game)) {
        await pline('You have no hands!');
        return false;
    }
    if (heroIsDeaf(game)) {
        await pline("You can't hear anything!");
        return false;
    }
    if (!heroHasFreeHand(game)) {
        await pline(`You have no free ${heroHandName(game)}.`);
        return false;
    }
    const direction = await promptDirection();
    if (!direction)
        return false;
    const sequence = game._heroActionSeq ?? 0;
    let spentTime = sequence === game._stethoscopeSeq;
    game._stethoscopeSeq = sequence;
    game.bhitpos = { x: hero.ux, y: hero.uy };
    game.notonhead = !!hero.uswallow;
    if (hero.usteed && direction.dz > 0) {
        if (interference && holder) {
            await pline(`${monsterName(holder, { capitalized: true })} interferes.`);
            await pline(await monsterStatusLine(holder));
        }
        else
            await pline(await monsterStatusLine(hero.usteed));
        return spentTime;
    }
    if (hero.uswallow && holder && (direction.dx || direction.dy || direction.dz || interference)) {
        if (!direction.dx && !direction.dy && !direction.dz)
            await pline(`${monsterName(holder, { capitalized: true })} interferes.`);
        await pline(await monsterStatusLine(holder));
        return spentTime;
    }
    if (direction.dz) {
        if (hero.uinwater || game.underwater)
            await pline('You hear faint splashing.');
        else if (direction.dz < 0 || !heroCanReachFloor(game, { checkPit: true })) {
            const destination = direction.dz < 0 ? ceilingName(hero.ux, hero.uy)
                : heroCanReachFloor(game) ? 'bottom of the pit' : surfaceName(hero.ux, hero.uy);
            await pline(`You can't reach the ${destination}.`);
        }
        else {
            const corpse = await diagnoseFloorObjects(hero.ux, hero.uy);
            if (corpse.found)
                spentTime ||= corpse.spentTime;
            else if (Is_stronghold(hero.uz))
                await pline('You hear the crackling of hellfire.');
            else
                await pline(`The ${surfaceName(hero.ux, hero.uy)} seems healthy enough.`);
        }
        return spentTime;
    }
    if (object.cursed && !rn2(2)) {
        await pline('You hear your heart beat.');
        return spentTime;
    }
    // Native does a second confdir() after its cursed-heartbeat branch.
    confusePromptDirection(hero);
    if (!hero.dx && !hero.dy) {
        await pline(heroStatusLine(game));
        return spentTime;
    }
    const x = hero.ux + (hero.dx ?? 0), y = hero.uy + (hero.dy ?? 0);
    if (!isok(x, y)) {
        await pline('You hear a faint typing noise.');
        return false;
    }
    const monster = monsterAtPosition(game.level, x, y);
    if (monster) {
        game.bhitpos = { x, y };
        game.notonhead = monster.mx !== x || monster.my !== y;
        await diagnoseMonster(monster, x, y);
        return spentTime;
    }
    if (unmap_invisible(x, y))
        await pline('The invisible monster must have moved.');
    const location = game.level.requireAt(x, y);
    if (location.typ === SDOOR || location.typ === SCORR) {
        const door = location.typ === SDOOR;
        await pline(`You hear a hollow sound.  This must be a secret ${door ? 'door' : 'passage'}!`);
        if (door)
            convertSecretDoor(location);
        else {
            location.typ = CORR;
            location.flags = 0;
            location.doormask = 0;
        }
        vision_note_blocker_change(x, y);
        feel_newsym(x, y);
        return spentTime;
    }
    const floor = await diagnoseFloorObjects(x, y);
    if (!floor.found)
        await pline('You hear nothing special.');
    return spentTime || floor.spentTime;
}
async function diagnoseMonster(monster, x, y) {
    // C formats this even when only the later status line is printed.
    // During hallucination each formatting selects a new perceived identity.
    const name = monsterName(monster, { article: 'a', suppressIt: true, suppressInvisible: true });
    if (monster.mundetected) {
        if (!canSpotMonster(monster))
            await pline(`There is ${name} hidden there.`);
        monster.mundetected = 0;
        newsym(monster.mx, monster.my);
    }
    else if (monster.mappearance) {
        const type = M_AP_TYPE(monster), appearance = monster.mappearance;
        let what = 'thing', plural = false;
        if (type === M_AP_OBJECT) {
            const fruit = monster.mcorpsenm ?? monster.mextra?.mcorpsenm;
            what = appearance === SLIME_MOLD && fruit !== undefined
                ? minimalObjectName({ otyp: appearance, oclass: 7, dknown: true, spe: fruit }, game)
                : simpleObjectTypeName(appearance, game);
            plural = /boots|gloves/.test(what) || appearance === LENSES;
        }
        else if (type === M_AP_MONSTER)
            what = monsterTypeName(appearance, monster.female);
        else if (type === M_AP_FURNITURE)
            what = MAP_SYMBOLS[appearance]?.name ?? 'thing';
        revealMonsterAppearance(monster);
        await pline(`${plural ? 'Those' : 'That'} ${what} ${plural ? 'are' : 'is'} really ${name}.`);
    }
    else if (game.flags.verbose && !canSpotMonster(monster))
        await pline(`There is ${name} there.`);
    await pline(await monsterStatusLine(monster, { x, y }));
    if (!canSpotMonster(monster))
        map_invisible(x, y);
}
async function diagnoseFloorObjects(x, y) {
    requirePlayingGame(game);
    const pile = game.level.objects[x]?.[y] ?? [];
    const reachable = heroCanReachFloor(game, { checkPit: true });
    const object = pile.find(item => item.otyp === CORPSE && reachable
        || item.otyp === STATUE && (reachable || (MONSTER_SIZE[item.corpsenm ?? -1] ?? 0) !== 0));
    if (!object)
        return { found: false, spentTime: false };
    if (object.corpsenm === undefined)
        throw new Error('Stethoscope floor diagnosis needs a monster species.');
    const species = object.corpsenm;
    const one = object.quan === 1 && pile.filter(item => item.otyp === CORPSE).length === 1;
    if (heroIsHallucinating(game)) {
        let diagnosis = object.otyp === STATUE ? "You're both stoned" : "They're dead";
        if (object.otyp === CORPSE && one) {
            diagnosis = `${corpsePronoun(object, species)}'s dead`;
        }
        await pline(`You hear a voice say, "${diagnosis}, Jim."`);
        return { found: true, spentTime: true };
    }
    if (object.otyp === CORPSE) {
        if (heroIsBlind(game))
            map_object(object);
        const reviver = game.urole.key === 'healer' && pile.some(item => item.otyp === CORPSE
            && objectTimers(item).some(timer => timer.kind === OBJECT_TIMER_KIND.REVIVE_MON));
        const here = x === game.u.ux && y === game.u.uy;
        await pline(`You determine that ${one ? here ? 'this' : 'that' : here ? 'these' : 'those'} unfortunate being${one ? '' : 's'} ${one ? 'is' : 'are'}${reviver ? ' mostly' : ''} dead.`);
    }
    else {
        const name = heroIsBlind(game) ? `${x === game.u.ux && y === game.u.uy ? 'This' : 'That'} ${monsterIsHumanoid(species) ? 'person' : 'creature'}`
            : `${(MONSTER_FLAGS2[species] ?? 0) & 0x80000 ? '' : 'The '}${monsterTypeName(species)}`;
        const health = game.urole.key === 'healer'
            ? game.level.traps.some(trap => trap.tx === x && trap.ty === y && trap.ttyp === STATUE_TRAP) ? 'extraordinary'
                : object.contents?.length ? 'remarkable' : 'fine' : 'fine';
        await pline(`${name} is in ${health} health for a statue.`);
    }
    return { found: true, spentTime: false };
}
function corpsePronoun(corpse, species) {
    const flags = MONSTER_FLAGS2[species] ?? 0;
    const saved = corpse.oextra?.omonst;
    if (saved) {
        if (flags & 0x40000)
            return 'It';
        const personal = monsterIsHumanoid(species)
            || !!((MONSTER_GENO[species] ?? 0) & 0x1000) || !!(flags & 0x80000);
        if (!personal)
            return 'It';
        return saved.female ? 'She' : 'He';
    }
    if (flags & 0x20000)
        return 'She';
    return flags & 0x10000 ? 'He' : 'It';
}
//# sourceMappingURL=stethoscope.js.map