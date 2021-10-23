import TwoWayMap from './two-way-map';

describe('TwoWayMap', () => {
    test('empty', () => {
        const map = new TwoWayMap();

        expect(map.get('1')).toStrictEqual([]);
        expect(map.getReverse('1')).toStrictEqual([]);
    });

    test('single entry', () => {
        const map = new TwoWayMap();

        map.set('1', '2');

        expect(map.get('1')).toStrictEqual(['2']);
        expect(map.getReverse('2')).toStrictEqual(['1']);
    });

    test('set reverse', () => {
        const map = new TwoWayMap();

        map.setReverse('2', '1');

        expect(map.get('1')).toStrictEqual(['2']);
        expect(map.getReverse('2')).toStrictEqual(['1']);
    });

    test('multiple entries', () => {
        const map = new TwoWayMap();

        map.set('1', '2');
        map.set('1', '3');

        expect(map.get('1')).toStrictEqual(['2', '3']);
        expect(map.getReverse('2')).toStrictEqual(['1']);
        expect(map.getReverse('3')).toStrictEqual(['1']);
    });

    test('delete not found', () => {
        const map = new TwoWayMap();

        map.set('1', '2');
        expect(map.get('1')).toStrictEqual(['2']);
        expect(map.getReverse('2')).toStrictEqual(['1']);

        map.delete('3');
        expect(map.get('1')).toStrictEqual(['2']);
        expect(map.getReverse('2')).toStrictEqual(['1']);
    });

    test('delete entry', () => {
        const map = new TwoWayMap();

        map.set('1', '2');
        expect(map.get('1')).toStrictEqual(['2']);
        expect(map.getReverse('2')).toStrictEqual(['1']);

        map.delete('1');
        expect(map.get('1')).toStrictEqual([]);
        expect(map.getReverse('2')).toStrictEqual([]);
    });

    test('delete reverse', () => {
        const map = new TwoWayMap();

        map.set('1', '2');
        expect(map.get('1')).toStrictEqual(['2']);
        expect(map.getReverse('2')).toStrictEqual(['1']);

        map.deleteReverse('2');
        expect(map.get('1')).toStrictEqual([]);
        expect(map.getReverse('2')).toStrictEqual([]);
    });
});
