export class PanicTermination extends Error {
    constructor(reason: string) {
        super(reason);
        this.name = 'PanicTermination';
    }
}
