import * as path from 'path';
import { resolveRelative } from '../util/path';

export default class FakeWatcher {
    private readonly _rootDirPath: string;
    private readonly _callbacks: ((filePath: string) => Promise<void>)[];

    constructor(rootDirPath: string) {
        this._rootDirPath = rootDirPath;
        this._callbacks = [];
    }

    start(callback: (filePath: string) => Promise<void>): () => Promise<void> {
        this._callbacks.push(callback);

        return async () => {
            const index =  this._callbacks.indexOf(callback);
            if (index >= 0) {
                this._callbacks.splice(index, 1);
            }
        };
    }

    emitChange(relativeFileName: string) {
        const filePath = resolveRelative(this._rootDirPath, relativeFileName);
        for (const callback of this._callbacks) {
            callback(filePath);
        }
    }
}
