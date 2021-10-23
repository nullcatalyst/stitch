import nodeResolve from '@rollup/plugin-node-resolve';
import * as path from 'path';
import * as rollup from 'rollup';
import * as typescript from 'rollup-plugin-typescript2';
import * as pathutil from '../util/path';
import Composer from '../composer/composer';
import Plugin from '../composer/plugin';
import * as scheme from '../composer/scheme';
import Target from '../composer/target';
import replace = require('@rollup/plugin-replace');
import commonjs = require('@rollup/plugin-commonjs');

export default class TsRollupPlugin extends Plugin {
    override name(): string {
        return 'ts-rollup';
    }

    override operatesOn(composer: Composer, target: Target): boolean {
        return scheme.getFirst(target.scheme) === 'ts' || scheme.getFirst(target.scheme) === 'tsx';
    }

    override async transformImpl(composer: Composer, target: Target): Promise<Target> {
        return new Target(
            scheme.replaceFirst(target.scheme, 'js'),
            pathutil.replaceExt(target.path, '.js'),
            target.root,
            build(composer, target),
        );
    }
}

async function build(composer: Composer, input: Target): Promise<string> {
    const inputContents = await input.textContents;
    const bundle = await rollup.rollup({
        input: input.path,
        plugins: [
            {
                name: 'virtual',
                resolveId(id) {
                    if (id === input.path) {
                        return input.path;
                    }
                },
                load(id) {
                    if (id === input.path) {
                        return { code: inputContents };
                    }
                },
            },
            // virtual({
            //     [input.path]: inputContents,
            // }),
            // (typescript as any as typeof import('@rollup/plugin-typescript').default)({
            //     target: 'es2021',
            //     module: 'esnext',
            //     outputToFilesystem: false,
            // }),
            (typescript as any)({
                tsconfig: 'tsconfig.json',
                tsconfigOverride: {
                    compilerOptions: {
                        module: 'esnext',
                    },
                },
            }),
            nodeResolve({
                browser: true,
            }),
            (commonjs as any)({
                include: ['node_modules/**'],
            }),
            (replace as any)({
                preventAssignment: true,
                'process.env.NODE_ENV': composer.options.release
                    ? JSON.stringify('production')
                    : JSON.stringify('development'),
            }),
        ],
    });

    for (let watchFile of bundle.watchFiles) {
        watchFile = path.resolve(watchFile);
        if (watchFile !== input.path) {
            composer.addDependencyFor(input.path, watchFile);
        }
    }

    // generate output specific code in-memory
    // you can call this function multiple times on the same bundle object
    const { output } = await bundle.generate({
        format: 'cjs',
    });

    let outputContents = '';
    for (const chunkOrAsset of output) {
        if (chunkOrAsset.type === 'asset') {
            // For assets, this contains
            // {
            //   fileName: string,              // the asset file name
            //   source: string | Uint8Array    // the asset source
            //   type: 'asset'                  // signifies that this is an asset
            // }
            console.log(`WARN: unused rollup asset: ${chunkOrAsset.fileName}`);
        } else {
            // For chunks, this contains
            // {
            //   code: string,                  // the generated JS code
            //   dynamicImports: string[],      // external modules imported dynamically by the chunk
            //   exports: string[],             // exported variable names
            //   facadeModuleId: string | null, // the id of a module that this chunk corresponds to
            //   fileName: string,              // the chunk file name
            //   implicitlyLoadedBefore: string[]; // entries that should only be loaded after this chunk
            //   imports: string[],             // external modules imported statically by the chunk
            //   importedBindings: {[imported: string]: string[]} // imported bindings per dependency
            //   isDynamicEntry: boolean,       // is this chunk a dynamic entry point
            //   isEntry: boolean,              // is this chunk a static entry point
            //   isImplicitEntry: boolean,      // should this chunk only be loaded after other chunks
            //   map: string | null,            // sourcemaps if present
            //   modules: {                     // information about the modules in this chunk
            //     [id: string]: {
            //       renderedExports: string[]; // exported variable names that were included
            //       removedExports: string[];  // exported variable names that were removed
            //       renderedLength: number;    // the length of the remaining code in this module
            //       originalLength: number;    // the original length of the code in this module
            //       code: string | null;       // remaining code in this module
            //     };
            //   },
            //   name: string                   // the name of this chunk as used in naming patterns
            //   referencedFiles: string[]      // files referenced via import.meta.ROLLUP_FILE_URL_<id>
            //   type: 'chunk',                 // signifies that this is a chunk
            // }
            // console.log('Chunk', chunkOrAsset.modules);

            if (chunkOrAsset.fileName === pathutil.replaceExt(path.basename(input.path), '.js')) {
                outputContents = chunkOrAsset.code;
            } else {
                console.log(`WARN: unused code chunk: ${chunkOrAsset.fileName}`);
            }
        }
    }

    await bundle.close();
    return outputContents;
}
