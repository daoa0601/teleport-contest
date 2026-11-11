import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { CORPSTAT_FEMALE, CORPSTAT_MALE } from '../js/const.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { addInventoryItem } from '../js/invent.js';
import { addObjectToContainer, placeObject } from '../js/mkobj.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { CHEST, CORPSE } from '../js/object_data.js';
import { addObjectToMonsterInventory } from '../js/steal.js';
import { probeObject } from '../js/zap.js';
import { runExtendedCommand } from './support/commands.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const secondGender of [CORPSTAT_MALE, CORPSTAT_FEMALE]) {
    for (const menuKind of ['drop', 'put in', 'take out', 'pick up', 'probe', 'swallowed look']) {
        void test(`${menuKind} explains unmerged corpse genders only when they differ (${secondGender})`, async () => {
            await freshObjectRoom();
            const first = await knownObject(CORPSE, {
                corpsenm: MONSTER_NAME.indexOf('newt'), spe: CORPSTAT_MALE, invlet: 'a', age: 1,
            });
            const second = await knownObject(CORPSE, {
                corpsenm: MONSTER_NAME.indexOf('newt'), spe: secondGender, invlet: 'b', age: 50,
            });
            const input = resetInputState();
            let menu = '';
            input.display = {
                async readKey(): Promise<number> {
                    const view = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
                    if (/Do what with/.test(view)) return (menuKind === 'put in' ? 'i' : 'o').charCodeAt(0);
                    menu = view;
                    return 27;
                },
            };

            if (menuKind === 'drop' || menuKind === 'put in') {
                await addInventoryItem(first);
                await addInventoryItem(second);
                if (menuKind === 'drop') await rhack('D'.charCodeAt(0));
                else {
                    await floorObject(CHEST, game.u.ux, game.u.uy, {
                        initialize: false, olocked: false, otrapped: false, cknown: true,
                    });
                    await runExtendedCommand('loot');
                }
            } else if (menuKind === 'pick up') {
                await placeObject(first, game.u.ux, game.u.uy);
                await placeObject(second, game.u.ux, game.u.uy);
                await rhack(','.charCodeAt(0));
            } else if (menuKind === 'swallowed look') {
                const worm = await createMonsterAt('purple worm', game.u.ux, game.u.uy);
                await addObjectToMonsterInventory(worm, first);
                await addObjectToMonsterInventory(worm, second);
                game.u.uswallow = 1;
                game.u.ustuck = worm;
                await rhack(':'.charCodeAt(0));
            } else {
                const box = await floorObject(CHEST, game.u.ux, game.u.uy, {
                    initialize: false, olocked: false, otrapped: false, cknown: true,
                });
                await addObjectToContainer(box, first);
                await addObjectToContainer(box, second);
                if (menuKind === 'probe') await probeObject(box);
                else await runExtendedCommand('loot');
            }

            assert.match(menu, /newt corpse/, 'the command must show its object menu');
            if (secondGender === CORPSTAT_FEMALE) {
                assert.match(menu, /male newt corpse/);
                assert.match(menu, /female newt corpse/);
            } else assert.doesNotMatch(menu, /male newt/);
        });
    }
}

for (const menuKind of ['drop', 'take out']) {
    void test(`${menuKind} checks corpse genders before applying the blessed category filter`, async () => {
        await freshObjectRoom();
        const male = await knownObject(CORPSE, {
            corpsenm: MONSTER_NAME.indexOf('newt'), spe: CORPSTAT_MALE, invlet: 'a', blessed: true,
        });
        const female = await knownObject(CORPSE, {
            corpsenm: MONSTER_NAME.indexOf('newt'), spe: CORPSTAT_FEMALE, invlet: 'b',
        });
        const input = resetInputState();
        let menu = '';
        input.display = {
            async readKey(): Promise<number> {
                const view = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
                if (/Do what with/.test(view)) return 'o'.charCodeAt(0);
                if (/what type of/.test(view)) {
                    input.feed('\n');
                    return 'B'.charCodeAt(0);
                }
                menu = view;
                return 27;
            },
        };

        if (menuKind === 'drop') {
            await addInventoryItem(male);
            await addInventoryItem(female);
            await rhack('D'.charCodeAt(0));
        } else {
            const box = await floorObject(CHEST, game.u.ux, game.u.uy, {
                initialize: false, olocked: false, otrapped: false, cknown: true,
            });
            await addObjectToContainer(box, male);
            await addObjectToContainer(box, female);
            await runExtendedCommand('loot');
        }

        assert.match(menu, /male newt corpse/);
        assert.doesNotMatch(menu, /female newt corpse/);
    });
}
