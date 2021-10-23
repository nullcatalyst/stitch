import * as path from 'path';

export const SEP = ':';

export function getFirst(scheme: string): string {
    return scheme.split(SEP)[0];
}

export function removeFirst(scheme: string): string {
    return scheme.split(SEP).slice(1).join(SEP);
}

export function replaceFirst(scheme: string, newFirst: string): string {
    const list = scheme.split(SEP).slice(1);
    list.unshift(newFirst);
    return list.join(SEP);
}

export function split(scheme: string): string[] {
    return scheme.split(SEP);
}

export function fromExtension(fileNameOrPath: string): string {
    let ext = path.extname(fileNameOrPath);
    if (ext.startsWith('.')) {
        ext = ext.slice(1);
    }
    return ext;
}
