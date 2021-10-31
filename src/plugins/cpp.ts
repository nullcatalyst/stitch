import * as childProcess from 'child_process';
import Composer from '../composer/composer';
import Plugin from '../composer/plugin';
import * as json5 from 'json5';
import * as path from 'path';
import * as scheme from '../composer/scheme';
import Target from '../composer/target';
import * as pathutil from '../util/path';
import { file as tmpFile } from 'tmp-promise';

type CppVersion = undefined | 11 | 14 | 17 | 20 | '11' | '14' | '17' | '20' | '2a';

export default class CppPlugin extends Plugin {
    private _cppVersion: CppVersion = undefined;
    private _enableMultivalue: boolean = false;
    private _enableSimd128: boolean = false;
    private _enableTailCall: boolean = false;

    setCppVersion(version: CppVersion): this {
        this._cppVersion = version;
        return this;
    }

    override name(): string {
        return 'cpp';
    }

    override operatesOn(composer: Composer, target: Target): boolean {
        return scheme.getFirst(target.scheme) === 'cpp';
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
        const outputFileName = manifest.out
            ? resolvePath(manifest.out)
            : pathutil.replaceExt(target.path, process.platform === 'win32' ? '.exe' : '');

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
            const args: string[] = [];
            if (this._cppVersion) {
                args.push(`-std=c++${this._cppVersion}`);
            }
            if (Array.isArray(manifest.includes)) {
                for (const include of manifest.includes) {
                    args.push('-I', resolvePath(include));
                }
            }

            let tmpPath: string;
            if (composer.options.release) {
                args.push('-Os', '-ffast-math', '-flto', '-Wl,--lto-O3');

                const { path, cleanup } = await tmpFile();
                tmpPath = path;
                defer.push(cleanup);

                args.push('-o', path);
            } else {
                args.push('-o-');
            }

            args.push(...(manifest.srcs ?? []).map(resolvePath));

            return await spawn('clang', args);
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
