import Composer from '../composer/composer';
import Plugin from '../composer/plugin';
import * as scheme from '../composer/scheme';
import Target from '../composer/target';
import * as pathutil from '../util/path';

export default class GlslPlugin extends Plugin {
    override name(): string {
        return 'glsl';
    }

    override operatesOn(composer: Composer, target: Target): boolean {
        return composer.options.release && scheme.getFirst(target.scheme) === 'glsl';
    }

    override async transformImpl(composer: Composer, target: Target): Promise<Target> {
        return new Target(
            target.scheme,
            pathutil.replaceExt(target.path, '.html'),
            target.root,
            compile(composer, target),
        );
    }
}

async function compile(composer: Composer, target: Target): Promise<string | Buffer> {
    if (!composer.options.release) {
        return target.contents;
    }

    let content = (await target.textContents)
        .split('\n')
        .map((line, i, array) => {
            line = line.replace(/\s+/g, ' ');
            if (line.startsWith('#')) {
                if (i !== 0) {
                    line = `\n${line}`;
                }
                if (i !== array.length - 1) {
                    line = `${line}\n`;
                }
            }
            return line;
        })
        .join(' ');

    // Remove spaces between words and punctuation.
    // This needs to be repeated until no more replacements are made.
    for (;;) {
        const prevContent = content;
        content = content
            .replace(/([a-z0-9_]) ([^a-z0-9_])/gi, '$1$2')
            .replace(/([^a-z0-9_]) ([a-z0-9_])/gi, '$1$2')
            .replace(/([^a-z0-9_]) ([^a-z0-9_])/gi, '$1$2');

        if (content === prevContent) {
            break;
        }
    }

    return content;
}
