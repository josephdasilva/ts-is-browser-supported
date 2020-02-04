"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
Object.defineProperty(exports, "__esModule", { value: true });
var tslint_1 = require("tslint");
var Walker_1 = require("./Walker");
var utils_1 = require("./utils");
var ClientCompatChecker_1 = require("./ClientCompatChecker");
var Rule = /** @class */ (function (_super) {
    __extends(Rule, _super);
    function Rule(options) {
        var _this = _super.call(this, options) || this;
        _this.m_compatChecker = null;
        _this.m_globalWhitelist = null;
        _this.m_propertyWhitelist = null;
        _this.m_eventWhitelist = null;
        _this.m_init = false;
        return _this;
    }
    Rule.prototype.applyWithProgram = function (sourceFile, program) {
        // Initialisation is done here instead of in the constructor,
        // so that any exception thrown will be visible in the VS Code
        // problems panel.
        var _a;
        if (!this.m_init) {
            this.m_compatChecker = _createOrGetCachedCompatChecker(this.ruleArguments[0]);
            _a = _parseWhitelist(this.ruleArguments[0].whitelist), this.m_globalWhitelist = _a[0], this.m_propertyWhitelist = _a[1], this.m_eventWhitelist = _a[2];
            this.m_init = true;
        }
        var walker = new Walker_1.Walker(sourceFile, program, this.ruleName, this.m_compatChecker, this.m_globalWhitelist, this.m_propertyWhitelist, this.m_eventWhitelist);
        return this.applyWithWalker(walker);
    };
    Rule.metadata = {
        ruleName: "check-browser-compatibility",
        type: "functionality",
        typescriptOnly: false,
        requiresTypeInfo: true,
        description: "Checks code for possible compatibility issues with a given list of browsers.",
        descriptionDetails: tslint_1.Utils.dedent(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n            This rule checks TypeScript code for compatibility issues with a list \n            of target browsers which the code is intended to be able to run on.\n            It will report an error if any type, function, property or event\n            (passed as the first argument of an addEventListener call) used\n            in the code is not supported on any of the target browsers.\n\n            This rule can also be used on JavaScript code, if type information\n            is available from JSDoc comments.\n\n            This rule uses compatibility data provided by MDN. It requires the Node module\n            \"mdn-browser-compat-data\" to be installed.\n\n            Errors reported by the checker can be suppressed either by whitelisting\n            the feature for which the error is reported (see the \"whitelist\"\n            configuration option) or by using conditional statements to check for\n            the existence of the feature before it is used. Some supported conditional\n            statements are:\n\n            * if (typeof(A) !== \"undefined\") { A(); }\n            * if (typeof(A) === \"function\") { A(); }\n            * if (typeof(A) !== \"undefined\" && A.x) { A.x(); }\n            * if (typeof(A) === \"object\" && A.x) { A.x(); }\n            * if (typeof(A) !== \"undefined\" && A.x && A.x.y) { A.x.y(); }\n            * if (A.x) { A.x(); /* if A exists */ }\n            * if (T.prototype.x) { instanceOfT.x(); }\n            * (typeof(A) !== \"undefined\") ? A() : something_else;\n            * (typeof(A) !== \"undefined\" && A.x) ? A.x() : something_else;\n            * A.x ? A.x() : something_else; /* if A exists */\n            * typeof(A) !== \"undefined\" && A();\n            * typeof(A) !== \"undefined\" && A.x && A.x();\n            * A.x && A.x();  /* if A exists */\n        "], ["\n            This rule checks TypeScript code for compatibility issues with a list \n            of target browsers which the code is intended to be able to run on.\n            It will report an error if any type, function, property or event\n            (passed as the first argument of an addEventListener call) used\n            in the code is not supported on any of the target browsers.\n\n            This rule can also be used on JavaScript code, if type information\n            is available from JSDoc comments.\n\n            This rule uses compatibility data provided by MDN. It requires the Node module\n            \"mdn-browser-compat-data\" to be installed.\n\n            Errors reported by the checker can be suppressed either by whitelisting\n            the feature for which the error is reported (see the \"whitelist\"\n            configuration option) or by using conditional statements to check for\n            the existence of the feature before it is used. Some supported conditional\n            statements are:\n\n            * if (typeof(A) !== \"undefined\") { A(); }\n            * if (typeof(A) === \"function\") { A(); }\n            * if (typeof(A) !== \"undefined\" && A.x) { A.x(); }\n            * if (typeof(A) === \"object\" && A.x) { A.x(); }\n            * if (typeof(A) !== \"undefined\" && A.x && A.x.y) { A.x.y(); }\n            * if (A.x) { A.x(); /* if A exists */ }\n            * if (T.prototype.x) { instanceOfT.x(); }\n            * (typeof(A) !== \"undefined\") ? A() : something_else;\n            * (typeof(A) !== \"undefined\" && A.x) ? A.x() : something_else;\n            * A.x ? A.x() : something_else; /* if A exists */\n            * typeof(A) !== \"undefined\" && A();\n            * typeof(A) !== \"undefined\" && A.x && A.x();\n            * A.x && A.x();  /* if A exists */\n        "]))),
        optionsDescription: tslint_1.Utils.dedent(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n            The options for this rule must be an object which may have the\n            following properties: \"targets\", \"whitelist\", \"showNotes\" and\n            \"showPartialImplementations\".\n\n            The \"targets\" property specifies the browsers for which to check \n            the code for compatibility. This is an object where the keys are \n            the names of the browsers for which the code needs to be checked. \n            The currently accepted names are: \"chrome\", \"chrome_android\", \"edge\", \n            \"firefox\", \"firefox_android\", \"ie\", \"nodejs\", \"opera\", \"opera_android\", \n            \"qq_android\", \"safari\", \"safari_ios\", \"samsunginternet_android\", \n            \"uc_android\", \"uc_chinese_android\" and \"webview_android\".\n\n            For each browser name, the corresponding value in this object may be:\n            * A string indicating the minimum browser version (e.g. \"1\", \"1.2\").\n            * A string indicating a range of supported versions (e.g. \"1-10\", \"1.0-1.8\")\n            * An integer indicating the minimum version. If the value is a number with a\n              fraction, the fraction is discarded and only the integer part is used.\n            * The string \"*\", indicating that all versions of the browser must be supported.\n\n            Set the \"showPartialImplementations\" property to true to emit messages \n            that indicate that a feature or API being used is partially implemented in\n            one of the target browsers. These messages are not suppressed by the use\n            of conditional statements, since they are associated with features \n            that exist. They are, however, suppressed for whitelisted features.\n            The default value of this property is false.\n        \n            Set the \"showNotes\" property to true to emit additional messages \n            available in the MDN database for APIs that are otherwise fully supported. \n            These messages are advisory in nature and usually do not indicate any \n            problem. They messages are not suppressed by the use of conditional \n            statements, but are suppressed for whitelisted features.The default \n            value of this property is false.\n\n            The \"whitelist\" property, if specified, is array of whitelisted items. \n            Any compatibility issues related to these items will be suppressed.\n            Each item in this array must be a string that represents a type,\n            global variable or function, property, method or event to be whitelisted:\n\n            * To whitelist a type or global variable or function, use its name.\n            * To whitelist a property or method on a type, use \"TypeName.propName\".\n              This applies to both instance and static properties/methods.\n            * To whitelist an event on a type, use \"TypeName.@eventName\".\n            * To whitelist all properties and methods on a type, use \"TypeName.*\".\n            * To whitelist all events on a type, use \"TypeName.@*\".\n\n            Note that whitelisting a type does not automatically whitelist its properties,\n            methods and/or events. These must be explicitly whitelisted if needed.\n\n            For example, [\"Map\", \"Object.values\", \"Math.*\", \"Window.@storage\", \"Element.@*\"]\n            will whitelist the Map type, the Object.values method, all properties and methods\n            of the Math type, the storage event of the Window type and all events of the\n            Element type.\n        "], ["\n            The options for this rule must be an object which may have the\n            following properties: \"targets\", \"whitelist\", \"showNotes\" and\n            \"showPartialImplementations\".\n\n            The \"targets\" property specifies the browsers for which to check \n            the code for compatibility. This is an object where the keys are \n            the names of the browsers for which the code needs to be checked. \n            The currently accepted names are: \"chrome\", \"chrome_android\", \"edge\", \n            \"firefox\", \"firefox_android\", \"ie\", \"nodejs\", \"opera\", \"opera_android\", \n            \"qq_android\", \"safari\", \"safari_ios\", \"samsunginternet_android\", \n            \"uc_android\", \"uc_chinese_android\" and \"webview_android\".\n\n            For each browser name, the corresponding value in this object may be:\n            * A string indicating the minimum browser version (e.g. \"1\", \"1.2\").\n            * A string indicating a range of supported versions (e.g. \"1-10\", \"1.0-1.8\")\n            * An integer indicating the minimum version. If the value is a number with a\n              fraction, the fraction is discarded and only the integer part is used.\n            * The string \"*\", indicating that all versions of the browser must be supported.\n\n            Set the \"showPartialImplementations\" property to true to emit messages \n            that indicate that a feature or API being used is partially implemented in\n            one of the target browsers. These messages are not suppressed by the use\n            of conditional statements, since they are associated with features \n            that exist. They are, however, suppressed for whitelisted features.\n            The default value of this property is false.\n        \n            Set the \"showNotes\" property to true to emit additional messages \n            available in the MDN database for APIs that are otherwise fully supported. \n            These messages are advisory in nature and usually do not indicate any \n            problem. They messages are not suppressed by the use of conditional \n            statements, but are suppressed for whitelisted features.The default \n            value of this property is false.\n\n            The \"whitelist\" property, if specified, is array of whitelisted items. \n            Any compatibility issues related to these items will be suppressed.\n            Each item in this array must be a string that represents a type,\n            global variable or function, property, method or event to be whitelisted:\n\n            * To whitelist a type or global variable or function, use its name.\n            * To whitelist a property or method on a type, use \"TypeName.propName\".\n              This applies to both instance and static properties/methods.\n            * To whitelist an event on a type, use \"TypeName.@eventName\".\n            * To whitelist all properties and methods on a type, use \"TypeName.*\".\n            * To whitelist all events on a type, use \"TypeName.@*\".\n\n            Note that whitelisting a type does not automatically whitelist its properties,\n            methods and/or events. These must be explicitly whitelisted if needed.\n\n            For example, [\"Map\", \"Object.values\", \"Math.*\", \"Window.@storage\", \"Element.@*\"]\n            will whitelist the Map type, the Object.values method, all properties and methods\n            of the Math type, the storage event of the Window type and all events of the\n            Element type.\n        "]))),
        options: {
            type: "object",
            properties: {
                targets: {
                    type: "object",
                    properties: {},
                    additionalProperties: true,
                },
                whitelist: {
                    type: "array",
                    items: { type: "string" },
                },
                showNotes: { type: "boolean" },
                showPartialImplementations: { type: "boolean" },
            },
            required: ["targets"],
            additionalProperties: false,
        },
    };
    return Rule;
}(tslint_1.Rules.TypedRule));
exports.Rule = Rule;
var _cachedTargets = {};
var _cachedFlags = 0;
var _cachedCompatChecker = null;
function _createOrGetCachedCompatChecker(options) {
    var targets = options.targets || {};
    var showNotes = Boolean(("showNotes" in options) ? options.showNotes : false);
    var showPartial = Boolean(("showPartialImplementations" in options) ? options.showPartialImplementations : false);
    var flags = 0;
    if (!showNotes)
        flags |= 1 /* IGNORE_NOTES */;
    if (!showPartial)
        flags |= 2 /* IGNORE_PARTIAL_IMPL */;
    var cacheMatch = (_cachedFlags === flags);
    for (var i = 0; i < ClientCompatChecker_1.supportedClientNames.length && cacheMatch; i++) {
        var name_1 = ClientCompatChecker_1.supportedClientNames[i];
        cacheMatch = cacheMatch && (targets[name_1] === _cachedTargets[name_1]);
    }
    if (cacheMatch)
        return _cachedCompatChecker;
    var checker = new ClientCompatChecker_1.ClientCompatChecker(targets, flags);
    _cachedTargets = targets;
    _cachedFlags = flags;
    _cachedCompatChecker = checker;
    return checker;
}
function _parseWhitelist(list) {
    var globalWhitelist = new utils_1.Dictionary();
    var propertyWhitelist = new utils_1.Dictionary();
    var eventWhitelist = new utils_1.Dictionary();
    if (list === undefined)
        return [globalWhitelist, propertyWhitelist, eventWhitelist];
    if (!Array.isArray(list))
        throw new TypeError("Whitelist must be an array.");
    if (!list.every(function (x) { return typeof (x) === "string"; }))
        throw new TypeError("The whitelist array must contain only strings.");
    var strings = list;
    for (var i = 0; i < strings.length; i++) {
        var str = strings[i];
        var dotPos = str.indexOf(".");
        if (dotPos === -1)
            globalWhitelist.set(str, true);
        else if (dotPos !== str.length - 1 && str.charCodeAt(dotPos + 1) === 0x40)
            eventWhitelist.getOrNew(str.substr(0, dotPos), utils_1.Dictionary).set(str.substr(dotPos + 2), true);
        else
            propertyWhitelist.getOrNew(str.substr(0, dotPos), utils_1.Dictionary).set(str.substr(dotPos + 1), true);
    }
    return [globalWhitelist, propertyWhitelist, eventWhitelist];
}
var templateObject_1, templateObject_2;
