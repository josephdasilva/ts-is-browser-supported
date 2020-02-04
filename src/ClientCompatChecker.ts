import {Dictionary, stringEndsWith, stringStartsWith} from "./utils";

/*
 * The MDN browser compatibility data used by the checker.
 * 
 * For schema documentation see: 
 * https://github.com/mdn/browser-compat-data/blob/master/schemas/compat-data-schema.md
 */
import * as BrowserCompatData from "mdn-browser-compat-data";

export {
    ClientCompatChecker,
    ClientCompatCheckerFlags,
    Issue,
    IssueKind,
    Version,
    supportedClientNames,
}

/**
 * The maximum allowed value of the major or minor version
 * in a Version object.
 */
const _VERSION_MAX: number = 999999999;

class Version {

    /**
     * The minimum possible version that can be represented by a Version
     * instance. This has a major and minor version equal to zero.
     */
    public static readonly minVal: Version = new Version(0, 0);

    /**
     * The maximum possible version that can be represented by a Version
     * instance. This has a major and minor version equal to _VERSION_MAX.
     */
    public static readonly maxVal: Version = new Version(_VERSION_MAX, _VERSION_MAX);

    /**
     * A Version instance that compares greater than any other Version
     * instance (including maxVal) when using the compare() method.
     */
    public static readonly infinite: Version = new Version(_VERSION_MAX + 1, 0);

    /**
     * The major version number.
     */
    public readonly major: number;

    /**
     * The minor version number.
     */
    public readonly minor: number;

    /**
     * Creates a new Version instance. 
     * This is a private constructor that does not validate its arguments.
     * To create a new Version instance use Version.create().
     * 
     * @param major The major version number. Must be between 0 and _VERSION_MAX.
     * @param minor The minor version number. Must be between 0 and _VERSION_MAX.
     */
    private constructor(major: number, minor: number) {
        this.major = major;
        this.minor = minor;
    }

    /**
     * Creates a new Version instance.
     * @param major The major version number. Must be an integer between 0 and _VERSION_MAX.
     * @param minor The minor version number. Must be an integer between 0 and _VERSION_MAX.
     */
    public static create(major: number, minor: number = 0): Version {
        major |= 0;
        minor |= 0;
        if (major >= 0 && major <= _VERSION_MAX && minor >= 0 && minor <= _VERSION_MAX)
            return new Version(major, minor);
        throw new RangeError("Invalid version.");
    }

    /**
     * Creates a Version instance by parsing a version string.
     * @param str        The version string to parse.
     * @param defaultMax By default, a minor version that is not specified is taken
     *                   to be 0. If this is set to true, it is taken to be _VERSION_MAX
     *                   instead.
     */
    public static fromString(str: string, defaultMax: boolean = false): Version {
        let major: number;
        let minor: number = -1;
        let hasMinor: boolean = false;

        let p: number = str.indexOf(".");
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
    }

    /**
     * Compares two Version instances.
     * 
     * @returns A value less than, equal to or greater than zero when the first Version
     *          instance compares less than, equal to or greater than the second,
     *          respectively.
     * @param v1 The first instance.
     * @param v2 The second instance.
     */
    public static compare(v1: Version, v2: Version): number {
        if (v1.major !== v2.major)
            return (v1.major < v2.major) ? -1 : 1;
        if (v1.minor !== v2.minor)
            return (v1.minor < v2.minor) ? -1 : 1;
        return 0;
    }

    /**
     * Gets a string representation of this Version instance.
     */
    public toString(): string {
        if (this.minor === 0 || this.minor === _VERSION_MAX)
            return String(this.major);
        return this.major + "." + this.minor;
    }
}

const enum IssueKind {
    /**
     * The feature is not supported on the target client.
     */
    NOT_SUPPORTED,

    /**
     * The feature is not supported on the target client with its original name,
     * but a prefixed name is available.
     */
    NEEDS_PREFIX,

    /**
     * The feature is not supported on the target client with its original name,
     * but an alternative name is available.
     */
    NEEDS_ALT_NAME,

    /**
     * The feature is not supported on the target client with its original name,
     * but a prefixed name is available.
     */
    NEEDS_FLAG,

    /**
     * The feature is supported on the target client, but only partially.
     */
    IS_PARTIAL_IMPL,

    /**
     * The feature is fully supported on the target client, but additional 
     * advice may be available.
     */
    NOTE,
}

/**
 * Represents a compatibility issue for a feature on a particular client.
 */
class Issue {

    /**
     * The name of the type, function, property or event to which this issue
     * is related. Properties and events are qualified with the declaring type name.
     */
    public readonly featureName: string;

    /**
     * A string describing the client to which the issue is related. This
     * contains the display name of the client along with the minimum and
     * maximum versions.
     */
    public readonly clientDesc: string;

    /**
     * An enum member from IssueKind indicating the category of the issue.
     */
    public readonly kind: IssueKind;

    /**
     * If the issue kind is NEEDS_PREFIX or NEEDS_ALT_NAME, the prefix or alternate
     * name to be used.
     */
    public readonly altOrPrefix: string | null;

    /**
     * Any additional notes associated with this issue.
     */
    public readonly note: string | null;

    /**
     * A URL for a web page on which more information about the issue may be available.
     */
    public readonly url: string | null;

    /**
     * The client version beginning from which this issue is applicable.
     */
    public readonly startVersion: Version;

    /**
     * The client version beginning from which this issue is no longer applicable.
     */
    public readonly endVersion: Version;

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
    public constructor(
        featureName: string, clientDesc: string,
        kind: IssueKind, altOrPrefix: string | null = null, note: string | null = null,
        url: string | null = null, startVersion: Version = Version.minVal,
        endVersion: Version = Version.infinite) 
    {
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
    public getMessage(): string {
        const parts: string[] = [];
        parts.push(
            "A compatibility issue was detected for ", this.featureName, " with ", this.clientDesc, ":\n");

        switch (this.kind) {
            case IssueKind.NOT_SUPPORTED:
                parts.push("This type, property, function or event is not supported.");
                break;
            case IssueKind.NEEDS_PREFIX:
                parts.push("Use prefix '", this.altOrPrefix!, "'.");
                break;
            case IssueKind.NEEDS_ALT_NAME:
                parts.push("Use alternate name '", this.altOrPrefix!, "'.");
                break;
            case IssueKind.IS_PARTIAL_IMPL:
                parts.push("This feature is partially implemented.");
                break;
            case IssueKind.NEEDS_FLAG:
                parts.push("This feature may require a configuration setting to be changed to work properly.");
                break;
            case IssueKind.NOTE:
                parts.push("See the note below.");
                break;
        }

        const hasStartVersion: boolean = Version.compare(this.startVersion, Version.minVal) !== 0;
        const hasEndVersion: boolean = Version.compare(this.endVersion, Version.infinite) !== 0;

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
    }
}

/**
 * The minimum version of each client available in the MDN compatibility data.
 */
const _minClientVersions: Dictionary<Version> = (() => {
    let map = new Dictionary<Version>();
    for (const name in BrowserCompatData.browsers) {
        const versionStrings: string[] = Object.keys(BrowserCompatData.browsers[name].releases);
        const versions: Version[] = versionStrings.map(x => Version.fromString(x));
        const minVersion: Version = versions.reduce((a, x) => (Version.compare(a, x) < 0) ? a : x);
        map.set(name, minVersion);
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
function _stripHTML(str: string): string {
    return str
        .replace(/<[^>]+>/g, "")
        .replace(/&(?:lt|gt|amp);/g, m => (m === "&lt;") ? "<" : ((m === "&gt;") ? ">" : "&"));
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
function _makeNotSupportedIssue(name: string, propName: string | null, csi: ClientSupportInfo): Issue {
    return new Issue(
        (propName !== null) ? name + "." + propName : name, 
        csi.description, IssueKind.NOT_SUPPORTED);
}

/**
 * Checks if an issue should be ignored based on the given flags.
 * 
 * @returns True if the issue should be ignored, otherwise false.
 * @param issue The issue to check.
 * @param flags A set of flags from ClientCompatCheckerFlags.
 */
function _shouldDiscardIssueBasedOnFlags(issue: Issue, flags: ClientCompatCheckerFlags): boolean {
    if ((flags & ClientCompatCheckerFlags.IGNORE_NOTES) !== 0
        && issue.kind === IssueKind.NOTE)
    {
        return true;
    }

    if ((flags & ClientCompatCheckerFlags.IGNORE_PARTIAL_IMPL) !== 0
        && issue.kind === IssueKind.IS_PARTIAL_IMPL)
    {
        return true;
    }

    return false;
}

function _getIssuesFromCompatStatement(
    csi: ClientSupportInfo, typeName: string, propName: string | null,
    compatDataObj: any, flags: ClientCompatCheckerFlags, issues: Issue[]): boolean 
{
    if (!compatDataObj)
        return false;

    const support: any = compatDataObj.support[csi.name];
    if (!support) {
        issues.push(_makeNotSupportedIssue(typeName, propName, csi));
        return true;
    }

    const url: string | null = compatDataObj.mdn_url ? String(compatDataObj.mdn_url) : null;
    const oldIssuesLength: number = issues.length;

    if (Array.isArray(support)) {
        const supportArr: any[] = <any[]>support;

        for (let i: number = 0; i < supportArr.length; i++)
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

        for (let i: number = 0; i < supportArr.length; i++) {
            const issue: Issue | null = 
                _getIssueFromSupportStatement(typeName, propName, url, csi, flags, supportArr[i]);
            if (issue !== null)
                issues.push(issue);
        }
    }
    else {
        _convertSupportStatementVersions(support);

        let issue: Issue | null;
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
function _convertSupportStatementVersions(support: any) {
    const versionAdded: any = support.version_added;
    const versionRemoved: any = support.version_removed;

    if (!(versionAdded instanceof Version)) {
        let vAdded: Version;

        if (versionAdded === true) {
            vAdded = Version.minVal;
        }
        else if (versionAdded === false) {
            vAdded = Version.infinite;
        }
        else if (typeof(versionAdded) === "string") {
            const s = <string>versionAdded;
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
        let vRemoved: Version;

        if (typeof(versionRemoved) === "string")
            vRemoved = Version.fromString(<string>versionRemoved);
        else
            vRemoved = Version.infinite;

        support.version_removed = vRemoved;
    }
}

function _checkIfSupportedVersion(
    csi: ClientSupportInfo, support: any, withNoIssues: boolean = false): boolean 
{
    if (!Array.isArray(support)) {
        if (Version.compare(csi.minVersion, <Version>support.version_added) < 0
            || Version.compare(csi.maxVersion, <Version>support.version_removed) >= 0) 
        {
            return false;
        }

        if (!withNoIssues)
            return true;

        return !(support.prefix || support.alternative_name 
            || support.flags || support.partial_implementation);
    }

    let arr: any[] = <any[]>support;
    if (withNoIssues)
        arr = arr.filter(x => !(x.prefix || x.alternative_name || x.flags || x.partial_implementation));

    if (arr.length === 0)
        return false;
    if (arr.length === 1)
        return _checkIfSupportedVersion(csi, arr[0]);

    arr.sort((a, b) => {
        let r: number = Version.compare(
            <Version>a.version_removed, <Version>b.version_removed);
        if (r !== 0)
            return r;
        return Version.compare(<Version>a.version_added, <Version>b.version_added);
    });

    const vMin: Version = csi.minVersion;
    const vMax: Version = csi.maxVersion;

    let firstVersionAdded: Version = <Version>arr[0].version_added;
    let lastVersionRemoved: Version = <Version>arr[arr.length - 1].version_removed;

    for (let i: number = 0; i < arr.length - 1; i++) {
        const removed: Version = <Version>arr[i].version_removed;
        const nextAdded: Version = <Version>arr[i + 1].version_added;

        if (Version.compare(nextAdded, removed) > 0
            && Version.compare(vMin, nextAdded) < 0
            && Version.compare(vMax, removed) >= 0) 
        {
            return false;
        }

        if (Version.compare(nextAdded, firstVersionAdded) < 0)
            firstVersionAdded = nextAdded;
    }

    if (Version.compare(vMin, firstVersionAdded) < 0
        || Version.compare(vMax, lastVersionRemoved) >= 0) 
    {
        return false;
    }

    return true;
}

function _getIssueFromSupportStatement(
    typeName: string, propName: string | null, url: string | null,
    csi: ClientSupportInfo, flags: ClientCompatCheckerFlags, support: any): Issue | null
{
    const versionAdded: Version = <Version>support.version_added;
    const versionRemoved: Version = <Version>support.version_removed;

    if (Version.compare(csi.maxVersion, versionAdded) < 0
        || Version.compare(csi.minVersion, versionRemoved) >= 0) 
    {
        return null;
    }

    let notes: string | null = support.notes ? _stripHTML(String(support.notes)) : null;

    let issueKind: IssueKind;
    let altOrPrefix: string | null = null;

    if (support.prefix) {
        issueKind = IssueKind.NEEDS_PREFIX;
        altOrPrefix = String(support.prefix);
    }
    else if (support.alternative_name) {
        issueKind = IssueKind.NEEDS_ALT_NAME;
        altOrPrefix = String(support.alternative_name);
    }
    else if (support.flags) {
        issueKind = IssueKind.NEEDS_FLAG;
    }
    else if (support.partial_implementation === true) {
        issueKind = IssueKind.IS_PARTIAL_IMPL;
    }
    else if (notes !== null) {
        issueKind = IssueKind.NOTE;
    }
    else {
        return null;
    }

    const featureName: string = (propName !== null) ? typeName + "." + propName : typeName; 
    const issue = new Issue(
        featureName, csi.description, issueKind, altOrPrefix, notes, url, versionAdded, versionRemoved);

    if (_shouldDiscardIssueBasedOnFlags(issue, flags))
        return null;

    return issue;
}

class ClientSupportInfo {

    /**
     * The name of the client represented by this instance.
     */
    public readonly name: string;

    /**
     * The display name of the client which should be used for human readable messages.
     */
    public readonly displayName: string;

    /**
     * The minimum version of the client represented by this instance.
     */
    public readonly minVersion: Version;

    /**
     * The maximum version of the client represented by this instance.
     */
    public readonly maxVersion: Version;

    /**
     * A description string containing the client display name and version information.
     */
    public readonly description: string;

    /**
     * A dictionary containing compatibility issues associated with global entities,
     * indexed by name.
     */
    private readonly m_globalIssues: Dictionary<Issue | Issue[]> = new Dictionary<Issue | Issue[]>();

    /**
     * A dictionary containing compatibility issues associated with properties and methods
     * of types. This is indexed by type name and then by property name.
     */
    private readonly m_propertyIssues: Dictionary<Dictionary<Issue | Issue[]>> = new Dictionary<Dictionary<Issue | Issue[]>>();

    /**
     * A dictionary containing compatibility issues associated with events
     * of types. This is indexed by type name and then by event name.
     */
    private readonly m_eventIssues: Dictionary<Dictionary<Issue | Issue[]>> = new Dictionary<Dictionary<Issue | Issue[]>>();

    /**
     * Creates a new instance of ClientSupportInfo.
     * 
     * @param name        The name of the client.
     * @param minVersion  The minimum client version. Use Version.minVal if this instance
     *                    is to represent a version range without a lower bound.
     * @param maxVersion  The maximum client version. Use Version.maxVal if this instance
     *                    is to represent a version range without an upper bound.
     */
    private constructor(name: string, minVersion: Version, maxVersion: Version) {
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
    public static create(versionInfo: any, flags: ClientCompatCheckerFlags): ClientSupportInfo[] {

        const csiArr: ClientSupportInfo[] = [];

        for (let name in versionInfo) {
            if (name.length === 0 || !(name in BrowserCompatData.browsers))
                throw new RangeError("Invalid target name: " + name);

            let minVer: Version = Version.minVal;
            let maxVer: Version = Version.maxVal;

            let ver: any = versionInfo[name];

            if (typeof(ver) === "number") {
                // Don't use the fractional part of the number as a minor version,
                // as this could be affected by floating point errors.
                if (ver % 1 !== 0)
                    console.error("Target '" + name + "': fractions in numeric versions will be ignored. Use a string if a minor version is to be provided.")
                minVer = Version.create(<number>ver);
            }
            else if (typeof(ver) === "string") {
                const s: string = <string>ver;
                if (s !== "*") {
                    let p: number = s.indexOf("-");
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
                throw new RangeError("Invalid version range for target: " + name);

            if (Version.compare(minVer, Version.minVal) === 0)
                minVer = _minClientVersions.get(name) || Version.minVal;

            csiArr.push(new ClientSupportInfo(name, minVer, maxVer));
        }

        ClientSupportInfo._loadCompatDataFromModule(csiArr, flags);
        return csiArr;

    }

    /**
     * Loads the compatibility data from the mdn-browser-compat-data module.
     * 
     * @param csiArr  An array of ClientSupportInfo objects representing
     *                a list of target clients and their version ranges
     *                into which to load the data.
     * @param flags   A set of flags from ClientCompatCheckerFlags indicating whether
     *                certain kinds of issues should not be reported.
     */
    private static _loadCompatDataFromModule(
        csiArr: ClientSupportInfo[], flags: ClientCompatCheckerFlags): void 
    {
        ClientSupportInfo._loadCompatData(csiArr, BrowserCompatData.javascript.builtins, flags);
        ClientSupportInfo._loadCompatData(csiArr, BrowserCompatData.api, flags);

        for (let i: number = 0; i < csiArr.length; i++)
            csiArr[i]._importGlobalIssuesFromWindow();
    }

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
    private static _loadCompatData(
        csiArr: ClientSupportInfo[], compatData: any, flags: ClientCompatCheckerFlags): void 
    {
        const issues: Issue[] = [];

        for (const name in compatData) {
            const compatDataForName: any = compatData[name];
            const members: string[] = Object.keys(compatDataForName);

            for (let i: number = 0; i < csiArr.length; i++) {
                const csi: ClientSupportInfo = csiArr[i];

                issues.length = 0;
                if (_getIssuesFromCompatStatement(csi, name, null, compatDataForName.__compat, flags, issues)) {                    
                    if (issues.length === 1)
                        csi.m_globalIssues.set(name, issues[0]);
                    else
                        csi.m_globalIssues.set(name, issues.slice());
                }

                if (members.length === 0)
                    continue;

                let propIssuesForType = csi.m_propertyIssues.get(name);
                let eventIssuesForType = csi.m_eventIssues.get(name);

                for (let i: number = 0; i < members.length; i++) {
                    const memberName: string = members[i];

                    const isEvent: boolean = stringEndsWith(memberName, "_event");
                    let memberNameWithoutSuffix: string = memberName;

                    if (isEvent) {
                        memberNameWithoutSuffix = memberName.substr(0, memberName.length - 6);
                    }
                    else if (memberName.indexOf("_") !== -1
                        || stringStartsWith(memberName, "@@") || memberName === name)
                    {
                        continue;
                    }

                    issues.length = 0;
                    const hasIssues: boolean = _getIssuesFromCompatStatement(
                        csi, name, memberNameWithoutSuffix, compatDataForName[memberName].__compat, flags, issues);
                    
                    if (!hasIssues)
                        continue;

                    let issueDict = isEvent ? eventIssuesForType : propIssuesForType;
                    if (issueDict === undefined) {
                        if (isEvent) {
                            issueDict = eventIssuesForType = new Dictionary<Issue | Issue[]>();
                            csi.m_eventIssues.set(name, issueDict);
                        }
                        else {
                            issueDict = propIssuesForType = new Dictionary<Issue | Issue[]>();
                            csi.m_propertyIssues.set(name, issueDict);
                        }
                    }

                    if (issues.length === 1)
                        issueDict.set(memberNameWithoutSuffix, issues[0]);
                    else
                        issueDict.set(memberNameWithoutSuffix, issues.slice());
                }
            }
        }

    }

    /**
     * Adds any issues associated with properties of the Window type and
     * its associated interfaces to the global issue table. This is needed 
     * for checking scripts for use in web browsers, where the window object 
     * is part of the global scope.
     */
    private _importGlobalIssuesFromWindow(): void {
        const window = this.m_propertyIssues.get("Window");
        if (window)
            window.forEach((k, v) => this.m_globalIssues.set(k, v));
        const wwgs = this.m_propertyIssues.get("WindowOrWorkerGlobalScope");
        if (wwgs)
            wwgs.forEach((k, v) => this.m_globalIssues.set(k, v));
    }

    /**
     * Finds any compatibility issues associated with a global type,
     * variable or function for the client version range represented by
     * this ClientSupportInfo object.
     * 
     * @param name   The name of the global entity for which to check for
     *               compatibility issues.
     * @param issues An array to which any issues found will be appended.
     */
    public getGlobalIssues(name: string, issues: Issue[]): void {
        const issuesFound = this.m_globalIssues.get(name);
        if (issuesFound === undefined)
            return;
        
        if (Array.isArray(issuesFound))
            issues.push.apply(issues, <Issue[]>issuesFound);
        else
            issues.push(<Issue>issuesFound);
    }

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
    public getPropertyOrEventIssues(
        typeName: string, propName: string, isEvent: boolean, issues: Issue[]): void
    {
        const typeDict = isEvent ? this.m_eventIssues : this.m_propertyIssues;
        const propDict = typeDict.get(typeName);
        if (propDict === undefined)
            return;

        const issuesFound = propDict.get(propName);
        if (issuesFound === undefined)
            return;
        
        if (Array.isArray(issuesFound))
            issues.push.apply(issues, <Issue[]>issuesFound);
        else
            issues.push(<Issue>issuesFound);
    }

    /**
     * Gets a string containing the client display name and version range
     * represented by this instance.
     * 
     * @returns A string containing the client display name and version range.
     */
    private _getClientDescString(): string {
        if (Version.compare(this.minVersion, Version.minVal) === 0
            && Version.compare(this.maxVersion, Version.maxVal) === 0) 
        {
            return this.displayName;
        }

        let vstr: string;

        if (Version.compare(this.minVersion, this.maxVersion) === 0)
            vstr = this.minVersion.toString();
        else if (Version.compare(this.minVersion, Version.minVal) === 0)
            vstr = "<=" + this.maxVersion.toString();
        else if (Version.compare(this.maxVersion, Version.maxVal) === 0)
            vstr = ">=" + this.minVersion.toString();
        else
            vstr = this.minVersion.toString() + "-" + this.maxVersion.toString();

        return this.displayName + " " + vstr;
    }

}

/**
 * An array containing the supported client names.
 */
const supportedClientNames: string[] = Object.keys(BrowserCompatData.browsers);

const enum ClientCompatCheckerFlags {
    IGNORE_NOTES = 1,
    IGNORE_PARTIAL_IMPL = 2,
}

class ClientCompatChecker {

    private m_clientSupportInfo: ClientSupportInfo[] = [];
    private m_flags: ClientCompatCheckerFlags;

    public constructor(versionInfo: any, flags: ClientCompatCheckerFlags = 0) {
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
    public checkGlobal(name: string, issues: Issue[]): boolean {
        const csiArr: ClientSupportInfo[] = this.m_clientSupportInfo;
        const oldIssuesLength: number = issues.length;
        
        for (let i: number = 0; i < csiArr.length; i++)
            csiArr[i].getGlobalIssues(name, issues);

        return issues.length !== oldIssuesLength;
    }

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
    public checkPropertyOrEvent(
        typeName: string, propName: string, isEvent: boolean, issues: Issue[]): boolean
    {
        const csiArr: ClientSupportInfo[] = this.m_clientSupportInfo;
        const oldIssuesLength: number = issues.length;

        for (let i: number = 0; i < csiArr.length; i++) 
            csiArr[i].getPropertyOrEventIssues(typeName, propName, isEvent, issues);
        
        return issues.length !== oldIssuesLength;
    }

}