import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarFlags, chooseDate } from '../scripts/holdout/calendar.mjs';
void test('night and midnight use the game clock, not the host timezone', () => {
    assert.equal(calendarFlags('20000110000000').midnight, true);
    assert.equal(calendarFlags('20000110050000').night, true);
    assert.equal(calendarFlags('20000110060000').night, false);
    assert.equal(calendarFlags('20000110210000').night, false);
    assert.equal(calendarFlags('20000110220000').night, true);
});
void test('Friday the thirteenth requires both date conditions', () => {
    assert.equal(calendarFlags('20001013120000').friday13, true);
    assert.equal(calendarFlags('20001012120000').friday13, false);
    assert.equal(calendarFlags('20001113120000').friday13, false);
});
void test('date strata actually satisfy their named game conditions', () => {
    for (let index = 0; index < 100; index++) {
        const selected = chooseDate(index, size => index % size);
        if (selected.category === 'fullMoon')
            assert.equal(selected.moon, 4);
        if (selected.category === 'newMoon')
            assert.equal(selected.moon, 0);
        if (selected.category === 'friday13')
            assert.equal(selected.friday13, true);
        if (selected.category === 'night')
            assert.equal(selected.night, true);
        if (selected.category === 'ordinary') {
            assert.equal(selected.night, false);
            assert.equal(selected.friday13, false);
            assert.notEqual(selected.moon, 0);
            assert.notEqual(selected.moon, 4);
        }
    }
});
//# sourceMappingURL=holdout-calendar.test.js.map