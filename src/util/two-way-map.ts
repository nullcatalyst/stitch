export default class TwoWayMap<A, B> {
    private aMap = new Map<A, B[]>();
    private bMap = new Map<B, A[]>();

    get(a: A): B[] {
        return (this.aMap.get(a) ?? []).slice();
    }

    getReverse(b: B): A[] {
        return (this.bMap.get(b) ?? []).slice();
    }

    set(a: A, b: B) {
        const aList = this.aMap.get(a);
        if (aList != null) {
            if (aList.indexOf(b) < 0) {
                aList.push(b);
            }
        } else {
            this.aMap.set(a, [b]);
        }

        const bList = this.bMap.get(b);
        if (bList != null) {
            if (bList.indexOf(a) < 0) {
                bList.push(a);
            }
        } else {
            this.bMap.set(b, [a]);
        }
    }

    setReverse(b: B, a: A) {
        this.set(a, b);
    }

    delete(a: A) {
        const aList = this.aMap.get(a);
        if (aList == null) {
            return;
        }

        this.aMap.delete(a);
        for (const b of aList) {
            const bList = this.bMap.get(b);
            if (bList == null) {
                continue;
            }

            const i = bList.indexOf(a);
            if (i < 0) {
                continue;
            }
            bList.splice(i, 1);
        }
    }

    deleteReverse(b: B) {
        const bList = this.bMap.get(b);
        if (bList == null) {
            return;
        }

        this.bMap.delete(b);
        for (const a of bList) {
            const aList = this.aMap.get(a);
            if (aList == null) {
                continue;
            }

            const i = aList.indexOf(b);
            if (i < 0) {
                continue;
            }
            aList.splice(i, 1);
        }
    }
}
