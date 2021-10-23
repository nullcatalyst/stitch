import * as sass from 'sass';
import Composer from '../composer/composer';
import Plugin from '../composer/plugin';
import * as scheme from '../composer/scheme';
import Target from '../composer/target';
import * as pathutil from '../util/path';

export default class SassPlugin extends Plugin {
    override name(): string {
        return 'sass';
    }

    override operatesOn(composer: Composer, target: Target): boolean {
        const _scheme = scheme.getFirst(target.scheme);
        return _scheme === 'sass' || _scheme === 'scss';
    }

    override async transformImpl(composer: Composer, target: Target): Promise<Target> {
        return new Target(
            scheme.replaceFirst(target.scheme, 'css'),
            pathutil.replaceExt(target.path, '.css'),
            target.root,
            compile(composer, target),
        );
    }
}

async function compile(composer: Composer, target: Target): Promise<string> {
    return new Promise(async (resolve, reject) => {
        const data = await target.textContents;
        sass.render(
            {
                file: target.path,
                data,
                outputStyle: composer.options.release ? 'compressed' : 'expanded',
                importer: [
                    // This importer does not appear to ever get called for regular file paths. :(
                    (fileName: string, prev: string) => {
                        const depPath = pathutil.resolveRelative(prev, fileName);
                        composer.addDependencyFor(target.path, depPath);
                        return { file: depPath };
                    },
                    (fileName: string, prev: string, done) => {
                        const depPath = pathutil.resolveRelative(prev, fileName);
                        composer.addDependencyFor(target.path, depPath);
                        done({ file: depPath });
                    },
                ],
            },
            (err: Error, result) => {
                if (err != null) {
                    return reject(err);
                }

                resolve(result.css.toString('utf8'));
            },
        );
    });
}
