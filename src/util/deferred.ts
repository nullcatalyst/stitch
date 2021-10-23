export default class Deferred<T> {
    readonly resolve: (value: T) => void;
    readonly reject: (err: Error) => void;
    readonly promise: Promise<T>;

    constructor() {
        this.resolve = () => {};
        this.reject = () => {};
        this.promise = new Promise((resolve, reject) => {
            (this as any).resolve = resolve;
            (this as any).reject = reject;
        });
    }
}
