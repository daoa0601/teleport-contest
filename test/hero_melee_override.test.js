import assert from 'node:assert/strict';
import test from 'node:test';
import { artifactByName } from '../js/artifacts.js';
import { rhack } from '../js/cmd.js';
import { MM_NOGRP, MM_NOWAIT, NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKey, resetInputState } from '../js/input.js';
import { DAGGER } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { setPrimaryWeapon, setSecondaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
for (const { force, confirm, form, swings } of [
    { force: false, confirm: true, form: null, swings: 1 },
    { force: true, confirm: true, form: null, swings: 2 },
    { force: false, confirm: false, form: null, swings: 2 },
    { force: false, confirm: true, form: 'ettin', swings: 2 },
]) {
    void test(`Stormbringer ${force ? 'obeys a forced attack' : confirm ? 'overrides attack confirmation' : 'attacks without confirmation'}${form ? ' in an ettin form' : ''}`, async () => {
        freshObjectRoom({
            role: 'barbarian', flags: { verbose: true, confirm },
            hero: { uhitinc: 100, ualign: { type: -1, record: 0 } },
        });
        if (form)
            installPolymorphedHero(form, { hitPoints: 100 });
        const artifact = artifactByName('Stormbringer');
        assert.ok(artifact);
        await setPrimaryWeapon(await addInventoryObject(artifact.baseType, {
            oartifact: artifact.id, oextra: { oname: artifact.name },
        }));
        await setSecondaryWeapon(await addInventoryObject(DAGGER, { spe: 20 }));
        game.u.twoweap = !form;
        const target = await createMonsterAt('human zombie', 11, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
        target.mhp = target.mhpmax = 2000;
        target.mpeaceful = true;
        target.msleeping = 0;
        target.mcanmove = 1;
        const messages = [];
        const input = resetInputState();
        installPagerInput(input, { expected: /human zombie|bloodthirsty/, limit: 8 });
        const pager = input.display;
        assert.ok(pager);
        input.display = {
            async readKey() {
                messages.push(game._pending_message);
                return pager.readKey();
            },
        };
        initRng(41n);
        if (force)
            pushKey('l');
        await rhack((force ? 'F' : 'l').charCodeAt(0));
        messages.push(game._pending_message);
        assert.equal(game.context.move, 1);
        assert.equal(game.u.uconduct?.weaphit, swings);
        assert.ok(target.mhp < 2000);
        const prose = messages.join('\n');
        if (!force && confirm) {
            assert.equal(prose.match(/Your bloodthirsty blade attacks!/g)?.length, swings);
            assert.ok(prose.indexOf('bloodthirsty') < prose.indexOf('You smite'), 'The involuntary attack is announced before its outcome');
        }
        else
            assert.doesNotMatch(prose, /bloodthirsty/);
    });
}
//# sourceMappingURL=hero_melee_override.test.js.map