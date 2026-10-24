import test from 'node:test';
import assert from 'node:assert/strict';
import { requireGameDisplay } from '../js/gstate.js';
import { runSegment } from '../js/jsmain.js';
import { memoryStorage } from './support/memory-storage.js';

for (const { choices, question } of [
    { choices: 'role:Wizard,race:human,gender:male',
        question: "Shall I pick your male human Wizard's alignment for you? [ynaq]" },
    { choices: 'role:Priest,race:elf',
        question: "Shall I pick your chaotic elven Priest/Priestess's gender for you? [ynaq]" },
    { choices: 'race:elf,gender:female',
        question: "Shall I pick your female elf's role for you? [ynaq]" },
    { choices: 'role:Valkyrie',
        question: "Shall I pick your Valkyrie's race and alignment for you? [ynaq]" },
    { choices: '',
        question: "Shall I pick character's race, role, gender and alignment for you? [ynaq]" },
]) {
    void test(`character question describes ${choices || 'an unconstrained character'}`, async () => {
        await runSegment({
            seed: 26,
            datetime: '20260831120000',
            nethackrc: `OPTIONS=name:Chooser,!legacy,!tutorial${choices ? ',' + choices : ''}`,
            moves: '',
            storage: memoryStorage(),
        });
        const row = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trim();

        assert.equal(row, question);
    });
}
