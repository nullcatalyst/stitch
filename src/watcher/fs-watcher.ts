import * as chokidar from 'chokidar';
import * as path from 'path';
import { resolveRelative } from '../util/path';

export default class FsWatcher {
    private readonly _rootDirPath: string;

    constructor(rootDirPath: string) {
        this._rootDirPath = rootDirPath;
    }

    start(callback: (filePath: string) => Promise<void>): () => Promise<void> {
        const rootDirPath = this._rootDirPath;
        const watcher = chokidar.watch(rootDirPath, { atomic: true });

        watcher.on('all', async (event, fileName) => {
            if (event != 'change') {
                return;
            }

            callback(resolveRelative(rootDirPath, fileName));
        });

        return async () => {
            await watcher.close();
        };
    }
}
