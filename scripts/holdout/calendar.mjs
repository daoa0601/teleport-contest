import { itemAt } from '../lib/session-types.mjs';
// Date strata use the pinned calendar.c rules, including its approximate moon phase.
export function calendarFlags(datetime) {
    const year = Number(datetime.slice(0, 4));
    const month = Number(datetime.slice(4, 6));
    const day = Number(datetime.slice(6, 8));
    const hour = Number(datetime.slice(8, 10));
    const date = new Date(Date.UTC(year, month - 1, day));
    const dayOfYear = Math.floor((date.getTime() - Date.UTC(year, 0, 1)) / 86400000);
    const golden = ((year - 1900) % 19) + 1;
    let epact = (11 * golden + 18) % 30;
    if ((epact === 25 && golden > 11) || epact === 24)
        epact++;
    const moon = Math.floor((((dayOfYear + epact) * 6 + 11) % 177) / 22) & 7;
    return { moon, friday13: date.getUTCDay() === 5 && day === 13,
        night: hour < 6 || hour > 21, midnight: hour === 0 };
}
const buckets = { ordinary: [], fullMoon: [], newMoon: [], friday13: [], night: [] };
for (let day = 0; day < 1096; day++) {
    const date = new Date(Date.UTC(2000, 0, 1 + day));
    const prefix = date.toISOString().slice(0, 10).replaceAll('-', '');
    const datetime = `${prefix}120000`;
    const flags = calendarFlags(datetime);
    if (flags.moon === 4)
        buckets.fullMoon.push(datetime);
    if (flags.moon === 0)
        buckets.newMoon.push(datetime);
    if (flags.friday13)
        buckets.friday13.push(datetime);
    if (flags.moon !== 0 && flags.moon !== 4 && !flags.friday13) {
        buckets.ordinary.push(datetime);
        buckets.night.push(`${prefix}000000`, `${prefix}230000`);
    }
}
export function chooseDate(index, pick) {
    const categories = ['ordinary', 'ordinary', 'ordinary', 'ordinary', 'ordinary',
        'ordinary', 'fullMoon', 'newMoon', 'friday13', 'night'];
    const category = itemAt(categories, index % 10);
    const candidates = buckets[category];
    const date = itemAt(candidates, pick(candidates.length)).slice(0, 8);
    const hour = category === 'night' ? itemAt([0, 1, 2, 3, 4, 5, 22, 23], pick(8)) : 6 + pick(16);
    const datetime = `${date}${String(hour).padStart(2, '0')}0000`;
    return { datetime, category, ...calendarFlags(datetime) };
}
//# sourceMappingURL=calendar.mjs.map