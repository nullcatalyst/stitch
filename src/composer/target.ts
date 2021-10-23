export default class Target {
    constructor(
        readonly scheme: string,
        readonly path: string,
        readonly root: string,
        readonly contents: Promise<string | Buffer>,
    ) {}

    get textContents(): Promise<string> {
        return this.contents.then(contents => contents.toString('utf8'));
    }

    get bufferContents(): Promise<Buffer> {
        return this.contents.then(contents => Buffer.from(contents));
    }
}
