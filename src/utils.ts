/**
 * Returns a value indicating whether the first string argument
 * starts with the second.
 * 
 * This function is compatible with pre-ES2015 targets which do
 * not support the String.startsWith() method.
 * 
 * @returns True if the string "s" starts with "p", otherwise false.
 * @param s The first string.
 * @param p The second string.
 */
export function stringStartsWith(s: string, p: string): boolean {
    const ns: number = s.length;
    const np: number = p.length;
    if (ns < np)
        return false;
    for (let i: number = 0; i < np; i++) {
        if (s.charCodeAt(i) !== p.charCodeAt(i))
            return false;
    }
    return true;
}

/**
 * Returns a value indicating whether the first string argument
 * ends with the second.
 * 
 * This function is compatible with pre-ES2015 targets which do
 * not support the String.endsWith() method.
 * 
 * @returns True if the string "s" ends with "p", otherwise false.
 * @param s The first string.
 * @param p The second string.
 */
export function stringEndsWith(s: string, p: string):boolean {
    const ns: number = s.length;
    const np: number = p.length;
    if (ns < np)
        return false;
    for (let i: number = ns - np, j: number = 0; j < np; i++, j++) {
        if (s.charCodeAt(i) !== p.charCodeAt(j))
            return false;
    }
    return true;
}

/**
 * Returns a value indicating whether the substring of the first
 * string argument starting at the given position is equal to the
 * second string argument.
 * 
 * @returns True if the substring of "s" starting at "pos" and having
 *          a length equal to that of "p" is the same as the string
 *          "p", otherwise false.
 * 
 * @param s    The first string.
 * @param pos  The position of the substring in the first string.
 * @param p    The second string.
 */
export function substringEquals(s: string, pos: number, p: string): boolean {
    const nsub: number = p.length;
    if (pos + nsub > s.length)
        return false;
    for (let i: number = 0; i < nsub; i++) {
        if (s.charCodeAt(pos + i) !== p.charCodeAt(i))
            return false;
    }
    return true;
}

/**
 * A key-value map without any prototype properties. Can be used with 
 * pre-ES2015 targets which do not support the Map and Set types.
 */
export class Dictionary<T> {

    private m_obj: any;

    public constructor() {
        this.m_obj = Object.create(null);

        // See TypeScript's Map implementation for why this is done.
        this.m_obj.$ = undefined;
        delete this.m_obj.$;
    }

    /**
     * Returns the value in the dictionary with the given key.
     * @returns The value associated with the given key, or undefined if
     *          the key does not exist.
     * @param key The key.
     */
    public get(key: string): T | undefined {
        return <T>this.m_obj[key];
    }

    /**
     * Sets the value associated with the given key in the dictionary.
     * @param key The key.
     * @param val The value to set.
     */
    public set(key: string, val: T): void {
        this.m_obj[key] = val;
    }

    /**
     * Returns a value indicating whether the given key exists in the dictionary.
     * @return True if the key exists, otherwise false.
     * @param key The key.
     */
    public has(key: string): boolean {
        return key in this.m_obj;
    }

    /**
     * Removes the given key and its value from the dictionary.
     * @returns True if the key was removed, false if it does not exist.
     * @param key The key to remove.
     */
    public remove(key: string): boolean {
        return delete this.m_obj[key];
    }

    /**
     * Gets the value associated with the given key in the dictionary. If the
     * key does not exist, creates a new value using the given constructor
     * and assigns it to the key.
     * 
     * @param key The key.
     * @param ctor The constructor to be called if the key does not exist.
     */
    public getOrNew(key: string, ctor: new () => T): T {
        let val: T | undefined = this.m_obj[key];
        if (val === undefined) {
            val = new ctor();
            this.m_obj[key] = val;
        }
        return val;
    }

    /**
     * Calls a function for each item in the dictionary.
     * @param callback A function taking two arguments. The first is the key
     *                 and the second is the value.
     */
    public forEach(callback: (key: string, val: T) => void): void {
        for (let key in this.m_obj)
            callback(key, this.m_obj[key]);
    }

}