"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
function stringStartsWith(s, p) {
    var ns = s.length;
    var np = p.length;
    if (ns < np)
        return false;
    for (var i = 0; i < np; i++) {
        if (s.charCodeAt(i) !== p.charCodeAt(i))
            return false;
    }
    return true;
}
exports.stringStartsWith = stringStartsWith;
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
function stringEndsWith(s, p) {
    var ns = s.length;
    var np = p.length;
    if (ns < np)
        return false;
    for (var i = ns - np, j = 0; j < np; i++, j++) {
        if (s.charCodeAt(i) !== p.charCodeAt(j))
            return false;
    }
    return true;
}
exports.stringEndsWith = stringEndsWith;
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
function substringEquals(s, pos, p) {
    var nsub = p.length;
    if (pos + nsub > s.length)
        return false;
    for (var i = 0; i < nsub; i++) {
        if (s.charCodeAt(pos + i) !== p.charCodeAt(i))
            return false;
    }
    return true;
}
exports.substringEquals = substringEquals;
/**
 * A key-value map without any prototype properties. Can be used with
 * pre-ES2015 targets which do not support the Map and Set types.
 */
var Dictionary = /** @class */ (function () {
    function Dictionary() {
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
    Dictionary.prototype.get = function (key) {
        return this.m_obj[key];
    };
    /**
     * Sets the value associated with the given key in the dictionary.
     * @param key The key.
     * @param val The value to set.
     */
    Dictionary.prototype.set = function (key, val) {
        this.m_obj[key] = val;
    };
    /**
     * Returns a value indicating whether the given key exists in the dictionary.
     * @return True if the key exists, otherwise false.
     * @param key The key.
     */
    Dictionary.prototype.has = function (key) {
        return key in this.m_obj;
    };
    /**
     * Removes the given key and its value from the dictionary.
     * @returns True if the key was removed, false if it does not exist.
     * @param key The key to remove.
     */
    Dictionary.prototype.remove = function (key) {
        return delete this.m_obj[key];
    };
    /**
     * Gets the value associated with the given key in the dictionary. If the
     * key does not exist, creates a new value using the given constructor
     * and assigns it to the key.
     *
     * @param key The key.
     * @param ctor The constructor to be called if the key does not exist.
     */
    Dictionary.prototype.getOrNew = function (key, ctor) {
        var val = this.m_obj[key];
        if (val === undefined) {
            val = new ctor();
            this.m_obj[key] = val;
        }
        return val;
    };
    /**
     * Calls a function for each item in the dictionary.
     * @param callback A function taking two arguments. The first is the key
     *                 and the second is the value.
     */
    Dictionary.prototype.forEach = function (callback) {
        for (var key in this.m_obj)
            callback(key, this.m_obj[key]);
    };
    return Dictionary;
}());
exports.Dictionary = Dictionary;
