import Composer from '../composer/composer';
import Plugin from '../composer/plugin';
import * as scheme from '../composer/scheme';
import Target from '../composer/target';

export default class CssClassMinifyPlugin extends Plugin {
    override name(): string {
        return 'css-class-minify';
    }

    override operatesOn(composer: Composer, target: Target): boolean {
        return scheme.getFirst(target.scheme) === 'html';
    }

    override async transformImpl(composer: Composer, target: Target): Promise<Target> {
        return new Target(target.scheme, target.path, target.root, minify(composer, target));
    }
}

async function minify(composer: Composer, target: Target): Promise<string | Buffer> {
    let contents = (await target.textContents) ?? '';

    if (composer.options.release) {
        const cssClassCount = new Map<string, number>();
        prepHtml(composer, contents, cssClassCount);
        prepCss(composer, contents, cssClassCount);
        prepJs(composer, contents, cssClassCount);

        const mapping = generateMapping(cssClassCount);
        contents = replaceHtml(composer, contents, mapping);
        contents = replaceCss(composer, contents, mapping);
        contents = replaceJs(composer, contents, mapping);
    } else {
        contents = replaceDebugJs(composer, contents);
    }

    return contents;
}

function useClass(cssClassCount: Map<string, number>, className: string) {
    cssClassCount.set(className, (cssClassCount.get(className) ?? 0) + 1);
}

function generateMapping(cssClassCount: Map<string, number>): Map<string, string> {
    let name = '';
    const mapping = new Map<string, string>();
    const entries = [];
    entries.push(...cssClassCount.entries());
    entries
        .sort((a, b) => b[1] - a[1])
        .forEach(([className, _count]) => {
            name = nextName(name);
            mapping.set(className, name);
        });
    return mapping;
}

const LETTER_ORDER = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

function nextName(name: string): string {
    if (name === '') {
        return LETTER_ORDER[0];
    }

    let last = name.slice(-1);
    const index = LETTER_ORDER.indexOf(last);
    if (index < 0) {
        return name + LETTER_ORDER[0];
    } else if (index + 1 < LETTER_ORDER.length) {
        return name.slice(0, -1) + LETTER_ORDER[index + 1];
    } else {
        return nextName(name.slice(0, -1)) + LETTER_ORDER[0];
    }
}

const HTML_CLASS_REGEX = /class="([-_a-z0-9 ]+)"/gi;

function prepHtml(composer: Composer, contents: string, cssClassCount: Map<string, number>) {
    for (const [_match, classList] of contents.matchAll(HTML_CLASS_REGEX)) {
        classList
            .trim()
            .split(/\s+/)
            .forEach(className => {
                useClass(cssClassCount, className);
            });
    }
}

function replaceHtml(composer: Composer, contents: string, mapping: Map<string, string>): string {
    return contents.replaceAll(HTML_CLASS_REGEX, (_match, classList) => {
        return `class="${classList
            .trim()
            .split(/\s+/)
            .map(className => mapping.get(className))
            .join(' ')}"`;
    });
}

const CSS_STYLE_TAG_REGEX = /<style([^>]*)>([^<]*)<\/style>/gi;
const CSS_CLASS_REGEX = /\.([-_a-z0-9]+)|((?<!@media\s*\([^)]*\)\s*)\{[^\}]*\})|('[^']*')|("[^"]*")/gi;

function prepCss(composer: Composer, contents: string, cssClassCount: Map<string, number>) {
    for (let [_match, _attributes, tagContents] of contents.matchAll(CSS_STYLE_TAG_REGEX)) {
        if (tagContents == null) {
            continue;
        }

        for (let [_match, className] of tagContents.matchAll(CSS_CLASS_REGEX)) {
            if (className == null) {
                continue;
            }
            useClass(cssClassCount, className);
        }
    }
}

function replaceCss(composer: Composer, contents: string, mapping: Map<string, string>): string {
    return contents.replaceAll(CSS_STYLE_TAG_REGEX, (match, attributes, tagContents) => {
        if (tagContents == null) {
            return match;
        }

        return `<style${attributes}>${tagContents.replaceAll(CSS_CLASS_REGEX, (match, className) => {
            if (className == null) {
                return match;
            }
            return `.${mapping.get(className)}`;
        })}</style>`;
    });
}

const JS_SCRIPT_TAG_REGEX = /<script([^>]*)>([\s\S]*)(?<!<\/script>)<\/script>/gi;
const JS_CLASS_REGEX = /\$css\('([^']+)'\)|\$css\("([^"]+)"\)/gi;

function prepJs(composer: Composer, contents: string, cssClassCount: Map<string, number>) {
    for (let [_match, _attributes, tagContents] of contents.matchAll(JS_SCRIPT_TAG_REGEX)) {
        if (tagContents == null) {
            continue;
        }

        for (let [_match, singleQuoteClassName, doubleQuoteClassName] of tagContents.matchAll(JS_CLASS_REGEX)) {
            if (singleQuoteClassName != null) {
                useClass(
                    cssClassCount,
                    singleQuoteClassName.startsWith('.') ? singleQuoteClassName.slice(1) : singleQuoteClassName,
                );
            } else if (doubleQuoteClassName != null) {
                useClass(
                    cssClassCount,
                    doubleQuoteClassName.startsWith('.') ? doubleQuoteClassName.slice(1) : doubleQuoteClassName,
                );
            } else {
                throw new Error(
                    `unreachable: the className in "$css(<className>)" must be surrounded by either single ' or double quotes "`,
                );
            }
        }
    }
}

function replaceJs(composer: Composer, contents: string, mapping: Map<string, string>): string {
    return contents.replaceAll(JS_SCRIPT_TAG_REGEX, (match, attributes, tagContents) => {
        if (tagContents == null) {
            return match;
        }

        return `<script${attributes}>${tagContents.replaceAll(
            JS_CLASS_REGEX,
            (_match, singleQuoteClassName, doubleQuoteClassName) => {
                if (singleQuoteClassName != null) {
                    return singleQuoteClassName.startsWith('.')
                        ? `'.${mapping.get(singleQuoteClassName.slice(1))}'`
                        : `'${mapping.get(singleQuoteClassName)}'`;
                } else if (doubleQuoteClassName != null) {
                    return doubleQuoteClassName.startsWith('.')
                        ? `".${mapping.get(doubleQuoteClassName.slice(1))}"`
                        : `"${mapping.get(doubleQuoteClassName)}"`;
                } else {
                    throw new Error(
                        `unreachable: the className in "$css(<className>)" must be surrounded by either single ' or double quotes "`,
                    );
                }
            },
        )}</script>`;
    });
}

function replaceDebugJs(composer: Composer, contents: string): string {
    return contents.replaceAll(JS_SCRIPT_TAG_REGEX, (match, attributes, tagContents) => {
        if (tagContents == null) {
            return match;
        }

        return `<script${attributes}>${tagContents.replaceAll(
            JS_CLASS_REGEX,
            (_match, singleQuoteClassName, doubleQuoteClassName) => {
                if (singleQuoteClassName != null) {
                    return `'${singleQuoteClassName}'`;
                } else if (doubleQuoteClassName != null) {
                    return `"${doubleQuoteClassName}"`;
                } else {
                    throw new Error(
                        `unreachable: the className in "$css(<className>)" must be surrounded by either single ' or double quotes "`,
                    );
                }
            },
        )}</script>`;
    });
}
