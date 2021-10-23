import * as childProcess from 'child_process';
import Composer from '../composer/composer';
import Plugin from '../composer/plugin';
import * as json5 from 'json5';
import * as path from 'path';
import * as fs from 'fs';
import * as scheme from '../composer/scheme';
import Target from '../composer/target';
import * as pathutil from '../util/path';
import { file as tmpFile } from 'tmp-promise';

export default class CppWasmPlugin extends Plugin {
    private _enableFeatureMultivalue: boolean = false;

    enableFeatureMultivalue(enable: boolean): this {
        this._enableFeatureMultivalue = enable;
        return this;
    }

    override name(): string {
        return 'cpp-wasm';
    }

    override operatesOn(composer: Composer, target: Target): boolean {
        return scheme.getFirst(target.scheme) === 'cpp-wasm';
    }

    override async transformImpl(composer: Composer, target: Target): Promise<Target> {
        const rootDir = path.dirname(target.path);
        function resolvePath(relativePath: string | undefined) {
            if (relativePath == null) {
                throw new Error('cannot resolve input path to <null>');
            }
            return path.join(rootDir, relativePath);
        }

        const manifest = json5.parse(await target.textContents) as Readonly<Manifest>;
        const outputFileName = manifest.out ? resolvePath(manifest.out) : pathutil.replaceExt(target.path, '.wasm');

        return new Target(
            scheme.replaceFirst(target.scheme, 'wasm'),
            outputFileName,
            target.root,
            this._compile(composer, manifest, resolvePath),
        );
    }

    private _compile(
        composer: Composer,
        manifest: Readonly<Manifest>,
        resolvePath: (fileName: string) => string,
    ): Promise<Buffer | string> {
        const defer = [];
        const p = new Promise<Buffer | string>(async (resolve, reject) => {
            const args = ['--target=wasm32-unknown-unknown', '-Xlinker', '--no-entry', '-nostdlib', '-std=c++17'];
            if (this._enableFeatureMultivalue) {
                args.push('-mmultivalue', '-Xclang', '-target-abi', '-Xclang', 'experimental-mv');
            }

            let tmpPath: string;
            if (composer.options.release) {
                args.push(
                    '-Os',
                    '-ffast-math',
                    // '-flto',
                    // '-Wl,--lto-O3',
                );

                const { path, cleanup } = await tmpFile();
                tmpPath = path;
                defer.push(cleanup);

                args.push('-o', path);
            } else {
                args.push('-o-');
            }

            args.push(...(manifest.srcs ?? []).map(resolvePath));

            let result = await spawn('clang', args);
            if (composer.options.release) {
                const { path, cleanup } = await tmpFile();
                defer.push(cleanup);
                await spawn(
                    'wasm-opt',
                    [
                        '--reorder-functions',
                        '--reorder-locals',
                        '--simplify-globals',
                        '--simplify-locals',
                        '--strip-producers',
                        '--strip-target-features',
                        '--vacuum',
                        '-Oz',
                        '--converge',
                        '-o',
                        path,
                        tmpPath,
                    ],
                    '',
                );
                result = await fs.promises.readFile(path);
                // result = await fs.promises.readFile(tmpPath);
            }

            resolve(result);
        });
        p.finally(() => defer.forEach(defer => defer()));
        return p;
    }
}

function concatBuffers(parts: Buffer[]): Buffer {
    const len = parts.reduce((len, part) => len + part.length, 0);
    const buffer = Buffer.alloc(len);

    let offset = 0;
    for (const part of parts) {
        buffer.set(part, offset);
        offset += part.length;
    }

    return buffer;
}

function spawn(command: string, args: string[], input?: Buffer | string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const child = childProcess.spawn(command, args);

        let chunks = [];
        child.stdout.on('data', data => chunks.push(data));

        child.stderr.on('data', data => console.error(data.toString('utf8')));

        child.on('error', err => reject(err));
        child.on('close', code => resolve(concatBuffers(chunks) as any));

        if (input != null) {
            child.stdin.write(input);
            child.stdin.end();
        }
    });
}

interface Manifest {
    out?: string;
    srcs?: string[];
    flags?: string[];
}