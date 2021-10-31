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

type CppVersion = undefined | 11 | 14 | 17 | 20 | '11' | '14' | '17' | '20' | '2a';

export default class CppWasmPlugin extends Plugin {
    // Optional features
    private _cppVersion: CppVersion = undefined;
    private _enableMultivalue: boolean = false;
    private _enableSimd128: boolean = false;
    private _enableTailCall: boolean = false;

    setCppVersion(version: CppVersion): this {
        this._cppVersion = version;
        return this;
    }

    enableFeature(feature: 'multivalue' | 'simd128' | 'tailcall'): this {
        switch (feature) {
            case 'multivalue': this._enableMultivalue = true; break;
            case 'simd128': this._enableSimd128 = true; break;
            case 'tailcall': this._enableTailCall = true; break;
            default: throw new Error(`cannot enable unknown or unsupported wasm feature [${feature}]`);
        }
        return this;
    }

    disableFeature(feature: 'multivalue' | 'simd128' | 'tailcall'): this {
        switch (feature) {
            case 'multivalue': this._enableMultivalue = false; break;
            case 'simd128': this._enableSimd128 = false; break;
            case 'tailcall': this._enableTailCall = false; break;
            default: throw new Error(`cannot disable unknown or unsupported wasm feature [${feature}]`);
        }
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
        const p = (async () => {
            const args = ['--target=wasm32-unknown-unknown', '-Xlinker', '--no-entry', '-nostdlib'];
            if (this._cppVersion) {
                args.push(`-std=c++${this._cppVersion}`);
            }
            if (this._enableMultivalue) {
                args.push('-mmultivalue', '-Xclang', '-target-abi', '-Xclang', 'experimental-mv');
            }
            if (this._enableSimd128) {
                args.push('-msimd128');
            }
            if (this._enableTailCall) {
                args.push('-mtail-call');
            }
            if (Array.isArray(manifest.flags)) {
                for (const flag of manifest.flags) {
                    args.push(flag);
                }
            }
            if (Array.isArray(manifest.includes)) {
                for (const include of manifest.includes) {
                    args.push('-I', resolvePath(include));
                }
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

            return result;
        })();
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
    includes?: string[];
    flags?: string[];
}
