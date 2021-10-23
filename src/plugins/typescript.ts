import * as path from 'path';
import * as tsc from 'typescript';
import Composer from '../composer/composer';
import Plugin from '../composer/plugin';
import * as scheme from '../composer/scheme';
import Target from '../composer/target';
import * as pathutil from '../util/path';

export default class TsPlugin extends Plugin {
    override name(): string {
        return 'typescript';
    }

    override operatesOn(composer: Composer, target: Target): boolean {
        return scheme.getFirst(target.scheme) === 'ts' || scheme.getFirst(target.scheme) === 'tsx';
    }

    override async transformImpl(composer: Composer, target: Target): Promise<Target> {
        const outputFilePath = pathutil.replaceExt(target.path, '.js');
        return new Target(
            scheme.replaceFirst(target.scheme, 'js'),
            outputFilePath,
            target.root,
            compile(composer, target.path, {
                noEmitOnError: true,
                noImplicitAny: true,
                target: tsc.ScriptTarget.ES2021,
                module: tsc.ModuleKind.AMD,
                outFile: outputFilePath,
            }),
        );
    }
}

function compile(composer: Composer, fileName: string, options: tsc.CompilerOptions): Promise<string> {
    return new Promise((resolve, reject) => {
        const compilerHost = tsc.createCompilerHost(options);
        const getSourceFile = compilerHost.getSourceFile;
        compilerHost.getSourceFile = (
            includeFileName: string,
            languageVersion: tsc.ScriptTarget,
            onError?: (message: string) => void,
            shouldCreateNewSourceFile?: boolean,
        ) => {
            includeFileName = path.resolve(includeFileName);
            const result = getSourceFile(includeFileName, languageVersion, onError, shouldCreateNewSourceFile);
            if (
                result != null &&
                includeFileName.indexOf(`${path.sep}node_modules${path.sep}`) < 0 &&
                fileName != includeFileName
            ) {
                composer.addDependencyFor(fileName, includeFileName);
            }
            return result;
        };

        const program = tsc.createProgram([fileName], options, compilerHost);
        const emitResult = program.emit(
            undefined,
            (
                outputFileName: string,
                data: string,
                writeByteOrderMark: boolean,
                onError?: (message: string) => void,
                sourceFiles?: readonly tsc.SourceFile[],
            ) => {
                outputFileName = path.resolve(outputFileName);
                if (outputFileName === pathutil.replaceExt(fileName, '.js')) {
                    resolve(data);
                }
            },
        );

        if (emitResult.emitSkipped) {
            reject(new Error(`failed to compile typescript file "${fileName}"`));
        }

        if (composer.options.verbose) {
            const allDiagnostics = tsc.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);

            allDiagnostics.forEach(diagnostic => {
                if (diagnostic.file) {
                    const { line, character } = tsc.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start!);
                    const message = tsc.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
                    console.log(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
                } else {
                    console.log(tsc.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
                }
            });
        }
    });
}
