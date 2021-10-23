import Composer from '../composer/composer';
import File from '../composer/target';
import CssClassPlugin from './css-class-minify';

describe('CssClassMinifyPlugin', () => {
    const composer = new Composer({
        verbose: false,
        release: true,
    });
    const plugin = new CssClassPlugin();

    describe('html', () => {
        test('class attributes', async () => {
            const result = await plugin.transformImpl(
                composer,
                new File('html', 'file.html', '', Promise.resolve('<div class="class list">testing</div>')),
            );
            expect(await result.textContents).toStrictEqual('<div class="a b">testing</div>');
        });

        test('lots of classes', async () => {
            const result = await plugin.transformImpl(
                composer,
                new File(
                    'html',
                    'file.html',
                    '',
                    Promise.resolve(
                        `<div class="${Array(30)
                            .fill(0)
                            .map((_value, index) => `class${index}`)
                            .join(' ')}">testing</div>`,
                    ),
                ),
            );
            expect(await result.textContents).toStrictEqual(
                '<div class="a b c d e f g h i j k l m n o p q r s t u v w x y z A B C D">testing</div>',
            );
        });

        test('prioritize class names that are used more often', async () => {
            const result = await plugin.transformImpl(
                composer,
                new File(
                    'html',
                    'file.html',
                    '',
                    Promise.resolve(`<div class="class1 class2 class3 class3 class3">testing</div>`),
                ),
            );
            expect(await result.textContents).toStrictEqual('<div class="b c a a a">testing</div>');
        });
    });

    describe('css', () => {
        test('style tag', async () => {
            const result = await plugin.transformImpl(
                composer,
                new File(
                    'html',
                    'file.html',
                    '',
                    Promise.resolve('<style>.these.are.class.names { color:$000; }</style>'),
                ),
            );
            expect(await result.textContents).toStrictEqual('<style>.a.b.c.d { color:$000; }</style>');
        });

        test('no false positives outside style tag', async () => {
            const result = await plugin.transformImpl(
                composer,
                new File('html', 'file.html', '', Promise.resolve('<div>.className { color:$000; }</div>')),
            );
            expect(await result.textContents).toStrictEqual('<div>.className { color:$000; }</div>');
        });

        test('style tag with attributes', async () => {
            const result = await plugin.transformImpl(
                composer,
                new File(
                    'html',
                    'file.html',
                    '',
                    Promise.resolve('<style class="className" hidden>.className { color:$000; }</style>'),
                ),
            );
            expect(await result.textContents).toStrictEqual('<style class="a" hidden>.a { color:$000; }</style>');
        });

        test('decimal property values', async () => {
            const result = await plugin.transformImpl(
                composer,
                new File('html', 'file.html', '', Promise.resolve('<style>.class.names { margin: 0.5rem; }</style>')),
            );
            expect(await result.textContents).toStrictEqual('<style>.a.b { margin: 0.5rem; }</style>');
        });
    });

    describe('js', () => {
        test('script tag', async () => {
            const result = await plugin.transformImpl(
                composer,
                new File('html', 'file.html', '', Promise.resolve('<script>$css("className")</script>')),
            );
            expect(await result.textContents).toStrictEqual('<script>"a"</script>');
        });

        test('no false positives outside script tag', async () => {
            const result = await plugin.transformImpl(
                composer,
                new File('html', 'file.html', '', Promise.resolve('<div>$css("className")</div>')),
            );
            expect(await result.textContents).toStrictEqual('<div>$css("className")</div>');
        });

        test('script tag with attributes', async () => {
            const result = await plugin.transformImpl(
                composer,
                new File(
                    'html',
                    'file.html',
                    '',
                    Promise.resolve('<script class="className" hidden>$css("className")</script>'),
                ),
            );
            expect(await result.textContents).toStrictEqual('<script class="a" hidden>"a"</script>');
        });

        test('single quotes', async () => {
            const result = await plugin.transformImpl(
                composer,
                new File('html', 'file.html', '', Promise.resolve(`<script>$css('className')</script>`)),
            );
            expect(await result.textContents).toStrictEqual(`<script>'a'</script>`);
        });

        test('double quotes', async () => {
            const result = await plugin.transformImpl(
                composer,
                new File('html', 'file.html', '', Promise.resolve(`<script>$css("className")</script>`)),
            );
            expect(await result.textContents).toStrictEqual(`<script>"a"</script>`);
        });

        test('dot single quotes', async () => {
            const result = await plugin.transformImpl(
                composer,
                new File('html', 'file.html', '', Promise.resolve(`<script>$css('.className')</script>`)),
            );
            expect(await result.textContents).toStrictEqual(`<script>'.a'</script>`);
        });

        test('dot double quotes', async () => {
            const result = await plugin.transformImpl(
                composer,
                new File('html', 'file.html', '', Promise.resolve(`<script>$css(".className")</script>`)),
            );
            expect(await result.textContents).toStrictEqual(`<script>".a"</script>`);
        });
    });
});
