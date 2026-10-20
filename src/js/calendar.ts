// C calendar.c:getnow(), time_from_yyyymmddhhmmss(), and getlt().

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

export function recorderLocalEpochSeconds(datetime: string | null | undefined): number {
    if (!datetime || !/^\d{14}$/.test(datetime)) return 0;
    const values = [
        Number(datetime.slice(0, 4)), Number(datetime.slice(4, 6)),
        Number(datetime.slice(6, 8)), Number(datetime.slice(8, 10)),
        Number(datetime.slice(10, 12)), Number(datetime.slice(12, 14)),
    ] as const;
    const target = Date.UTC(values[0], values[1] - 1, values[2],
        values[3], values[4], values[5]);
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York', hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    // The deterministic-recorder patch copies localtime(now) into struct tm
    // and then overwrites the fixed calendar fields without resetting
    // tm_isdst.  Preserve that inherited current New York offset rather than
    // applying the fixed date's historically correct DST offset.
    const currentEpoch = Math.trunc(Date.now() / 1000) * 1000;
    const currentParts = new Map<string, number>(
        formatter.formatToParts(new Date(currentEpoch))
            .filter(part => part.type !== 'literal')
            .map(part => [part.type, Number(part.value)]),
    );
    const part = (name: string): number => {
        const value = currentParts.get(name);
        if (value === undefined) throw new Error(`Local time formatter omitted ${name}`);
        return value;
    };
    const currentLocalProjection = Date.UTC(
        part('year'), part('month') - 1, part('day'),
        part('hour'), part('minute'), part('second'),
    );
    const inheritedOffset = currentLocalProjection - currentEpoch;
    return Math.trunc((target - inheritedOffset) / 1000);
}


// C save.c writes yyyymmddhhmmss(t), using the New York offset in effect at
// t; restore.c reads that text back through time_from_yyyymmddhhmmss(), which
// applies the current offset.  A time saved across a DST boundary shifts.
export function recorderRestoredTime(epoch: number): number {
    const parts = new Map<string, string>(new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York', hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(epoch * 1000))
        .filter(part => part.type !== 'literal')
        .map(part => [part.type, part.value]));
    const text = ['year', 'month', 'day', 'hour', 'minute', 'second']
        .map(name => parts.get(name) ?? '').join('');
    return recorderLocalEpochSeconds(text) || epoch;
}
