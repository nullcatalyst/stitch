import * as ejs from 'ejs';
import * as fs from 'fs';
import * as path from 'path';
import Composer from '../composer/composer';
import Plugin from '../composer/plugin';
import * as scheme from '../composer/scheme';
import Target from '../composer/target';
import * as pathutil from '../util/path';

export default class EjsPlugin extends Plugin {
    override name(): string {
        return 'ejs';
    }

    override operatesOn(composer: Composer, target: Target): boolean {
        return scheme.getFirst(target.scheme) === 'ejs';
    }

    override async transformImpl(composer: Composer, target: Target): Promise<Target> {
        return new Target(
            scheme.replaceFirst(target.scheme, 'html'),
            pathutil.replaceExt(target.path, '.html'),
            target.root,
            compile(composer, target),
        );
    }
}

interface Options {
    scheme: string;
    contents: string;
}

async function compile(composer: Composer, target: Target): Promise<string> {
    return ejs.render(
        await target.textContents,
        {
            build: async (fileName: string, options: Readonly<Partial<Options>> = {}) => {
                const depPath = pathutil.resolveRelative(target.root, fileName);
                const pipeline =
                    options.contents != null
                        ? composer.virtualFile(depPath, options.contents, {
                              scheme: options.scheme,
                              root: target.root,
                          })
                        : composer.loadFile(depPath, {
                              scheme: options.scheme,
                              root: target.root,
                          });

                const output = await pipeline.build();
                composer.addDependencyFor(target.path, depPath);
                for (const dependency of composer.dependencies.get(depPath)) {
                    composer.addDependencyFor(target.path, dependency);
                }
                // if (!pipeline.output) {
                //     composer.dependencies.delete(depPath);
                // }
                return output.textContents;
            },
        },
        {
            filename: target.path,
            async: true,
            strict: true,
            _with: false,
            localsName: '$',
            includer: (fileName: string, fromFilePath: string) => {
                const depPath = path.resolve(fromFilePath ?? '');
                composer.addDependencyFor(target.path, depPath);
                return {
                    filename: depPath,
                    template: fs.readFileSync(depPath, { encoding: 'utf8' }),
                };
            },
        } as ejs.Options & { async: true },
    );
}
