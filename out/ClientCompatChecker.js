"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var utils_1 = require("./utils");
/*
 * The MDN browser compatibility data used by the checker.
 *
 * For schema documentation see:
 * https://github.com/mdn/browser-compat-data/blob/master/schemas/compat-data-schema.md
 */
var BrowserCompatData = require("mdn-browser-compat-data");
/**
 * The maximum allowed value of the major or minor version
 * in a Version object.
 */
var _VERSION_MAX = 999999999;
var Version = /** @class */ (function () {
    /**
     * Creates a new Version instance.
     * This is a private constructor that does not validate its arguments.
     * To create a new Version instance use Version.create().
     *
     * @param major The major version number. Must be between 0 and _VERSION_MAX.
     * @param minor The minor version number. Must be between 0 and _VERSION_MAX.
     */
    function Version(major, minor) {
        this.major = major;
        this.minor = minor;
    }
    /**
     * Creates a new Version instance.
     * @param major The major version number. Must be an integer between 0 and _VERSION_MAX.
     * @param minor The minor version number. Must be an integer between 0 and _VERSION_MAX.
     */
    Version.create = function (major, minor) {
        if (minor === void 0) { minor = 0; }
        major |= 0;
        minor |= 0;
        if (major >= 0 && major <= _VERSION_MAX && minor >= 0 && minor <= _VERSION_MAX)
            return new Version(major, minor);
        throw new RangeError("Invalid version.");
    };
    /**
     * Creates a Version instance by parsing a version string.
     * @param str        The version string to parse.
     * @param defaultMax By default, a minor version that is not specified is taken
     *                   to be 0. If this is set to true, it is taken to be _VERSION_MAX
     *                   instead.
     */
    Version.fromString = function (str, defaultMax) {
        if (defaultMax === void 0) { defaultMax = false; }
        var major;
        var minor = -1;
        var hasMinor = false;
        var p = str.indexOf(".");
        if (p === -1) {
            major = parseInt(str, 10);
        }
        else {
            major = parseInt(str.substr(0, p), 10);
            minor = parseInt(str.substr(p + 1), 10);
            hasMinor = true;
        }
        if (!hasMinor)
            minor = defaultMax ? _VERSION_MAX : 0;
        return Version.create(major, minor);
    };
    /**
     * Compares two Version instances.
     *
     * @returns A value less than, equal to or greater than zero when the first Version
     *          instance compares less than, equal to or greater than the second,
     *          respectively.
     * @param v1 The first instance.
     * @param v2 The second instance.
     */
    Version.compare = function (v1, v2) {
        if (v1.major !== v2.major)
            return (v1.major < v2.major) ? -1 : 1;
        if (v1.minor !== v2.minor)
            return (v1.minor < v2.minor) ? -1 : 1;
        return 0;
    };
    /**
     * Gets a string representation of this Version instance.
     */
    Version.prototype.toString = function () {
        if (this.minor === 0 || this.minor === _VERSION_MAX)
            return String(this.major);
        return this.major + "." + this.minor;
    };
    /**
     * The minimum possible version that can be represented by a Version
     * instance. This has a major and minor version equal to zero.
     */
    Version.minVal = new Version(0, 0);
    /**
     * The maximum possible version that can be represented by a Version
     * instance. This has a major and minor version equal to _VERSION_MAX.
     */
    Version.maxVal = new Version(_VERSION_MAX, _VERSION_MAX);
    /**
     * A Version instance that compares greater than any other Version
     * instance (including maxVal) when using the compare() method.
     */
    Version.infinite = new Version(_VERSION_MAX + 1, 0);
    return Version;
}());
exports.Version = Version;
/**
 * Represents a compatibility issue for a feature on a particular client.
 */
var Issue = /** @class */ (function () {
    /**
     * Creates a new Issue instance.
     *
     * @param featureName  The name of the type, function, property or event to which the issue is related.
     * @param clientDesc   A description string for the client to which the issue is related.
     * @param kind         The issue category from IssueKind.
     * @param altOrPrefix  The prefix or alternate name, if "kind" is NEEDS_PREFIX or NEEDS_ALT_NAME
     * @param note         Additional notes associated with the issue.
     * @param url          A web page URL on which more information about the issue may be available.
     * @param startVersion The client version beginning from which this issue is applicable.
     * @param endVersion   The client version beginning from which this issue is no longer applicable.
     */
    function Issue(featureName, clientDesc, kind, altOrPrefix, note, url, startVersion, endVersion) {
        if (altOrPrefix === void 0) { altOrPrefix = null; }
        if (note === void 0) { note = null; }
        if (url === void 0) { url = null; }
        if (startVersion === void 0) { startVersion = Version.minVal; }
        if (endVersion === void 0) { endVersion = Version.infinite; }
        this.featureName = featureName;
        this.clientDesc = clientDesc;
        this.kind = kind;
        this.altOrPrefix = altOrPrefix;
        this.note = note;
        this.url = url;
        this.startVersion = startVersion;
        this.endVersion = endVersion;
    }
    /**
     * Returns a message string representing this issue.
     */
    Issue.prototype.getMessage = function () {
        var parts = [];
        parts.push("A compatibility issue was detected for ", this.featureName, " with ", this.clientDesc, ":\n");
        switch (this.kind) {
            case 0 /* NOT_SUPPORTED */:
                parts.push("This type, property, function or event is not supported.");
                break;
            case 1 /* NEEDS_PREFIX */:
                parts.push("Use prefix '", this.altOrPrefix, "'.");
                break;
            case 2 /* NEEDS_ALT_NAME */:
                parts.push("Use alternate name '", this.altOrPrefix, "'.");
                break;
            case 4 /* IS_PARTIAL_IMPL */:
                parts.push("This feature is partially implemented.");
                break;
            case 3 /* NEEDS_FLAG */:
                parts.push("This feature may require a configuration setting to be changed to work properly.");
                break;
            case 5 /* NOTE */:
                parts.push("See the note below.");
                break;
        }
        var hasStartVersion = Version.compare(this.startVersion, Version.minVal) !== 0;
        var hasEndVersion = Version.compare(this.endVersion, Version.infinite) !== 0;
        if (hasStartVersion) {
            parts.push(" (Applicable for versions >= ", this.startVersion.toString());
            if (hasEndVersion)
                parts.push(" and < ", this.endVersion.toString());
            parts.push(")");
        }
        else if (hasEndVersion) {
            parts.push(" (applicable for versions < ", this.endVersion.toString(), ")");
        }
        if (this.note !== null)
            parts.push("\n-- NOTE: ", this.note);
        if (this.url !== null)
            parts.push("\n-- More info: ", this.url);
        return parts.join("");
    };
    return Issue;
}());
exports.Issue = Issue;
/**
 * The minimum version of each client available in the MDN compatibility data.
 */
var _minClientVersions = (function () {
    var map = new utils_1.Dictionary();
    for (var name_1 in BrowserCompatData.browsers) {
        var versionStrings = Object.keys(BrowserCompatData.browsers[name_1].releases);
        var versions = versionStrings.map(function (x) { return Version.fromString(x); });
        var minVersion = versions.reduce(function (a, x) { return (Version.compare(a, x) < 0) ? a : x; });
        map.set(name_1, minVersion);
    }
    return map;
})();
/**
 * Removes all HTML tags from the given string and replaces the entities
 * &lt; &gt; and &amp; with their corresponding characters.
 *
 * @returns The string with tags removed and entities substituted.
 * @param str The string from which to strip HTML tags and replace entities.
 */
function _stripHTML(str) {
    return str
        .replace(/<[^>]+>/g, "")
        .replace(/&(?:lt|gt|amp);/g, function (m) { return (m === "&lt;") ? "<" : ((m === "&gt;") ? ">" : "&"); });
}
/**
 * Creates a new Issue object which indicates an unsupported feature.
 *
 * @returns The created Issue object.
 *
 * @param name     The name of the type or global variable/function.
 * @param propName If the issue is associated with a property/method/event on
 *                 a type, pass the property name. Otherwise set this to null.
 * @param csi      The ClientSupportInfo instance representing the client version
 *                 range on which the feature is not supported.
 */
function _makeNotSupportedIssue(name, propName, csi) {
    return new Issue((propName !== null) ? name + "." + propName : name, csi.description, 0 /* NOT_SUPPORTED */);
}
/**
 * Checks if an issue should be ignored based on the given flags.
 *
 * @returns True if the issue should be ignored, otherwise false.
 * @param issue The issue to check.
 * @param flags A set of flags from ClientCompatCheckerFlags.
 */
function _shouldDiscardIssueBasedOnFlags(issue, flags) {
    if ((flags & 1 /* IGNORE_NOTES */) !== 0
        && issue.kind === 5 /* NOTE */) {
        return true;
    }
    if ((flags & 2 /* IGNORE_PARTIAL_IMPL */) !== 0
        && issue.kind === 4 /* IS_PARTIAL_IMPL */) {
        return true;
    }
    return false;
}
function _getIssuesFromCompatStatement(csi, typeName, propName, compatDataObj, flags, issues) {
    if (!compatDataObj)
        return false;
    var support = compatDataObj.support[csi.name];
    if (!support) {
        issues.push(_makeNotSupportedIssue(typeName, propName, csi));
        return true;
    }
    var url = compatDataObj.mdn_url ? String(compatDataObj.mdn_url) : null;
    var oldIssuesLength = issues.length;
    if (Array.isArray(support)) {
        var supportArr = support;
        for (var i = 0; i < supportArr.length; i++)
            _convertSupportStatementVersions(supportArr[i]);
        if (!_checkIfSupportedVersion(csi, support)) {
            issues.push(_makeNotSupportedIssue(typeName, propName, csi));
            return true;
        }
        if (_checkIfSupportedVersion(csi, support, true)) {
            // Don't report any issues if the feature has full support for the
            // supplied version range.
            return false;
        }
        for (var i = 0; i < supportArr.length; i++) {
            var issue = _getIssueFromSupportStatement(typeName, propName, url, csi, flags, supportArr[i]);
            if (issue !== null)
                issues.push(issue);
        }
    }
    else {
        _convertSupportStatementVersions(support);
        var issue = void 0;
        if (!_checkIfSupportedVersion(csi, support))
            issue = _makeNotSupportedIssue(typeName, propName, csi);
        else
            issue = _getIssueFromSupportStatement(typeName, propName, url, csi, flags, support);
        if (issue !== null)
            issues.push(issue);
    }
    return issues.length !== oldIssuesLength;
}
/**
 * Converts version strings in a support_statement in the compatibility
 * data to Version objects. If the versions are already in the form of
 * Version objects then nothing is done.
 *
 * @param support A support_statement object in the compatibility data.
 *                This must not be an array.
 */
function _convertSupportStatementVersions(support) {
    var versionAdded = support.version_added;
    var versionRemoved = support.version_removed;
    if (!(versionAdded instanceof Version)) {
        var vAdded = void 0;
        if (versionAdded === true) {
            vAdded = Version.minVal;
        }
        else if (versionAdded === false) {
            vAdded = Version.infinite;
        }
        else if (typeof (versionAdded) === "string") {
            var s = versionAdded;
            if (s.charCodeAt(0) === 0x2264)
                // Some Edge and Android WebView versions begin with '≤', which
                // indicates than the feature was added in a version less than or
                // equal to that value. For these cases, assume that it was added
                // in the first version.
                // See: https://github.com/mdn/browser-compat-data/blob/master/schemas/compat-data-schema.md#ranged-versions
                vAdded = Version.minVal;
            else
                vAdded = Version.fromString(s);
        }
        else {
            vAdded = Version.minVal;
        }
        support.version_added = vAdded;
    }
    if (!(versionRemoved instanceof Version)) {
        var vRemoved = void 0;
        if (typeof (versionRemoved) === "string")
            vRemoved = Version.fromString(versionRemoved);
        else
            vRemoved = Version.infinite;
        support.version_removed = vRemoved;
    }
}
function _checkIfSupportedVersion(csi, support, withNoIssues) {
    if (withNoIssues === void 0) { withNoIssues = false; }
    if (!Array.isArray(support)) {
        if (Version.compare(csi.minVersion, support.version_added) < 0
            || Version.compare(csi.maxVersion, support.version_removed) >= 0) {
            return false;
        }
        if (!withNoIssues)
            return true;
        return !(support.prefix || support.alternative_name
            || support.flags || support.partial_implementation);
    }
    var arr = support;
    if (withNoIssues)
        arr = arr.filter(function (x) { return !(x.prefix || x.alternative_name || x.flags || x.partial_implementation); });
    if (arr.length === 0)
        return false;
    if (arr.length === 1)
        return _checkIfSupportedVersion(csi, arr[0]);
    arr.sort(function (a, b) {
        var r = Version.compare(a.version_removed, b.version_removed);
        if (r !== 0)
            return r;
        return Version.compare(a.version_added, b.version_added);
    });
    var vMin = csi.minVersion;
    var vMax = csi.maxVersion;
    var firstVersionAdded = arr[0].version_added;
    var lastVersionRemoved = arr[arr.length - 1].version_removed;
    for (var i = 0; i < arr.length - 1; i++) {
        var removed = arr[i].version_removed;
        var nextAdded = arr[i + 1].version_added;
        if (Version.compare(nextAdded, removed) > 0
            && Version.compare(vMin, nextAdded) < 0
            && Version.compare(vMax, removed) >= 0) {
            return false;
        }
        if (Version.compare(nextAdded, firstVersionAdded) < 0)
            firstVersionAdded = nextAdded;
    }
    if (Version.compare(vMin, firstVersionAdded) < 0
        || Version.compare(vMax, lastVersionRemoved) >= 0) {
        return false;
    }
    return true;
}
function _getIssueFromSupportStatement(typeName, propName, url, csi, flags, support) {
    var versionAdded = support.version_added;
    var versionRemoved = support.version_removed;
    if (Version.compare(csi.maxVersion, versionAdded) < 0
        || Version.compare(csi.minVersion, versionRemoved) >= 0) {
        return null;
    }
    var notes = support.notes ? _stripHTML(String(support.notes)) : null;
    var issueKind;
    var altOrPrefix = null;
    if (support.prefix) {
        issueKind = 1 /* NEEDS_PREFIX */;
        altOrPrefix = String(support.prefix);
    }
    else if (support.alternative_name) {
        issueKind = 2 /* NEEDS_ALT_NAME */;
        altOrPrefix = String(support.alternative_name);
    }
    else if (support.flags) {
        issueKind = 3 /* NEEDS_FLAG */;
    }
    else if (support.partial_implementation === true) {
        issueKind = 4 /* IS_PARTIAL_IMPL */;
    }
    else if (notes !== null) {
        issueKind = 5 /* NOTE */;
    }
    else {
        return null;
    }
    var featureName = (propName !== null) ? typeName + "." + propName : typeName;
    var issue = new Issue(featureName, csi.description, issueKind, altOrPrefix, notes, url, versionAdded, versionRemoved);
    if (_shouldDiscardIssueBasedOnFlags(issue, flags))
        return null;
    return issue;
}
var ClientSupportInfo = /** @class */ (function () {
    /**
     * Creates a new instance of ClientSupportInfo.
     *
     * @param name        The name of the client.
     * @param minVersion  The minimum client version. Use Version.minVal if this instance
     *                    is to represent a version range without a lower bound.
     * @param maxVersion  The maximum client version. Use Version.maxVal if this instance
     *                    is to represent a version range without an upper bound.
     */
    function ClientSupportInfo(name, minVersion, maxVersion) {
        /**
         * A dictionary containing compatibility issues associated with global entities,
         * indexed by name.
         */
        this.m_globalIssues = new utils_1.Dictionary();
        /**
         * A dictionary containing compatibility issues associated with properties and methods
         * of types. This is indexed by type name and then by property name.
         */
        this.m_propertyIssues = new utils_1.Dictionary();
        /**
         * A dictionary containing compatibility issues associated with events
         * of types. This is indexed by type name and then by event name.
         */
        this.m_eventIssues = new utils_1.Dictionary();
        this.name = name;
        this.minVersion = minVersion;
        this.maxVersion = maxVersion;
        this.displayName = BrowserCompatData.browsers[this.name].name;
        this.description = this._getClientDescString();
    }
    /**
     * Creates an array of ClientSupportInfo instances from the given client names
     * and versions.
     *
     * @param versionInfo An object whose keys are the names of the clients for
     *                    which to create ClientSupportInfo instances, with the
     *                    corresponding values being the minimum version (or version
     *                    range) that the created ClientSupportInfo for that client
     *                    name should represent. The properties for the client names
     *                    must be enumerable.
     * @param flags       A set of flags from ClientCompatCheckerFlags indicating whether
     *                    certain kinds of issues should not be reported.
     */
    ClientSupportInfo.create = function (versionInfo, flags) {
        var csiArr = [];
        for (var name_2 in versionInfo) {
            if (name_2.length === 0 || !(name_2 in BrowserCompatData.browsers))
                throw new RangeError("Invalid target name: " + name_2);
            var minVer = Version.minVal;
            var maxVer = Version.maxVal;
            var ver = versionInfo[name_2];
            if (typeof (ver) === "number") {
                // Don't use the fractional part of the number as a minor version,
                // as this could be affected by floating point errors.
                if (ver % 1 !== 0)
                    console.error("Target '" + name_2 + "': fractions in numeric versions will be ignored. Use a string if a minor version is to be provided.");
                minVer = Version.create(ver);
            }
            else if (typeof (ver) === "string") {
                var s = ver;
                if (s !== "*") {
                    var p = s.indexOf("-");
                    if (p === -1) {
                        minVer = Version.fromString(s);
                    }
                    else {
                        minVer = Version.fromString(s.substr(0, p));
                        maxVer = Version.fromString(s.substr(p + 1), true);
                    }
                }
            }
            else {
                throw new RangeError("Version must be a number or string.");
            }
            if (Version.compare(minVer, maxVer) > 0)
                throw new RangeError("Invalid version range for target: " + name_2);
            if (Version.compare(minVer, Version.minVal) === 0)
                minVer = _minClientVersions.get(name_2) || Version.minVal;
            csiArr.push(new ClientSupportInfo(name_2, minVer, maxVer));
        }
        ClientSupportInfo._loadCompatDataFromModule(csiArr, flags);
        return csiArr;
    };
    /**
     * Loads the compatibility data from the mdn-browser-compat-data module.
     *
     * @param csiArr  An array of ClientSupportInfo objects representing
     *                a list of target clients and their version ranges
     *                into which to load the data.
     * @param flags   A set of flags from ClientCompatCheckerFlags indicating whether
     *                certain kinds of issues should not be reported.
     */
    ClientSupportInfo._loadCompatDataFromModule = function (csiArr, flags) {
        ClientSupportInfo._loadCompatData(csiArr, BrowserCompatData.javascript.builtins, flags);
        ClientSupportInfo._loadCompatData(csiArr, BrowserCompatData.api, flags);
        for (var i = 0; i < csiArr.length; i++)
            csiArr[i]._importGlobalIssuesFromWindow();
    };
    /**
     * Loads compatibility data from the given object.
     *
     * @param csiArr          An array of ClientSupportInfo objects representing
     *                        a list of target clients and their version ranges
     *                        into which to load the data.
     *
     * @param compatData      An object containing compatibility data. The properties of this
     *                        object are the names of global types, variables and functions
     *                        for which compatibility data is available. The value associated
     *                        with each properties must be an object with a property named "__compat".
     *                        whose value is a compat_statement (see MDN documentation).
     *                        For types, this object may have additional properties containing
     *                        compatibility data for the type's properties, methods and events.
     *
     * @param flags           A set of flags from ClientCompatCheckerFlags indicating whether
     *                        certain kinds of issues should not be reported.
     */
    ClientSupportInfo._loadCompatData = function (csiArr, compatData, flags) {
        var issues = [];
        for (var name_3 in compatData) {
            var compatDataForName = compatData[name_3];
            var members = Object.keys(compatDataForName);
            for (var i = 0; i < csiArr.length; i++) {
                var csi = csiArr[i];
                issues.length = 0;
                if (_getIssuesFromCompatStatement(csi, name_3, null, compatDataForName.__compat, flags, issues)) {
                    if (issues.length === 1)
                        csi.m_globalIssues.set(name_3, issues[0]);
                    else
                        csi.m_globalIssues.set(name_3, issues.slice());
                }
                if (members.length === 0)
                    continue;
                var propIssuesForType = csi.m_propertyIssues.get(name_3);
                var eventIssuesForType = csi.m_eventIssues.get(name_3);
                for (var i_1 = 0; i_1 < members.length; i_1++) {
                    var memberName = members[i_1];
                    var isEvent = utils_1.stringEndsWith(memberName, "_event");
                    var memberNameWithoutSuffix = memberName;
                    if (isEvent) {
                        memberNameWithoutSuffix = memberName.substr(0, memberName.length - 6);
                    }
                    else if (memberName.indexOf("_") !== -1
                        || utils_1.stringStartsWith(memberName, "@@") || memberName === name_3) {
                        continue;
                    }
                    issues.length = 0;
                    var hasIssues = _getIssuesFromCompatStatement(csi, name_3, memberNameWithoutSuffix, compatDataForName[memberName].__compat, flags, issues);
                    if (!hasIssues)
                        continue;
                    var issueDict = isEvent ? eventIssuesForType : propIssuesForType;
                    if (issueDict === undefined) {
                        if (isEvent) {
                            issueDict = eventIssuesForType = new utils_1.Dictionary();
                            csi.m_eventIssues.set(name_3, issueDict);
                        }
                        else {
                            issueDict = propIssuesForType = new utils_1.Dictionary();
                            csi.m_propertyIssues.set(name_3, issueDict);
                        }
                    }
                    if (issues.length === 1)
                        issueDict.set(memberNameWithoutSuffix, issues[0]);
                    else
                        issueDict.set(memberNameWithoutSuffix, issues.slice());
                }
            }
        }
    };
    /**
     * Adds any issues associated with properties of the Window type and
     * its associated interfaces to the global issue table. This is needed
     * for checking scripts for use in web browsers, where the window object
     * is part of the global scope.
     */
    ClientSupportInfo.prototype._importGlobalIssuesFromWindow = function () {
        var _this = this;
        var window = this.m_propertyIssues.get("Window");
        if (window)
            window.forEach(function (k, v) { return _this.m_globalIssues.set(k, v); });
        var wwgs = this.m_propertyIssues.get("WindowOrWorkerGlobalScope");
        if (wwgs)
            wwgs.forEach(function (k, v) { return _this.m_globalIssues.set(k, v); });
    };
    /**
     * Finds any compatibility issues associated with a global type,
     * variable or function for the client version range represented by
     * this ClientSupportInfo object.
     *
     * @param name   The name of the global entity for which to check for
     *               compatibility issues.
     * @param issues An array to which any issues found will be appended.
     */
    ClientSupportInfo.prototype.getGlobalIssues = function (name, issues) {
        var issuesFound = this.m_globalIssues.get(name);
        if (issuesFound === undefined)
            return;
        if (Array.isArray(issuesFound))
            issues.push.apply(issues, issuesFound);
        else
            issues.push(issuesFound);
    };
    /**
     * Finds any compatibility issues associated with a property, method
     * or event on a type, for the client version range represented by
     * this ClientSupportInfo object.
     *
     * @param typeName The name of the type containing the property, method or event.
     * @param propName The name of the property, method or event on the type
     *                 represented by "typeName" for which to check for compatibility
     *                 issues.
     * @param isEvent  Set to true if "propName" is the name of an event, false if it
     *                 is the name of a property or method.
     * @param issues   An array to which any issues found will be appended.
     */
    ClientSupportInfo.prototype.getPropertyOrEventIssues = function (typeName, propName, isEvent, issues) {
        var typeDict = isEvent ? this.m_eventIssues : this.m_propertyIssues;
        var propDict = typeDict.get(typeName);
        if (propDict === undefined)
            return;
        var issuesFound = propDict.get(propName);
        if (issuesFound === undefined)
            return;
        if (Array.isArray(issuesFound))
            issues.push.apply(issues, issuesFound);
        else
            issues.push(issuesFound);
    };
    /**
     * Gets a string containing the client display name and version range
     * represented by this instance.
     *
     * @returns A string containing the client display name and version range.
     */
    ClientSupportInfo.prototype._getClientDescString = function () {
        if (Version.compare(this.minVersion, Version.minVal) === 0
            && Version.compare(this.maxVersion, Version.maxVal) === 0) {
            return this.displayName;
        }
        var vstr;
        if (Version.compare(this.minVersion, this.maxVersion) === 0)
            vstr = this.minVersion.toString();
        else if (Version.compare(this.minVersion, Version.minVal) === 0)
            vstr = "<=" + this.maxVersion.toString();
        else if (Version.compare(this.maxVersion, Version.maxVal) === 0)
            vstr = ">=" + this.minVersion.toString();
        else
            vstr = this.minVersion.toString() + "-" + this.maxVersion.toString();
        return this.displayName + " " + vstr;
    };
    return ClientSupportInfo;
}());
/**
 * An array containing the supported client names.
 */
var supportedClientNames = Object.keys(BrowserCompatData.browsers);
exports.supportedClientNames = supportedClientNames;
var ClientCompatChecker = /** @class */ (function () {
    function ClientCompatChecker(versionInfo, flags) {
        if (flags === void 0) { flags = 0; }
        this.m_clientSupportInfo = [];
        this.m_flags = flags;
        this.m_clientSupportInfo = ClientSupportInfo.create(versionInfo, flags);
    }
    /**
     * Checks a global type, variable or function for compatibility with the
     * client list of this instance.
     *
     * @returns True if any issues were found, otherwise false.
     * @param name   The name of the global entity to be checked.
     * @param issues If any issues are found, they will be appended to this array.
     */
    ClientCompatChecker.prototype.checkGlobal = function (name, issues) {
        var csiArr = this.m_clientSupportInfo;
        var oldIssuesLength = issues.length;
        for (var i = 0; i < csiArr.length; i++)
            csiArr[i].getGlobalIssues(name, issues);
        return issues.length !== oldIssuesLength;
    };
    /**
     * Checks a property or event for compatibility with the client list in this
     * instance.
     *
     * @returns True if any issues were found, otherwise false.
     *
     * @param typeName   The name of the type declaring the property to be checked.
     * @param propName   The name of the property to be checked.
     * @param isEvent    Set to true if propName represents an event.
     * @param issues     If any issues are found, they will be appended to this array.
     */
    ClientCompatChecker.prototype.checkPropertyOrEvent = function (typeName, propName, isEvent, issues) {
        var csiArr = this.m_clientSupportInfo;
        var oldIssuesLength = issues.length;
        for (var i = 0; i < csiArr.length; i++)
            csiArr[i].getPropertyOrEventIssues(typeName, propName, isEvent, issues);
        return issues.length !== oldIssuesLength;
    };
    return ClientCompatChecker;
}());
exports.ClientCompatChecker = ClientCompatChecker;
