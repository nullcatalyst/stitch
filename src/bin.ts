import { Command } from 'commander';
import * as fs from 'fs';
import * as json5 from 'json5';
import * as path from 'path';
import * as scheme from './composer/scheme';
import Composer from './composer/composer';
import CargoWasmPlugin from './plugins/cargo-wasm';
import CopyFilePlugin from './plugins/copy-file';
import CppWasmPlugin from './plugins/cpp-wasm';
import CssClassMinifyPlugin from './plugins/css-class-minify';
import EjsPlugin from './plugins/ejs';
import GlslPlugin from './plugins/glsl';
import HtmlMinifyPlugin from './plugins/html-minify';
import LoadFilePlugin from './plugins/load-file';
import SassPlugin from './plugins/sass';
import TerserPlugin from './plugins/terser';
import ToBase64Plugin from './plugins/to-base64';
import TsRollupPlugin from './plugins/ts-rollup';
import VirtualFilePlugin from './plugins/virtual-file';
import * as glob from 'glob';
import {promisify} from 'util';
import { Options as PipelineOptions } from './composer/pipeline';

const globP = promisify(glob);

const program = new Command();
program.version('0.0.1').option('-v, --verbose', 'enable verbose logging', (_, prev) => prev + 1, 0);
program
    .command('build')
    .description('build the project from scratch')
    .option('--release', 'build the release version')
    .option('-c, --config <file>', 'manifest to build')
    .option('-f, --file <file>', 'file to build')
    .option('-d, --directory <directory>', 'directory in which to build all the files')
    .option('-o, --output <output>', 'output directory to save files into')
    .option('-r, --root <root>', 'root directory for input files')
    .action(async (options, command) => {
        options = mergeParentOptions(options, command);
        const composer = addDefaultPlugins(
            new Composer({
                verbose: options.verbose,
                release: options.release ?? false,
            }),
        );

        if (options.root == null || options.root === '') {
            options.root = process.cwd();
        }

        if (options.file != null) {
            if (options.verbose) {
                console.info(`building file "${options.file}"`);
            }
            composer.loadFile(options.file, {
                output: path.resolve(options.output),
                root: path.resolve(options.root),
            });
        }

        if (options.config != null) {
            await parseManifest(composer, options.config);
        }

        composer.build().catch(console.error);
    });
program
    .command('watch')
    .description('build the project, then watch and rebuild on changes')
    .option('--release', 'build the release version')
    .option('-c, --config <file>', 'manifest to build')
    .option('-f, --file <file>', 'file to build')
    .option('-d, --directory <directory>', 'directory in which to build all the files')
    .option('-o, --output <output>', 'output directory to save files into')
    .option('-r, --root <root>', 'root directory for input files')
    .action(async (options, command) => {
        options = mergeParentOptions(options, command);
        const composer = addDefaultPlugins(
            new Composer({
                verbose: options.verbose,
                release: options.release ?? false,
            }),
        );

        if (options.root == null || options.root === '') {
            options.root = process.cwd();
        }

        if (options.file != null) {
            if (options.verbose) {
                console.info(`building file "${options.file}"`);
            }

            await composerLoadGlob(composer, path.resolve(options.file), {
                output: path.resolve(options.output),
                root: path.resolve(options.root),
            });
        }

        if (options.config != null) {
            await parseManifest(composer, options.config);
        }

        composer.watch(options.root).catch(console.error);
    });

program.parse(process.argv);

function addDefaultPlugins(composer: Composer): Composer {
    composer
        .addPlugin(new LoadFilePlugin())
        .addPlugin(new VirtualFilePlugin())
        .addPlugin(new ToBase64Plugin())
        .addPlugin(new CopyFilePlugin())
        .addPlugin(new CargoWasmPlugin())
        .addPlugin(new CppWasmPlugin().enableFeatureMultivalue(true))
        .addPlugin(new EjsPlugin())
        .addPlugin(new SassPlugin())
        .addPlugin(new GlslPlugin())
        .addPlugin(new TsRollupPlugin())
        .addPlugin(new CssClassMinifyPlugin())
        .addPlugin(new TerserPlugin())
        .addPlugin(new HtmlMinifyPlugin());
    return composer;
}

function mergeParentOptions(options: any, command: Command): any {
    if (command.parent == null) {
        return options;
    }
    return Object.assign({}, command.parent.opts(), options);
}

async function parseManifest(composer: Composer, manifestFileName: string): Promise<void> {
    if (composer.options.verbose) {
        console.info(`reading manifest file "${manifestFileName}"`);
    }

    const manifestFilePath = path.resolve(manifestFileName);
    const manifestDirPath = path.resolve(manifestFilePath, '..');

    const manifestContents = await fs.promises.readFile(manifestFilePath, { encoding: 'utf8' });
    const manifest = json5.parse(manifestContents) as Readonly<Manifest>;

    const rootDir =
        manifest.root != null && manifest.root !== '' ? path.join(manifestDirPath, manifest.root) : manifestDirPath;
    function resolveInputPath(relativePath: string | undefined) {
        if (relativePath == null) {
            throw new Error('cannot resolve input path to <null>');
        }
        return path.join(rootDir, relativePath);
    }

    const outDir =
        manifest.out != null && manifest.out !== '' ? path.join(manifestDirPath, manifest.out) : manifestDirPath;
    function resolveOutputPath(relativePath: string | undefined) {
        if (relativePath == null) {
            return outDir;
        }
        return path.join(outDir, relativePath);
    }

    for (const src of manifest.srcs) {
        if (typeof src === 'string') {
            const schemeSep = src.lastIndexOf(scheme.SEP);
            let inputScheme: null|string = null;
            let input = src;
            if (schemeSep >= 0) {
                inputScheme = src.slice(0, schemeSep);
                input = src.slice(schemeSep + scheme.SEP.length);
            }

            await composerLoadGlob(composer, resolveInputPath(input), {
                scheme: inputScheme,
                output: resolveOutputPath('./'),
                root: resolveInputPath('./'),
            });
        } else {
            await composerLoadGlob(composer, resolveInputPath(src.in), {
                scheme: src.scheme,
                output: resolveOutputPath(src.out || './'),
                root: resolveInputPath(src.root || './'),
            });
        }
    }
}

async function composerLoadGlob(composer: Composer, inputGlob: string, options: PipelineOptions) {
    for (const input of await globP(inputGlob)) {
        composer.loadFile(input, options);
    }
}

type Source =
    | string
    | {
          scheme: string;
          in: string;
          out?: string;
          root?: string;
      };

interface Manifest {
    out: string;
    srcs: Source[];
    root: string;
}
