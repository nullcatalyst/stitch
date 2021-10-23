import * as fs from 'fs';
import * as path from 'path';
import Deferred from '../util/deferred';
import { safeRejectedPromise } from '../util/promise';
import Composer from './composer';
import { FileReadError, RebuildError } from './error';
import { fromExtension } from './scheme';
import Target from './target';

export interface Options {
    root: string;
    output?: string;
    scheme?: string;
}

export default class Pipeline {
    private inProgress = false;
    private result?: Promise<Target>;
    private stop?: Deferred<void>;

    readonly scheme: string;
    readonly rootPath: string;
    readonly inputPath: string;
    readonly outputPath?: string;

    constructor(readonly composer: Composer, inputPath: string, opts: Readonly<Options>) {
        this.scheme = opts.scheme ?? fromExtension(inputPath);
        this.inputPath = inputPath;
        this.outputPath = opts.output;
        this.rootPath = opts.root;
    }

    build(): Promise<Target> {
        if (this.result == null) {
            return this.rebuild();
        }

        return this.result;
    }

    rebuild(): Promise<Target> {
        if (this.inProgress) {
            if (this.composer.options.verbose) {
                console.log(`restarting the pipeline operating on file "${this.inputPath}"`);
            }

            this.stop.reject(new Error('file changed, rebuilding'));
            return this.result;
        }

        this.result = (async () => {
            if (this.composer.options.verbose) {
                console.log(`starting the pipeline operating on file "${this.inputPath}"`);
            }

            restart: do {
                const stop = new Deferred<void>();
                this.stop = stop;

                if (this.composer.options.verbose) {
                    console.log(`clearing the dependencies for file "${this.inputPath}"`);
                }
                this.composer.clearDependenciesFor(this.inputPath);

                let target = new Target(
                    this.scheme,
                    this.inputPath,
                    this.rootPath,
                    safeRejectedPromise(new Error(`file "${this.inputPath}" not loaded`)),
                );
                const plugins = this.composer.plugins.slice();
                try {
                    for (const plugin of plugins) {
                        target = await plugin.transform(this.composer, target);
                    }

                    await Promise.race([stop.promise, this.output(target)]);
                } catch (err: unknown) {
                    if (err instanceof RebuildError) {
                        continue restart;
                    } else {
                        throw err;
                    }
                }

                if (this.composer.options.verbose) {
                    console.log(`pipeline for file "${this.inputPath}" complete`);
                }

                this.inProgress = false;
                return target;
            } while (false);
        })();

        return this.result;
    }

    private async output(target: Target): Promise<void> {
        let contents: string | Buffer;
        try {
            contents = await target.contents;
        } catch (err: unknown) {
            console.error('CAUGHT');
            if (err instanceof FileReadError) {
                // ignore
            } else {
                console.error(err);
            }
            return;
        }

        if (contents == null || this.outputPath == null || this.outputPath === '') {
            return;
        }

        try {
            const outputPath = path.join(this.outputPath, path.relative(this.rootPath, target.path));
            if (this.composer.options.verbose) {
                console.log(`outputting file "${outputPath}"`);
            }

            await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
            await fs.promises.writeFile(outputPath, contents);
        } catch (err) {
            console.error(err);
        }
    }
}
