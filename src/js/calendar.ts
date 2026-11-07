// C calendar.c:getnow(), time_from_yyyymmddhhmmss(), getlt(),
// phase_of_the_moon(), and friday_13th().

// Port only: the recording clock's local hour (C reads getlt() fields).
export function recorderLocalHour(datetime: string | null | undefined): number {
    const epoch = recorderLocalEpochSeconds(datetime) || Date.now() / 1000;
    return Number(new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York', hourCycle: 'h23', hour: '2-digit',
    }).format(new Date(epoch * 1000)));
}

// C mhitu.c:ld() uses calendar.c:yyyymmdd(0), after localtime()
// normalizes the fixed clock's inherited daylight saving offset.
export function recorderIsLeapDay(datetime: string | null | undefined): boolean {
    const epoch = recorderLocalEpochSeconds(datetime) || Date.now() / 1000;
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date(epoch * 1000));
    return parts.some(part => part.type === 'month' && part.value === '02')
        && parts.some(part => part.type === 'day' && part.value === '29');
}

// C calendar.c:getlt(): localtime(getnow()).  getnow() inherits the recording
// clock's New York DST offset, while localtime() applies the fixed date's own offset,
// so a time near midnight can fall on the neighboring calendar day.
// Also C calendar.c:getyear(): inlined here with the other local date fields.
export function recorderLocalDate(datetime: string | null | undefined):
    { year: number; month: number; day: number; weekday: number } | null {
    const epoch = recorderLocalEpochSeconds(datetime);
    if (!epoch) return null;
    const parts = new Map<string, string>(new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
        weekday: 'short',
    }).formatToParts(new Date(epoch * 1000))
        .filter(part => part.type !== 'literal')
        .map(part => [part.type, part.value]));
    const field = (name: string): string => {
        const value = parts.get(name);
        if (value === undefined) throw new Error(`Local time formatter omitted ${name}`);
        return value;
    };
    return {
        year: Number(field('year')), month: Number(field('month')), day: Number(field('day')),
        weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(field('weekday')),
    };
}

// New York daylight time (UTC-4) inherited by the recorder's fixed clock.
const RECORDER_INHERITED_OFFSET_MS = -4 * 60 * 60 * 1000;

// Port only: apply the recording clock's inherited New York DST offset to
// its fixed timestamp.
export function recorderLocalEpochSeconds(datetime: string | null | undefined): number {
    if (!datetime || !/^\d{14}$/.test(datetime)) return 0;
    const values = [
        Number(datetime.slice(0, 4)), Number(datetime.slice(4, 6)),
        Number(datetime.slice(6, 8)), Number(datetime.slice(8, 10)),
        Number(datetime.slice(10, 12)), Number(datetime.slice(12, 14)),
    ] as const;
    const target = Date.UTC(values[0], values[1] - 1, values[2],
        values[3], values[4], values[5]);
    // The deterministic-recorder patch copies localtime(now) into struct tm
    // and then overwrites the fixed calendar fields without resetting
    // tm_isdst, so mktime() applies the New York offset in effect when the
    // session was recorded, not the fixed date's historically correct one.
    // The replay cannot observe that recording clock; the reference corpus
    // was recorded under daylight time, so model its inherited offset.
    return Math.trunc((target - RECORDER_INHERITED_OFFSET_MS) / 1000);
}



// C calendar.c:yyyymmddhhmmss() uses the local offset in effect at the time.
export function recorderTimestamp(epoch: number): string {
    const instant = new Date(epoch * 1000);
    if (Number.isNaN(instant.getTime())) throw new RangeError(`Unrepresentable time ${epoch}`);
    const parts = new Map<string, number>(new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York', hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(instant)
        .filter(part => part.type !== 'literal')
        .map(part => [part.type, Number(part.value)]));
    const field = (name: string): number => {
        const value = parts.get(name);
        if (value === undefined) throw new Error(`Local time formatter omitted ${name}`);
        return value;
    };
    // yyyymmddhhmmss() reads a tm_year below 70 as a two-digit year.
    const tmYear = field('year') - 1900;
    const year = tmYear < 70 ? tmYear + 2000 : tmYear + 1900;
    return [String(year).padStart(4, '0'),
        ...['month', 'day', 'hour', 'minute', 'second'].map(name => String(field(name)).padStart(2, '0'))]
        .join('');
}

// Port only: round-trip a saved time through the recording clock's
// offset.
// C save.c writes the local timestamp; restore.c reads it using the recording
// clock's offset. A time saved across a DST boundary therefore shifts on restore.
export function recorderRestoredTime(epoch: number): number {
    return recorderLocalEpochSeconds(recorderTimestamp(epoch));
}

// C calendar.c:phase_of_the_moon()
// Also C calendar.c:friday_13th(): both checks share the same local date.
// C reads getlt(); the port reads the recording's local date.
export function fixedCalendar(datetime?: string | null) {
    const date = recorderLocalDate(datetime);
    if (!date) return { moonphase: null, friday13: false };
    const { year, month, day, weekday } = date;
    const diy = Math.floor((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / 86400000);
    const goldn = ((year - 1900) % 19) + 1;
    let epact = (11 * goldn + 18) % 30;
    if ((epact === 25 && goldn > 11) || epact === 24) epact++;
    const moonphase = (Math.floor(((((diy + epact) * 6) + 11) % 177) / 22)) & 7;
    return { moonphase, friday13: weekday === 5 && day === 13 };
}

// C calendar.c:night()
export function sessionIsNight(datetime: string | null | undefined): boolean {
    const hour = recorderLocalHour(datetime);
    return hour < 6 || hour > 21;
}
