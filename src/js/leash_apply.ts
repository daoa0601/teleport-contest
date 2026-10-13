// C apply.c:use_leash() and use_leash_core().
import { isok } from './const.js';
import { canSpotMonster, map_invisible, plineWithContinuation as pline, unmap_invisible } from './display.js';
import { game, requireGameLevel, requirePlayingGame } from './gstate.js';
import { impossible } from './diagnostics.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import { publishMonsterGrowl, publishMonsterWhimper, publishMonsterYelp } from './monster_anger.js';
import { MONSTER_FLAGS1, MONSTER_SOUND } from './monster_data.js';
import { monsterCanBeLeashed, releaseMonsterLeash } from './monster_leash.js';
import { monsterAtPosition } from './monster_location.js';
import { monsterName, possessiveName } from './monster_name.js';
import { LEASH } from './object_data.js';
import { promptDirection } from './tty_prompts.js';
import { rn2, rnd } from './rng.js';
import type { GameObject } from './object_types.js';
import type { Monster } from './monster_types.js';

export async function useLeash(leash: GameObject): Promise<boolean> {
    const hero = game.u;
    if (hero.uswallow) {
        if (!hero.ustuck) throw new Error('A swallowed hero needs an engulfer.');
        const name = monsterName(hero.ustuck, { suppressIt: true });
        const action = !leash.leashmon ? `leash ${name} from inside`
            : leash.leashmon === hero.ustuck.m_id ? `unleash ${name} from inside`
                : `unleash anything from inside ${name}`;
        await pline(`You can't ${action}.`);
        return false;
    }
    if (!leash.leashmon && game.inventory.filter(object => object.otyp === LEASH && object.leashmon).length >= 2) {
        await pline('You cannot leash any more pets.');
        return false;
    }
    const direction = await promptDirection();
    if (!direction) {
        await pline('Never mind.');
        return false;
    }
    const x = hero.ux + direction.dx, y = hero.uy + direction.dy;
    if (!isok(x, y)) return false;
    if (x === hero.ux && y === hero.uy) {
        if (hero.usteed && direction.dz > 0) {
            await useLeashOnMonster(leash, hero.usteed, x, y, true);
            return true;
        }
        await pline('Leash yourself?  Very funny...');
        return false;
    }
    const monster = monsterAtPosition(requireGameLevel(), x, y);
    if (!monster) {
        await pline('There is no creature there.');
        unmap_invisible(x, y);
    } else await useLeashOnMonster(leash, monster, x, y, canSpotMonster(monster));
    return true;
}

async function useLeashOnMonster(leash: GameObject, monster: Monster, x: number, y: number, spotted: boolean) {
    const level = requireGameLevel();
    const name = () => monsterName(monster, { capitalized: true });
    const petName = () => monsterName(monster, { article: 'none' });
    if (!spotted && level.requireAt(x, y).remembered_glyph?.kind !== 'invisible') {
        await pline(`You fail to ${leash.leashmon ? 'un' : ''}leash something.`);
        map_invisible(x, y);
    } else if (!monster.mtame) {
        await pline(`${name()} ${leash.leashmon ? 'is not' : 'cannot be'} leashed!`);
    } else if (!leash.leashmon) {
        const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
        if (monster.mleashed) await pline(`This ${spotted ? petName() : 'creature'} is already leashed.`);
        else if (flags & 0x00100000) await pline('The leash would just fall off.');
        else if ((flags & 0x6000) === 0x6000 && (flags & 0x8000))
            await pline(`${name()} has no extremities the leash would fit.`);
        else if (!monsterCanBeLeashed(monster)) {
            const target = x !== monster.mx || y !== monster.my ? `${possessiveName(petName())} tail` : petName();
            await pline(`The leash won't fit onto ${spotted ? 'your ' : ''}${target}.`);
        } else {
            await pline(`You slip the leash around ${spotted ? 'your ' : ''}${petName()}.`);
            monster.mleashed = 1;
            leash.leashmon = monster.m_id;
            monster.msleeping = 0;
        }
    } else if (leash.leashmon !== monster.m_id) {
        await pline('This leash is not attached to that creature.');
    } else if (leash.cursed) {
        await pline('The leash would not come off!');
        leash.bknown = true;
    } else {
        monster.mleashed = 0;
        leash.leashmon = 0;
        await pline(`You remove the leash from ${spotted ? 'your ' : ''}${petName()}.`);
    }
}

// C check_leash(): only movement farther from a pet tightens its leash.
export async function checkHeroLeashes(oldX: number, oldY: number) {
    requirePlayingGame(game);
    const distance = (x: number, y: number, monster: Monster) =>
        (x - monster.mx) ** 2 + (y - monster.my) ** 2;
    for (const leash of game.inventory.filter(object => object.otyp === LEASH && object.leashmon)) {
        const monster = game.level.monsters.find(candidate => candidate.m_id === leash.leashmon);
        if (!monster) {
            await impossible("leash in use isn't attached to anything?");
            leash.leashmon = 0;
            continue;
        }
        if (distance(game.u.ux, game.u.uy, monster) <= distance(oldX, oldY, monster)) continue;
        const separation = Math.max(Math.abs(game.u.ux - monster.mx), Math.abs(game.u.uy - monster.my));
        if (separation <= 3) continue;
        if (leash.cursed && !((MONSTER_FLAGS1[monster.mnum] ?? 0) & 0x400)) {
            if (separation > 5 || (monster.mhp -= rnd(2)) <= 0) {
                const pacifism = game.u.uconduct.killer ?? 0;
                await pline(`Your leash chokes ${monsterName(monster)} to death!`);
                await finishHeroMonsterKill(monster, monster.mx, monster.my, { showKillMessage: false });
                if (monster.mhp > 0) game.u.uconduct.killer = pacifism;
            } else {
                await pline(`${monsterName(monster, { capitalized: true })} is choked by the leash!`);
                if (monster.mtame && rn2(monster.mtame)) monster.mtame--;
            }
        } else if (separation > 5) {
            await pline(`${possessiveName(monsterName(monster, { capitalized: true }))} leash snaps loose!`);
            releaseMonsterLeash(monster);
        } else {
            await pline('You pull on the leash.');
            if (MONSTER_SOUND[monster.mnum]) {
                const sound = rn2(3);
                if (sound === 0) await publishMonsterGrowl(monster);
                else if (sound === 1) await publishMonsterYelp(monster);
                else await publishMonsterWhimper(monster);
            }
        }
        if (game.program_state.gameover) return;
    }
}
