import * as fs from 'fs';
import * as path from 'path';
import Composer from '../composer/composer';
import Plugin from '../composer/plugin';
import * as scheme from '../composer/scheme';
import Target from '../composer/target';

export default class CopyFilePlugin extends Plugin {
    override name(): string {
        return 'copy-file';
    }

    override operatesOn(composer: Composer, target: Target): boolean {
        return scheme.getFirst(target.scheme) === 'copy';
    }

    override async transformImpl(composer: Composer, target: Target): Promise<Target> {
        return new Target(
            scheme.removeFirst(target.scheme),
            target.path,
            target.root,
            (async () => {
                const pipeline = composer.loadFile(target.path, { root: target.root });
                const stat = await fs.promises.stat(target.path);
                if (stat.isDirectory()) {
                    await Promise.all(
                        (
                            await fs.promises.readdir(target.path)
                        ).map(async fileName =>
                            composer
                                .loadFile(path.join(target.path, fileName), {
                                    scheme: 'copy',
                                    root: pipeline.rootPath,
                                    output: pipeline.outputPath,
                                })
                                .build(),
                        ),
                    );
                }

                return target.contents;
            })(),
        );
    }
}
