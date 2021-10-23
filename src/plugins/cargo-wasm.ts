import * as childProcess from 'child_process';
import * as path from 'path';
import Composer from '../composer/composer';
import Plugin from '../composer/plugin';
import * as scheme from '../composer/scheme';
import Target from '../composer/target';
import * as pathutil from '../util/path';

export default class CargoWasmPlugin extends Plugin {
    override name(): string {
        return 'cargo-wasm';
    }

    override operatesOn(composer: Composer, target: Target): boolean {
        return scheme.getFirst(target.scheme) === 'cargo';
    }

    override async transformImpl(composer: Composer, target: Target): Promise<Target> {
        return new Target(
            scheme.replaceFirst(target.scheme, 'wasm'),
            pathutil.replaceExt(target.path, '.wasm'),
            target.root,
            compile(composer, target.path),
        );
    }
}

function compile(composer: Composer, fileName: string): Promise<string> {
    // `fileName` should point to `.../<workspace>/<project>/src/(main|lib).rs`
    // Get the project directory from the file name.
    const projectDir = path.resolve(fileName, '..');

    return new Promise((resolve, reject) => {
        const child = childProcess.exec(
            `cargo build --target=wasm32-unknown-unknown ${
                composer.options.release ? '--release' : ''
            } --package=${path.basename(projectDir)}`,
            {
                cwd: path.dirname(projectDir),
            },
            (err, stdout, stderr) => {
                if (err != null) {
                    return reject(err);
                }

                resolve('');
            },
        );
    });
}
