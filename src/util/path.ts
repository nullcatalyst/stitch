import * as path from 'path';

/**
 * Replace the extension of the given file name with the given extension.
 *
 * @param fileName the old name of the file
 * @param ext the new extension to use
 * @returns the file name with the extension replaced with ext
 */
export function replaceExt(fileName: string, ext: string): string {
    return fileName.slice(0, -path.extname(fileName).length) + ext;
}

/**
 * Resolve a relative path from one file to another.
 *
 * @param from the original file path
 * @param to the relative path to a new file from the original one
 * @returns a new file path
 */
export function resolveRelative(from: string, to: string): string {
    const dirName = from.endsWith(path.sep) ? from : path.dirname(from);
    return path.resolve(dirName, to);
}
