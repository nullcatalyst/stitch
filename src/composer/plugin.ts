import Composer from './composer';
import Target from './target';

export default abstract class Plugin {
    abstract name(): string;
    abstract operatesOn(composer: Composer, target: Target): boolean;
    abstract transformImpl(composer: Composer, target: Target): Promise<Target>;

    async transform(composer: Composer, target: Target): Promise<Target> {
        if (!this.operatesOn(composer, target)) {
            return target;
        }

        if (composer.options.verbose) {
            console.log(`running plugin "${this.name()}" on "${target.path}"`);
        }

        return this.transformImpl(composer, target);
    }
}
