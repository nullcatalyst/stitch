export class RebuildError extends Error {
    constructor(filePath: string) {
        super(`"${filePath}" changed, rebuilding`);
    }
}

export class FileReadError extends Error {
    constructor(filePath: string) {
        super(`"${filePath}" could not be read`);
    }
}
