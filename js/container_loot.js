// C pickup.c:doloot_core(), do_loot_cont(), mon_beside(), and loot_mon().
import { GRAVE } from './const.js';
import { game, requireGameLevel } from './gstate.js';
import { flush_screen, plineWithContinuation as pline } from './display.js';
import { heroHasNoHands, heroHasNoLimbs } from './polyself.js';
import { exceedsActionCapacity } from './weight.js';
import { ableToLoot } from './container_location.js';
import { isContainer, useContainer } from './container.js';
import { inventoryItemDescription } from './invent.js';
import { showMultiSelectWindow, snapshotMenuUnderlay } from './windows.js';
import { feelPetrifyingCorpse, willFeelPetrifyingCorpse } from './stoning.js';
import { monsterHasMapPosition } from './monster_location.js';
import { monsterSaddle } from './steed.js';
import { monsterName } from './monster_name.js';
import { removeObjectFromMonsterInventory } from './monster_inventory.js';
import { holdAnotherObject } from './hero_hold_object.js';
import { pickupAtHero } from './pickup.js';
import { objectCombatName } from './objnam.js';
import { promptYesNoQuit } from './query.js';
import { BAG_OF_TRICKS } from './object_data.js';
import { learnObjectType } from './object_knowledge.js';
import { propertyIsActive } from './properties.js';
import { loseHeroHp } from './hero_damage.js';
import { rn2, rnd } from './rng.js';
import { reverseLoot } from './confused_loot.js';
export async function lootCommand(input) {
    game.context.move = 0;
    if (exceedsActionCapacity(game)) {
        await pline("You can't do that while carrying so much stuff.");
        return;
    }
    if (heroHasNoHands(game)) {
        await pline('You have no hands!');
        return;
    }
    if (game.u.confused || (game.u.confusionTurns ?? 0) > 0) {
        if (rn2(6) && await reverseLoot()) {
            game.context.move = 1;
            return;
        }
        if (rn2(2)) {
            await pline('Being confused, you find nothing to loot.');
            game.context.move = 1;
            return;
        }
    }
    const { ux: x, uy: y } = game.u;
    if (!game.iflags.menu_requested && await lootFloorContainers(x, y, input.unlockContainer))
        return;
    const beside = requireGameLevel().monsters.some(monster => monsterHasMapPosition(monster, game) && monster.mhp > 0
        && Math.abs(monster.mx - x) <= 1 && Math.abs(monster.my - y) <= 1);
    if (!beside && !game.iflags.menu_requested) {
        await pline("You don't find anything here to loot.");
        return;
    }
    const target = await input.chooseDirection('Loot in what direction?', 'Invalid loot location', x, y);
    if (!target)
        return;
    const underfoot = target.x === x && target.y === y;
    const containers = (requireGameLevel().objects[target.x]?.[target.y] ?? []).some(isContainer);
    if (underfoot && containers) {
        await lootFloorContainers(x, y, input.unlockContainer);
        return;
    }
    if (target.dz < 0) {
        await pline("You don't find anything to loot on the ceiling.");
        game.context.move = 1;
        return;
    }
    const monster = requireGameLevel().monsters.find(monster => monsterHasMapPosition(monster, game) && monster.mhp > 0
        && monster.mx === target.x && monster.my === target.y);
    const result = monster ? await lootMonster(monster) : { asked: false, spentTime: false };
    if (game.u.confused || (game.u.confusionTurns ?? 0) > 0
        || game.u.stunned || (game.u.stunnedTurns ?? 0) > 0)
        game.context.move = 1;
    if (result.spentTime)
        return;
    if (!underfoot && containers) {
        await pline(monster ? `You can't loot anything ${result.asked ? 'else ' : ''}there with ${monsterName(monster)} in the way.`
            : 'You have to be at a container to loot it.');
    }
    else
        await pline(`You don't find anything ${result.asked ? 'else ' : ''}${underfoot ? 'here' : 'there'} to loot.`);
}
async function lootFloorContainers(x, y, unlock) {
    const pile = requireGameLevel().objects[x]?.[y] ?? [];
    const containers = pile.filter(isContainer);
    if (!containers.length) {
        if (requireGameLevel().requireAt(x, y).typ === GRAVE)
            await pline('You need to dig up the grave to effectively loot it...');
        return false;
    }
    if (!await ableToLoot(x, y, true))
        return true;
    for (const object of pile) {
        if (willFeelPetrifyingCorpse(object)) {
            await feelPetrifyingCorpse(object);
            game.context.move = 1;
            return true;
        }
    }
    const selected = containers.length === 1 ? containers
        : await showMultiSelectWindow({ title: 'Loot which containers?', omitHeadings: true,
            sections: [{ items: containers.map((object, index) => ({
                        key: String.fromCharCode(97 + index), text: inventoryItemDescription(object), value: object,
                    })) }], signalEscape: true });
    if (selected === null)
        return true;
    if (!selected.length)
        return false;
    let spentTime = false;
    let resetJustPicked = true;
    for (const [index, container] of selected.entries()) {
        if (container.olocked) {
            await unlock(container);
            spentTime ||= !!game.context.move;
            continue;
        }
        container.lknown = true;
        if (container.otyp === BAG_OF_TRICKS) {
            await pline(`You carefully open the ${objectCombatName(container)}...`);
            await pline('It develops a huge set of teeth and bites you!');
            const damage = rnd(10);
            await loseHeroHp(propertyIsActive('halfPhysicalDamage') ? Math.ceil(damage / 2) : damage, 'carnivorous bag');
            learnObjectType(BAG_OF_TRICKS);
            spentTime = true;
            break;
        }
        game._pending_message = '';
        await flush_screen(1);
        const result = await useContainer(container, {
            moreContainers: index + 1 < selected.length, underlay: snapshotMenuUnderlay(),
            resetJustPicked,
        });
        if (result.tookOut)
            resetJustPicked = false;
        spentTime ||= result.spentTime;
        if (result.heroDied || result.stopLooting || !result.container)
            break;
    }
    game.context.move = spentTime ? 1 : 0;
    return true;
}
async function lootMonster(monster) {
    let asked = false;
    let spentTime = false;
    const saddle = monster !== game.u.usteed ? monsterSaddle(monster) : null;
    if (saddle) {
        asked = true;
        const name = monsterName(monster, { suppressSaddle: true });
        const answer = await promptYesNoQuit(`Do you want to remove the saddle from ${name}?`, 'n');
        if (answer === 'q')
            return { asked, spentTime };
        if (answer === 'y') {
            if (heroHasNoLimbs(game)) {
                await pline("You can't do that without limbs.");
                return { asked, spentTime };
            }
            if (saddle.cursed) {
                await pline(`You can't.  The saddle seems to be stuck to ${name}.`);
                game.context.move = 1;
                return { asked, spentTime: true };
            }
            await removeObjectFromMonsterInventory(monster, saddle);
            if (game.flags.verbose !== false)
                await pline(`You take the ${objectCombatName(saddle)} off of ${monsterName(monster)}.`);
            await holdAnotherObject(saddle, { dropMessage: `You drop ${inventoryItemDescription(saddle)}!` });
            rnd(3);
            game.context.move = 1;
            spentTime = true;
        }
    }
    if (game.u.uswallow) {
        await pickupAtHero();
        spentTime = !!game.context.move;
    }
    return { asked, spentTime };
}
//# sourceMappingURL=container_loot.js.map