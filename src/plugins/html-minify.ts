import * as htmlmin from 'html-minifier-terser';
import Composer from '../composer/composer';
import Plugin from '../composer/plugin';
import * as scheme from '../composer/scheme';
import Target from '../composer/target';

export default class HtmlMinifyPlugin extends Plugin {
    override name(): string {
        return 'html-minify';
    }

    override operatesOn(composer: Composer, target: Target): boolean {
        return composer.options.release && scheme.getFirst(target.scheme) === 'html';
    }

    override async transformImpl(composer: Composer, target: Target): Promise<Target> {
        return new Target(target.scheme, target.path, target.root, compile(composer, target));
    }
}

async function compile(composer: Composer, target: Target): Promise<string> {
    return htmlmin.minify(await target.textContents, {
        collapseWhitespace: true,
        collapseBooleanAttributes: true,
        html5: true,
        removeComments: true,
        removeRedundantAttributes: true,
        sortAttributes: true,
        sortClassName: true,
        useShortDoctype: true,
    });
}
