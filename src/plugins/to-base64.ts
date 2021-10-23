import Composer from '../composer/composer';
import Plugin from '../composer/plugin';
import * as scheme from '../composer/scheme';
import Target from '../composer/target';

export default class ToBase64Plugin extends Plugin {
    override name(): string {
        return 'to-base64';
    }

    override operatesOn(composer: Composer, target: Target): boolean {
        return scheme.getFirst(target.scheme) === 'to-base64';
    }

    override async transformImpl(composer: Composer, target: Target): Promise<Target> {
        return new Target(
            scheme.removeFirst(target.scheme),
            target.path,
            target.root,
            (async () => Buffer.from(await target.contents).toString('base64'))(),
        );
    }
}
