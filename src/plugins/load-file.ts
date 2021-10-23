import * as fs from 'fs';
import Composer from '../composer/composer';
import Plugin from '../composer/plugin';
import * as scheme from '../composer/scheme';
import Target from '../composer/target';

export default class LoadFilePlugin extends Plugin {
    override name(): string {
        return 'load-file';
    }

    override operatesOn(composer: Composer, target: Target): boolean {
        return scheme.getFirst(target.scheme) !== 'virtual';
    }

    override async transformImpl(composer: Composer, target: Target): Promise<Target> {
        return new Target(target.scheme, target.path, target.root, load(composer, target));
    }
}

async function load(composer: Composer, target: Target): Promise<string | Buffer> {
    try {
        const stat = await fs.promises.stat(target.path);
        if (stat.isFile()) {
            return fs.promises.readFile(target.path);
        }
    } catch (err: unknown) {
        if (composer.options.verbose) {
            console.log(`failed to read file "${target.path}": ${err}`);
        }
    }

    // throw new FileReadError(target.path);
}
