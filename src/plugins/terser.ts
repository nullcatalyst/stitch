import * as terser from 'terser';
import Composer from '../composer/composer';
import Plugin from '../composer/plugin';
import * as scheme from '../composer/scheme';
import Target from '../composer/target';

export default class TerserPlugin extends Plugin {
    override name(): string {
        return 'terser';
    }

    override operatesOn(composer: Composer, target: Target): boolean {
        return composer.options.release && scheme.getFirst(target.scheme) === 'js';
    }

    override async transformImpl(composer: Composer, target: Target): Promise<Target> {
        return new Target(target.scheme, target.path, target.root, minify(composer, target));
    }
}

async function minify(composer: Composer, target: Target): Promise<string> {
    const result = await terser.minify(await target.textContents, {
        compress: true,
        toplevel: true,
        mangle: {
            keep_classnames: false,
            keep_fnames: false,
            module: false,
            properties: {
                builtins: false,
                debug: false,
                keep_quoted: true,
                regex: /^_/,
            },
            toplevel: true,
        },
        output: {
            comments: false,
        },
    });
    let code = result.code;
    code = code.replaceAll('"+"', '');
    // code = code.replaceAll("'+'", '');
    return code;
}
