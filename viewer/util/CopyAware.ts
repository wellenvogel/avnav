export class CopyAware {
    constructor() {
    }

    copy(updates:Record<string,any>) {
        // @ts-ignore
        const rt = new this.constructor({});
        for (const k of Object.keys(this)) {
            rt[k] = (this as Record<string, any>)[k];
        }
        if (updates && updates instanceof Object) {
            for (const k in updates) {
                rt[k] = updates[k];
            }
        }
        return rt;
    }

    _fhelper(name:string, item:any) {
        const target = (this as Record<string, any>)[name];
        if (typeof target === 'function') {
            return target(this, item);
        }
        return target;
    }
}