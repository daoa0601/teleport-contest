// Native dokick.c:kick_door(), including witnessed town vandalism.
import { publishHeardMessage } from './hero_speech.js';
import { currentAttribute, exerciseAttribute } from './attrib.js';
import { triggerBoobyTrap } from './booby_trap.js';
import { A_DEX, A_STR, D_BROKEN, D_ISOPEN, D_NODOOR, D_TRAPPED, D_WARNED, SHOPBASE, SHOP_DOOR_COST, Upolyd } from './const.js';
import { canSpotMonster, feel_location, feel_newsym, plineWithContinuation as pline } from './display.js';
import { game, requirePlayingGame } from './gstate.js';
import { heroSpecies } from './hero_species.js';
import { heroHasMartialKick } from './kick_rules.js';
import { angerWatchGuards, isWatch } from './monster_anger.js';
import { MONSTER_FLAGS2 } from './monster_data.js';
import { monsterName } from './monster_name.js';
import { rn2, rnl } from './rng.js';
import { inTown, roomsAt } from './room.js';
import { heroIsBlind, heroIsDeaf } from './senses.js';
import { addShopDamage, payForShopDamage } from './shop_damage.js';
import { couldsee, vision_note_blocker_change } from './vision.js';
export async function kickDoor(x, y, average, responses) {
    requirePlayingGame(game);
    const door = game.level.requireAt(x, y);
    game.context.move = 1;
    if (door.doormask === D_ISOPEN || door.doormask === D_BROKEN || door.doormask === D_NODOOR) {
        await responses.dumb(x, y);
        return;
    }
    if (game.u.levitating) {
        await responses.ouch(x, y);
        return;
    }
    await exerciseAttribute(A_DEX, true);
    const giant = Upolyd(game.u) && !!((MONSTER_FLAGS2[heroSpecies()] ?? 0) & 0x2000);
    const breaks = giant || rnl(35) < average + (heroHasMartialKick() ? currentAttribute(A_DEX) : 0);
    if (breaks) {
        const shopDoor = roomsAt(game.level, x, y, SHOPBASE).length > 0;
        if (door.doormask & D_TRAPPED) {
            if (game.flags.verbose)
                await pline('You kick the door.');
            await exerciseAttribute(A_STR, false);
            door.doormask = D_NODOOR;
            if (await triggerBoobyTrap('door', { bodypart: true }))
                return;
        }
        else if (currentAttribute(A_STR) > 18 && rn2(5) === 0 && !shopDoor) {
            await pline('As you kick the door, it shatters to pieces!');
            await exerciseAttribute(A_STR, true);
            door.doormask = D_NODOOR;
        }
        else {
            await pline('As you kick the door, it crashes open!');
            await exerciseAttribute(A_STR, true);
            door.doormask = D_BROKEN;
        }
        feel_newsym(x, y);
        // Preserve the keeper's pre-break visibility until shop billing.
        vision_note_blocker_change(x, y);
        if (shopDoor) {
            addShopDamage(x, y, SHOP_DOOR_COST);
            await payForShopDamage('break');
        }
        await witnessDoorKick(x, y, true);
    }
    else {
        if (heroIsBlind())
            feel_location(x, y);
        await exerciseAttribute(A_STR, true);
        await pline(heroIsDeaf() || rn2(3) === 0 ? 'Thwack!!' : 'Whammm!!');
        await witnessDoorKick(x, y, false);
    }
}
async function witnessDoorKick(x, y, broken) {
    requirePlayingGame(game);
    if (!inTown(game.level, x, y))
        return;
    const witness = [...game.level.monsters].reverse().find(monster => !monster.dead && monster.mhp > 0 && isWatch(monster)
        && monster.mpeaceful && couldsee(monster.mx, monster.my));
    if (!witness)
        return;
    const door = game.level.requireAt(x, y);
    if (broken || ((door.looted ?? 0) & D_WARNED)) {
        await watchmanYells(witness, broken ? "Halt, thief!  You're under arrest!"
            : "Halt, vandal!  You're under arrest!");
        await angerWatchGuards(false);
    }
    else {
        await watchmanYells(witness, 'Hey, stop damaging that door!');
        door.looted = (door.looted ?? 0) | D_WARNED;
    }
}
async function watchmanYells(monster, shout) {
    const name = monsterName(monster, { article: 'a', capitalized: true });
    if (heroIsDeaf()) {
        if (canSpotMonster(monster))
            await pline(`${name} angrily waves ${monster.female ? 'her' : 'his'} arms!`);
        return;
    }
    if (canSpotMonster(monster))
        await pline(`${name} yells:`);
    else
        await publishHeardMessage('someone yell:', pline);
    await pline(`"${shout}"`);
}
//# sourceMappingURL=kick_door.js.map