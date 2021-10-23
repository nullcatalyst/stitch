import Composer from '../composer/composer';
import Plugin from '../composer/plugin';
import * as scheme from '../composer/scheme';
import Target from '../composer/target';

export default class VirtualFilePlugin extends Plugin {
    private _files = new Map<string, string | Buffer>();

    set(filePath: string, contents: string | Buffer) {
        this._files.set(filePath, contents);
    }

    override name(): string {
        return 'virtual-file';
    }

    override operatesOn(composer: Composer, target: Target): boolean {
        return scheme.getFirst(target.scheme) === 'virtual';
    }

    override async transformImpl(composer: Composer, target: Target): Promise<Target> {
        return new Target(
            scheme.removeFirst(target.scheme),
            target.path,
            target.root,
            Promise.resolve(this._files.get(target.path)),
        );
    }
}
