import * as chokidar from 'chokidar';
import * as path from 'path';
import VirtualFilePlugin from '../plugins/virtual-file';
import TwoWayMap from '../util/two-way-map';
import Pipeline, { Options as PipelineOptions } from './pipeline';
import Plugin from './plugin';
import Target from './target';

interface Options {
    /** Print messages for each action the build does as it does them. */
    verbose: boolean;

    /** Output the minified/optimized/release version of the build. */
    release: boolean;
}

export default class Composer {
    readonly options: Readonly<Options>;
    readonly plugins: Plugin[] = [];
    readonly pipelines = new Map<string, Pipeline>();
    readonly dependencies = new TwoWayMap<string, string>();

    constructor(options: Options) {
        this.options = Object.assign({}, options);
    }

    addPlugin(plugin: Plugin): Composer {
        if (this.options.verbose) {
            console.log(`loading plugin "${plugin.name()}"`);
        }

        this.plugins.push(plugin);
        return this;
    }

    loadFile(fileName: string, options: PipelineOptions): Pipeline {
        const filePath = path.resolve(fileName);
        let pipeline = this.pipelines.get(filePath);
        if (pipeline == null) {
            pipeline = new Pipeline(this, filePath, options);
            this.pipelines.set(filePath, pipeline);
        }
        return pipeline;
    }

    virtualFile(fileName: string, contents: string | Buffer, options: PipelineOptions): Pipeline {
        const plugin = this.plugins.find(plugin => plugin instanceof VirtualFilePlugin) as VirtualFilePlugin;
        if (plugin == null) {
            throw new Error('no virtual file plugin initialized');
        }

        const filePath = path.resolve(fileName);
        plugin.set(filePath, contents);

        let pipeline = this.pipelines.get(filePath);
        if (pipeline == null) {
            pipeline = new Pipeline(this, filePath, options);
            this.pipelines.set(filePath, pipeline);
        }
        return pipeline;
    }

    addDependencyFor(fileName: string, dependsOn: string): Composer {
        if (this.options.verbose) {
            console.log(`adding dependency "${dependsOn}" for "${fileName}"`);
        }

        this.dependencies.set(fileName, dependsOn);
        return this;
    }

    clearDependenciesFor(fileName: string): Composer {
        if (this.options.verbose) {
            console.log(`resetting dependencies for "${fileName}"`);
        }

        this.dependencies.delete(fileName);
        return this;
    }

    async triggerPipeline(fileName: string): Promise<Target> {
        if (this.options.verbose) {
            console.log(`triggering pipeline for "${fileName}"`);
        }

        const pipeline = this.pipelines.get(fileName);
        if (pipeline == null) {
            return Promise.reject(new Error('pipeline does not exist'));
        }

        return pipeline.rebuild();
    }

    build(): Promise<void> {
        return Promise.all(
            Array.from(this.pipelines.values()).map(pipeline => {
                if (this.options.verbose) {
                    console.info(`building file "${pipeline.inputPath}"`);
                }

                return pipeline.build();
            }),
        ).then(() => {
            if (this.options.verbose) {
                console.log('DONE');
            }
        });
    }

    async watch(watchFolder: string): Promise<void> {
        await this.build();

        chokidar
            .watch(watchFolder, {
                atomic: true,
            })
            .on('all', async (event, fileName) => {
                if (event != 'change') {
                    return;
                }

                const filePath = path.resolve(watchFolder, '..', fileName);
                if (this.options.verbose) {
                    console.log(`file "${filePath}" changed`);
                }

                await Promise.all([
                    this.triggerPipeline(filePath).catch(() => {}),
                    ...this.dependencies
                        .getReverse(filePath)
                        .map(async filePath => this.triggerPipeline(filePath).catch(() => {})),
                ]);
            });
    }
}
