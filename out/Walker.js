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
Object.defineProperty(exports, "__esModule", { value: true });
var tslint_1 = require("tslint");
var ts = require("typescript");
var utils_1 = require("./utils");
var _WINDOW_TYPE = "Window";
var _GLOBAL_THIS_TYPE = "globalThis";
var _ADD_EVENT_LISTENER = "addEventListener";
var Walker = /** @class */ (function (_super) {
    __extends(Walker, _super);
    function Walker(sourceFile, program, ruleName, compatChecker, globalWhitelist, propertyWhitelist, eventWhitelist) {
        var _this = _super.call(this, sourceFile, ruleName, undefined) || this;
        /**
         * This contains a list of property access expressions
         * (as arrays of names) that are known to be defined in the
         * current scope because they were checked in the condition
         * of a conditional statement or expression. So no issues that
         * indicate that a feature is not supported (or supported under
         * certain conditions) should be reported for instances of these
         * expressions.
         */
        _this.m_guardStack = [];
        _this.m_typeChecker = program.getTypeChecker();
        _this.m_compatChecker = compatChecker;
        _this.m_globalWhitelist = globalWhitelist;
        _this.m_propertyWhitelist = propertyWhitelist;
        _this.m_eventWhitelist = eventWhitelist;
        // Ensure that "this" is captured in these callbacks.
        _this.m_visitCallback = function (x) { return _this._visit(x); };
        _this.m_visitTypeNodeCallback = function (x) { return _this._visitTypeNode(x); };
        return _this;
    }
    Walker.prototype.walk = function (sourceFile) {
        return sourceFile.forEachChild(this.m_visitCallback);
    };
    Walker.prototype._visit = function (node, isInGuardContext) {
        if (isInGuardContext === void 0) { isInGuardContext = false; }
        switch (node.kind) {
            case ts.SyntaxKind.ParenthesizedExpression:
                return this._visit(_unwrapParentheses(node), isInGuardContext);
            case ts.SyntaxKind.PropertyAccessExpression:
                return this._visitPropertyAccess(node, isInGuardContext);
            case ts.SyntaxKind.CallExpression:
                return this._visitCallOrNew(node);
            case ts.SyntaxKind.NewExpression:
                return this._visitCallOrNew(node);
            case ts.SyntaxKind.ElementAccessExpression:
                return this._visitElementAccess(node);
            case ts.SyntaxKind.BinaryExpression:
                return this._visitBinaryExpression(node);
            case ts.SyntaxKind.IfStatement:
                return this._visitIfStatement(node);
            case ts.SyntaxKind.ConditionalExpression:
                return this._visitConditionalExpression(node);
            case ts.SyntaxKind.MethodDeclaration:
            case ts.SyntaxKind.MethodSignature:
            case ts.SyntaxKind.Constructor:
            case ts.SyntaxKind.GetAccessor:
            case ts.SyntaxKind.SetAccessor:
            case ts.SyntaxKind.FunctionExpression:
            case ts.SyntaxKind.FunctionDeclaration:
            case ts.SyntaxKind.ArrowFunction:
            case ts.SyntaxKind.IndexSignature:
                return this._visitFunctionDecl(node);
            case ts.SyntaxKind.VariableDeclaration:
            case ts.SyntaxKind.PropertyDeclaration:
            case ts.SyntaxKind.PropertySignature:
            case ts.SyntaxKind.Parameter:
                return this._visitVariableDecl(node);
            case ts.SyntaxKind.TypeReference:
                return this._visitTypeNode(node);
            default:
                return node.forEachChild(this.m_visitCallback);
        }
    };
    /**
     * Visitor for a property access expression.
     *
     * @param node              A property access expression node.
     * @param isInGuardContext  This should be set to true for a property access that
     *                          will be used as a guard expression. This is to ensure that
     *                          no issues are reported indicating that a property does not
     *                          exist when the intent of the code is to check whether it
     *                          exists or not.
     */
    Walker.prototype._visitPropertyAccess = function (node, isInGuardContext) {
        var propName = node.name.text;
        var targetType = this.m_typeChecker.getApparentType(this.m_typeChecker.getTypeAtLocation(node.expression));
        var targetSymbol = undefined;
        if (node.expression.kind === ts.SyntaxKind.Identifier)
            targetSymbol = this.m_typeChecker.getSymbolAtLocation(node.expression);
        var isStatic = targetSymbol !== undefined
            && (targetSymbol.flags & ts.SymbolFlags.Type) !== 0;
        if (isInGuardContext) {
            // If this is a static property access in a guard context, the type
            // must still be checked - unless the type is also guarded, in which
            // case there it would already exist on the current guard stack.
            if (isStatic)
                this._checkGlobal(node.expression, targetSymbol);
            return;
        }
        var prop = this.m_typeChecker.getPropertyOfType(targetType, propName);
        if (prop === undefined)
            return;
        var declType = this._getDeclaringType(prop);
        var checkBaseTypes = false;
        if (declType === null) {
            declType = targetType;
            checkBaseTypes = true;
        }
        if (isStatic)
            this._checkGlobal(node.expression, targetSymbol);
        this._checkPropertyOrEvent(node, declType, prop, isStatic, false, checkBaseTypes);
        return this._visit(node.expression);
    };
    /**
     * Visitor for an element access expression.
     * @param node An element access expression node.
     */
    Walker.prototype._visitElementAccess = function (node) {
        if (ts.isIdentifier(node.expression)) {
            var symbol = this.m_typeChecker.getSymbolAtLocation(node.expression);
            if (symbol !== undefined)
                this._checkGlobal(node.expression, symbol);
        }
        else {
            this._visit(node.expression);
        }
        this._visit(node.argumentExpression);
    };
    /**
     * Visitor for a function call or new expression.
     * @param node A call or new expression node.
     */
    Walker.prototype._visitCallOrNew = function (node) {
        if (node.typeArguments !== undefined)
            node.typeArguments.forEach(this.m_visitTypeNodeCallback);
        var func = node.expression;
        if (ts.isIdentifier(func)) {
            var symbol = this.m_typeChecker.getSymbolAtLocation(func);
            if (symbol !== undefined)
                this._checkGlobal(func, symbol);
        }
        else {
            this._visit(func);
            if (ts.isCallExpression(node))
                this._checkAddEventListenerCall(node);
        }
        if (node.arguments !== undefined)
            return node.arguments.forEach(this.m_visitCallback);
    };
    /**
     * Checks for compatibility of events in addEventListener calls. If the
     * given node does not represent a call to addEventListener, nothing is done.
     *
     * @param node A call expression node.
     */
    Walker.prototype._checkAddEventListenerCall = function (node) {
        if (node.arguments.length < 2)
            return;
        var func = node.expression;
        if (func.kind !== ts.SyntaxKind.PropertyAccessExpression)
            return;
        var propAccess = node.expression;
        if (propAccess.name.text !== _ADD_EVENT_LISTENER)
            return;
        var firstArg = node.arguments[0];
        if (firstArg.kind !== ts.SyntaxKind.StringLiteral)
            return;
        var eventName = firstArg.text;
        var targetType = this.m_typeChecker.getTypeAtLocation(propAccess.expression);
        this._checkPropertyOrEvent(firstArg, targetType, eventName, false, true, false);
    };
    /**
     * Visitor for a function declaration.
     * @param node A function or index signature declaration node.
     */
    Walker.prototype._visitFunctionDecl = function (node) {
        if (node.type !== undefined)
            this._visitTypeNode(node.type);
        if (node.decorators !== undefined)
            node.decorators.forEach(this.m_visitCallback);
        if (node.typeParameters !== undefined)
            node.typeParameters.forEach(this.m_visitCallback);
        node.parameters.forEach(this.m_visitCallback);
        if (node.kind !== ts.SyntaxKind.IndexSignature) {
            var body = node.body;
            if (body !== undefined)
                return this._visit(body);
        }
    };
    /**
     * Visitor for a variable, property or parameter declaration.
     * @param node A variable, property or parameter declaration node.
     */
    Walker.prototype._visitVariableDecl = function (node) {
        if (node.decorators !== undefined)
            node.decorators.forEach(this.m_visitCallback);
        if (!("type" in node) || node.type === undefined) {
            // Type may be inferred.
            // Not checking binding patterns for now.
            if (node.name.kind !== ts.SyntaxKind.ArrayBindingPattern
                && node.name.kind !== ts.SyntaxKind.ObjectBindingPattern) {
                this._checkType(this._getNodeApparentType(node), node.name);
            }
        }
        else {
            this._visitTypeNode(node.type);
        }
        if (node.kind === ts.SyntaxKind.VariableDeclaration
            || node.kind === ts.SyntaxKind.PropertyDeclaration
            || node.kind === ts.SyntaxKind.Parameter) {
            var nodeWithInit = node;
            if (nodeWithInit.initializer !== undefined)
                this._visit(nodeWithInit.initializer);
        }
    };
    /**
     * Visitor for a type node.
     * @param node A type node.
     */
    Walker.prototype._visitTypeNode = function (node) {
        if (!ts.isTypeNode(node))
            return;
        // Don't recurse in _checkType, since the type node will be recursed.
        this._checkType(this._getNodeApparentType(node), node, false);
        return node.forEachChild(this.m_visitTypeNodeCallback);
    };
    /**
     * Visitor for a binary operator expression.
     * @param node An expression node representing a binary operation.
     */
    Walker.prototype._visitBinaryExpression = function (node) {
        var chainExpressions = null;
        var isOr = false;
        if (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
            || node.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
            isOr = (node.operatorToken.kind == ts.SyntaxKind.BarBarToken);
            chainExpressions = [];
            _getBinaryOpChainOperands(node, node.operatorToken.kind, chainExpressions);
        }
        if (chainExpressions === null || chainExpressions.length <= 1) {
            // This is an ordinary binary expression, not an and-chain or or-chain.
            this._visit(node.left);
            this._visit(node.right);
            return;
        }
        var oldGuardStackDepth = this.m_guardStack.length;
        for (var i = 0; i < chainExpressions.length; i++) {
            var guardExpr = _makeGuardExpression(chainExpressions[i]);
            if (guardExpr.isValid && (isOr ? guardExpr.isNegative : !guardExpr.isNegative)) {
                this._visit(guardExpr.operand, true);
                this.m_guardStack.push(guardExpr.propChain);
            }
            else {
                this._visit(guardExpr.operand, false);
            }
        }
        // Restore the old guard stack once evaluation is finished.
        this.m_guardStack.length = oldGuardStackDepth;
    };
    /**
     * Visitor for an if statement.
     * @param node A node representing an if statement.
     */
    Walker.prototype._visitIfStatement = function (node) {
        return this._visitIfStatementOrExpr(node.expression, node.thenStatement, node.elseStatement);
    };
    /**
     * Visitor for a conditional (?:) expression
     * @param node A node representing a conditional expression.
     */
    Walker.prototype._visitConditionalExpression = function (node) {
        return this._visitIfStatementOrExpr(node.condition, node.whenTrue, node.whenFalse);
    };
    /**
     * Visits an if statement or conditional expression.
     *
     * @param condition The condition expression.
     * @param thenNode  The branch taken if the condition is true.
     * @param elseNode  The branch taken if the condition is false.
     */
    Walker.prototype._visitIfStatementOrExpr = function (condition, thenNode, elseNode) {
        if (elseNode === void 0) { elseNode = undefined; }
        condition = _unwrapParentheses(condition);
        var hasLeadingNotOp = false;
        while (ts.isPrefixUnaryExpression(condition)
            && condition.operator === ts.SyntaxKind.ExclamationToken) {
            hasLeadingNotOp = !hasLeadingNotOp;
            condition = _unwrapParentheses(condition.operand);
        }
        if (condition.kind !== ts.SyntaxKind.BinaryExpression
            && condition.kind !== ts.SyntaxKind.Identifier
            && condition.kind !== ts.SyntaxKind.PropertyAccessExpression) {
            // Fast path.
            this._visit(condition);
            this._visit(thenNode);
            if (elseNode !== undefined)
                this._visit(elseNode);
            return;
        }
        var thenGuards = [];
        var elseGuards = [];
        this._visitIfConditionAndGetGuards(condition, thenGuards, elseGuards);
        if (hasLeadingNotOp) {
            var temp = thenGuards;
            thenGuards = elseGuards;
            elseGuards = temp;
        }
        var oldGuardStackDepth = this.m_guardStack.length;
        this.m_guardStack.push.apply(this.m_guardStack, thenGuards);
        this._visit(thenNode);
        this.m_guardStack.length = oldGuardStackDepth;
        if (elseNode !== undefined) {
            this.m_guardStack.push.apply(this.m_guardStack, elseGuards);
            this._visit(elseNode);
            this.m_guardStack.length = oldGuardStackDepth;
        }
    };
    /**
     * Visits the condition expression of an if statement or conditional expression
     * and extracts any property guards.
     *
     * @param condition  The condition expression to visit.
     * @param thenGuards An array to be filled with the guards that will be active
     *                   for the "then" branch.
     * @param elseGuards An array to be filled with the guards that will be active
     *                   for the "else" branch.
     */
    Walker.prototype._visitIfConditionAndGetGuards = function (condition, thenGuards, elseGuards) {
        if (!ts.isBinaryExpression(condition)) {
            // Fast path.
            // No need to check the !X case as _visitIfStatementOrExpr will remove
            // an outermost not operator if it is present.
            _getPropAccessChainNames(condition, _tempStringArray);
            if (_tempStringArray.length >= 2) {
                thenGuards.push(_tempStringArray.slice());
                this._visit(condition, true);
            }
            else {
                this._visit(condition, false);
            }
            return;
        }
        var isOrChain = false;
        var isSingle = false;
        var chainExpressions = [];
        if (condition.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
            isOrChain = true;
            _getBinaryOpChainOperands(condition, condition.operatorToken.kind, chainExpressions);
        }
        else if (condition.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
            isOrChain = false;
            _getBinaryOpChainOperands(condition, condition.operatorToken.kind, chainExpressions);
        }
        else {
            // Could be something like 'x == undefined' or 'typeof(x) == "undefined"'.
            chainExpressions.push(condition);
            isSingle = true;
        }
        var oldGuardStackDepth = this.m_guardStack.length;
        for (var i = 0; i < chainExpressions.length; i++) {
            var guardExpr = _makeGuardExpression(chainExpressions[i]);
            var isNegative = guardExpr.isNegative;
            var isConditionGuard = isOrChain ? isNegative : !isNegative;
            var isThenGuard = (!isOrChain || isSingle) && !isNegative;
            var isElseGuard = (isOrChain || isSingle) && isNegative;
            if (guardExpr.isValid && (isConditionGuard || isThenGuard || isElseGuard)) {
                this._visit(guardExpr.operand, true);
                if (isConditionGuard)
                    this.m_guardStack.push(guardExpr.propChain);
                if (isThenGuard)
                    thenGuards.push(guardExpr.propChain);
                if (isElseGuard)
                    elseGuards.push(guardExpr.propChain);
            }
            else {
                this._visit(guardExpr.operand, false);
            }
        }
        // Restore the old guard stack once evaluation is finished.
        this.m_guardStack.length = oldGuardStackDepth;
    };
    /**
     * Returns the apparent type of the given node.
     * @param node The expression or declaraton node whose type is to be obtained.
     */
    Walker.prototype._getNodeApparentType = function (node) {
        return this.m_typeChecker.getApparentType(this.m_typeChecker.getTypeAtLocation(node));
    };
    /**
     * Gets the type that declared the given property symbol.
     * @returns The type that declared the symbol, or null if no declaring
     *          type can be found.
     * @param symbol A symbol.
     */
    Walker.prototype._getDeclaringType = function (symbol) {
        if (symbol.declarations.length === 0)
            return null;
        for (var i = 0; i < symbol.declarations.length; i++) {
            var declNode = symbol.declarations[0].parent;
            if ((declNode.kind & (ts.SyntaxKind.ClassDeclaration | ts.SyntaxKind.InterfaceDeclaration)) === 0)
                continue;
            var nameNode = declNode.name;
            if (nameNode !== undefined)
                return this.m_typeChecker.getTypeAtLocation(nameNode);
        }
        return null;
    };
    /**
     * Checks the compatibility of a type.
     *
     * @param type     The type for which to check compatibility.
     * @param node     The node to be used for obtaining the position in the source
     *                 at which any issues are to be reported.
     * @param recurse  If this is true, recursively check the component types of
     *                 union and intersection types and the type arguments
     *                 of generic type instantiations.
     */
    Walker.prototype._checkType = function (type, node, recurse) {
        if (recurse === void 0) { recurse = true; }
        var symbol = type.symbol;
        if (symbol)
            this._checkGlobal(node, symbol);
        if (!recurse)
            return;
        if ((type.flags & ts.TypeFlags.UnionOrIntersection) !== 0) {
            // Check the component types of a union or intersection.
            var components = type.types;
            for (var i = 0; i < components.length; i++)
                this._checkType(components[i], node, recurse);
        }
        else if ((type.flags & ts.TypeFlags.Object) !== 0) {
            // Check the type arguments of a generic type.
            var typeArgs = _getTypeArguments(type);
            if (typeArgs !== null && typeArgs.length !== 0) {
                for (var i = 0; i < typeArgs.length; i++)
                    this._checkType(typeArgs[i], node, recurse);
            }
        }
    };
    Walker.prototype._checkGlobal = function (node, symbol) {
        // Check whitelist.
        if (this.m_globalWhitelist.get(symbol.name))
            return;
        var issues = _tempIssueArray;
        issues.length = 0;
        if (!this.m_compatChecker.checkGlobal(symbol.name, issues))
            return;
        // Only report errors for symbols defined in a standard library.
        if (!_isDefinedInStandardLib(symbol))
            return;
        // Check guards.
        if (_canIssuesBeSuppressedByGuards(issues) && this._checkForEnclosingGuards(node))
            return;
        for (var i = 0; i < issues.length; i++)
            this.addFailureAtNode(node, issues[i].getMessage());
    };
    Walker.prototype._checkPropertyOrEvent = function (node, type, prop, isStatic, isEvent, checkBaseTypes) {
        var propIsSymbol = typeof (prop) !== "string";
        var propName = propIsSymbol ? prop.name : prop;
        var issues = _tempIssueArray;
        issues.length = 0;
        this._getPropertyOrEventIssues(type, propName, isStatic, isEvent, checkBaseTypes, issues);
        if (issues.length === 0)
            return;
        // Only report if the property (or its declaring type, if the property symbol is not
        // available) is declared in a standard library.
        if ((propIsSymbol && !_isDefinedInStandardLib(prop))
            || (!propIsSymbol && type.symbol !== undefined && !_isDefinedInStandardLib(type.symbol))) {
            return;
        }
        // Check guards.
        if (!isEvent && _canIssuesBeSuppressedByGuards(issues)
            && this._checkForEnclosingGuards(node, isStatic ? null : type)) {
            return;
        }
        var nodeForError = ts.isPropertyAccessExpression(node) ? node.name : node;
        for (var i = 0; i < issues.length; i++)
            this.addFailureAtNode(nodeForError, issues[i].getMessage());
    };
    Walker.prototype._getPropertyOrEventIssues = function (type, propName, isStatic, isEvent, checkBaseTypes, issues) {
        var typeName;
        if (!type.symbol) {
            if (_isTypeOfWindowGlobal(type))
                typeName = _WINDOW_TYPE;
            else
                return;
        }
        else {
            typeName = isStatic ? _removeConstructorSuffix(type.symbol.name) : type.symbol.name;
        }
        // Check if whitelisted.
        var whitelist = isEvent ? this.m_eventWhitelist.get(typeName) : this.m_propertyWhitelist.get(typeName);
        if (whitelist !== undefined && (whitelist.get(propName) || whitelist.get("*")))
            return;
        var hasIssue = this.m_compatChecker.checkPropertyOrEvent(typeName, propName, isEvent, issues);
        if (hasIssue || !checkBaseTypes)
            return;
        var baseTypes = type.getBaseTypes();
        if (baseTypes === undefined)
            return;
        for (var i = 0; i < baseTypes.length; i++)
            this._getPropertyOrEventIssues(baseTypes[i], propName, isStatic, isEvent, checkBaseTypes, issues);
    };
    /**
     * Checks if any issues indicating the use of a potentially unsupported feature must
     * not be reported because the existence of the feature is checked using an enclosing
     * guard statement (which may be an if statement, a conditional expression or a prior
     * operand to a logical and/or expression)
     *
     * @param node      The node where the issue was reported.
     *
     * @param declTypeOfInstanceProp If the use of an unsupported instance property was
     *        detected, pass its declared type here to detect guards on the type's
     *        prototype object (those of the form T.prototype.x)
     */
    Walker.prototype._checkForEnclosingGuards = function (node, declTypeOfInstanceProp) {
        if (declTypeOfInstanceProp === void 0) { declTypeOfInstanceProp = null; }
        if (node.kind !== ts.SyntaxKind.Identifier
            && node.kind !== ts.SyntaxKind.PropertyAccessExpression) {
            return false;
        }
        var propChain = _tempStringArray;
        _getPropAccessChainNames(node, propChain);
        var declTypeName = (declTypeOfInstanceProp && declTypeOfInstanceProp.symbol)
            ? declTypeOfInstanceProp.symbol.name
            : null;
        if (propChain.length === 0 && declTypeName === null)
            return false;
        var propName = ts.isPropertyAccessExpression(node) ? node.name.text : null;
        // Search for a matching property access in the guard stack.
        var stack = this.m_guardStack;
        for (var i = stack.length - 1; i >= 0; i--) {
            var guard = stack[i];
            if (guard.length === propChain.length) {
                // Check for an exact match.
                var matches = true;
                for (var j = guard.length - 1; j >= 0 && matches; j--)
                    matches = matches && guard[j] === propChain[j];
                if (matches)
                    return true;
            }
            // If the declaring type T is available for an instance property, check for T.prototype.x
            if (declTypeName !== null && guard.length === 3
                && guard[2] === propName && guard[1] === "prototype" && guard[0] === declTypeName) {
                return true;
            }
        }
        return false;
    };
    return Walker;
}(tslint_1.AbstractWalker));
exports.Walker = Walker;
var _tempStringArray = [];
var _tempIssueArray = [];
/**
 * If the given expression represents a property access chain beginning
 * with an identifier (e.g. "a.b.c.d"), fills the given array with the
 * name of each component in the chain in order, including the starting
 * identifier. (So "a.b.c.d" results in ["a", "b", "c", "d"].) For any
 * other expression.
 *
 * @returns If "expr" is a valid property access chain, returns true.
 *          Otherwise, this function returns false and "arr" will be
 *          empty.
 *
 * @param expr An expression node.
 * @param arr An array to be filled with the access chain names. Any
 *            existing elements in the array will be replaced.
 */
function _getPropAccessChainNames(expr, arr) {
    arr.length = 0;
    return _getPropAccessChainNamesHelper(expr, arr);
    function _getPropAccessChainNamesHelper(expr, arr) {
        expr = _unwrapParentheses(expr);
        if (ts.isIdentifier(expr)) {
            arr.push(expr.text);
            return true;
        }
        else if (ts.isPropertyAccessExpression(expr)) {
            if (!_getPropAccessChainNamesHelper(expr.expression, arr))
                return false;
            arr.push(expr.name.text);
            return true;
        }
        else {
            return false;
        }
    }
}
/**
 * Extracts the operands from a binary operation chain in the
 * given expression. For example, if the expression given is
 * A + B * (C + D) + E * F + G and the operator is +, the chain
 * operands are [A, B * (C + D), E * F, G].
 *
 * @param expr  The expression from which to extract the operands.
 * @param op    A binary operator.
 * @param arr   An array to be filled with the operand expressions. Any
 *              existing elements of this array will be replaced. If "expr"
 *              is not a binary operation chain with the operator "op" the
 *              array will have the single element "expr".
 */
function _getBinaryOpChainOperands(expr, op, arr) {
    arr.length = 0;
    return _getBinaryOpChainOperandsHelper(expr, op, arr);
    function _getBinaryOpChainOperandsHelper(expr, op, arr) {
        expr = _unwrapParentheses(expr);
        if (ts.isBinaryExpression(expr) && expr.operatorToken.kind == op) {
            _getBinaryOpChainOperandsHelper(expr.left, op, arr);
            _getBinaryOpChainOperandsHelper(expr.right, op, arr);
        }
        else {
            arr.push(expr);
        }
    }
}
/**
 * A guard expression.
 *
 * A guard expression is an expression that can be used inside a conditional
 * statement or expression to determine whether its operand exists or not.
 *
 * The following expressions are positive guard expressions with operand X:
 * - X != undefined
 * - typeof(X) != "undefined"
 * - typeof(X) == type, where type is a string literal other than "undefined".
 * - "prop" in X, where "prop" is a string literal.
 *
 * The following expressions are negative guard expressions with operand X:
 * - X == undefined
 * - typeof(X) == "undefined"
 *
 * Any other expression is considered to be a positive guard expression
 * whose operand is equal to itself.
 *
 * In all cases, ===/!== can be used in place of ==/!=. Guard expressions are
 * also allowed to be prefixed with a single not operator, which converts a
 * positive guard expression into a negative one (and vice versa).
 */
var GuardExpression = /** @class */ (function () {
    function GuardExpression(operand, isNegative, isTypeof, propChain) {
        this.operand = operand;
        this.isNegative = isNegative;
        this.isTypeof = isTypeof;
        this.propChain = propChain;
    }
    Object.defineProperty(GuardExpression.prototype, "isValid", {
        /**
         * Returns a value indicating whether this is a valid guard
         * expression for a variable or property.
         */
        get: function () {
            // A variable operand (without any dot accesses, i.e. a chain length of 1) 
            // is a valid guard only when used in a typeof expression. This is because
            // browsers throw a ReferenceError when a nonexistent variable is used anywhere
            // other than as an argument to typeof.
            return this.propChain !== null
                && (this.propChain.length >= 2 || (this.propChain.length === 1 && this.isTypeof));
        },
        enumerable: true,
        configurable: true
    });
    return GuardExpression;
}());
/**
 * Creates a guard expression from the given expression node.
 *
 * @returns The created GuardExpression instance.
 * @param expr An expression node.
 */
function _makeGuardExpression(expr) {
    var hasNotOperator = false;
    while (ts.isPrefixUnaryExpression(expr) && expr.operator == ts.SyntaxKind.ExclamationToken) {
        hasNotOperator = !hasNotOperator;
        expr = _unwrapParentheses(expr.operand);
    }
    var operand = expr;
    var isNegative = false;
    var isTypeof = false;
    var nameForInOp = null;
    if (ts.isBinaryExpression(expr)) {
        var left = expr.left;
        var right = expr.right;
        var op = expr.operatorToken.kind;
        var isEqualTo = (op === ts.SyntaxKind.EqualsEqualsToken
            || op === ts.SyntaxKind.EqualsEqualsEqualsToken);
        var isNotEqualTo = (op === ts.SyntaxKind.ExclamationEqualsToken
            || op === ts.SyntaxKind.ExclamationEqualsEqualsToken);
        if (isEqualTo || isNotEqualTo) {
            if (left.kind === ts.SyntaxKind.StringLiteral || _isUndefinedExpression(left)) {
                var temp = left;
                left = right;
                right = temp;
            }
            if (_isUndefinedExpression(right)) {
                // X ==/!= undefined
                operand = left;
                isNegative = isEqualTo;
            }
            if (ts.isStringLiteral(right) && ts.isTypeOfExpression(left)) {
                if (right.text === "undefined") {
                    // typeof(X) ==/!= "undefined"
                    operand = left.expression;
                    isNegative = isEqualTo;
                    isTypeof = true;
                }
                else if (isEqualTo) {
                    // typeof(X) == <something else> is considered to be a positive
                    // guard. Note that the corresponding expression with != cannot
                    // be a negative guard because X may be undefined if the expression
                    // evaluates to false.
                    operand = left.expression;
                    isNegative = false;
                    isTypeof = true;
                }
            }
        }
        else if (op == ts.SyntaxKind.InKeyword && ts.isStringLiteral(left)) {
            // "prop" in X
            operand = right;
            nameForInOp = left.text;
        }
    }
    if (hasNotOperator)
        isNegative = !isNegative;
    var propChain = null;
    if (_getPropAccessChainNames(operand, _tempStringArray)) {
        propChain = _tempStringArray.slice();
        if (nameForInOp !== null)
            propChain.push(nameForInOp);
    }
    return new GuardExpression(operand, isNegative, isTypeof, propChain);
}
/**
 * Gets the type arguments from which the given type is instantiated.
 *
 * @returns An array of type arguments, or null if the given type is not
 *          an instantiation of a generic type.
 * @param type The type for which to obtain the type arguments.
 */
function _getTypeArguments(type) {
    if ((type.flags & ts.TypeFlags.Object) === 0)
        return null;
    var objectType = type;
    if ((objectType.objectFlags & ts.ObjectFlags.Reference) === 0)
        return null;
    var typeArgs = objectType.typeArguments;
    return (typeArgs && typeArgs.length !== 0) ? typeArgs : null;
}
/**
 * Returns the expression that is wrapped in one or more parentheses.
 * For example, if the given expression node represents (((x))), returns the
 * expression node representing x.
 *
 * @returns The expression inside the parentheses, or the argument itself
 *          if it does not represent a parenthesised expression.
 * @param expr The expression node to be unwrapped.
 */
function _unwrapParentheses(expr) {
    while (expr.kind === ts.SyntaxKind.ParenthesizedExpression)
        expr = expr.expression;
    return expr;
}
/**
 * Returns true if the given node represents the value "undefined".
 * @param node A syntax tree node.
 */
function _isUndefinedExpression(node) {
    return node.kind === ts.SyntaxKind.UndefinedKeyword
        || (ts.isIdentifier(node) && node.text === "undefined");
}
/**
 * Returns true if the given symbol is declared in a standard library.
 *
 * This function considers a standard library file to be a file with a
 * name beginning with "lib."
 *
 * @returns True if the given symbol is declared in a standard library,
 *          otherwise false.
 * @param symbol A symbol.
 */
function _isDefinedInStandardLib(symbol) {
    var decls = symbol.declarations;
    for (var i = 0; i < decls.length; i++) {
        var decl = decls[i];
        while (!ts.isSourceFile(decl))
            decl = decl.parent;
        var fileName = decl.fileName;
        var lastSlashPos = fileName.lastIndexOf("/");
        if (utils_1.substringEquals(fileName, lastSlashPos + 1, "lib."))
            return true;
    }
    return false;
}
/**
 * Removes the "Constructor" suffix from a type name if it is present.
 *
 * @returns If "name" ends with the string "Constructor", returns a new string
 *          with that suffix removed. Otherwise returns "name".
 * @param name The name from which any "Constructor" suffix is to be removed.
 */
function _removeConstructorSuffix(name) {
    if (utils_1.stringEndsWith(name, "Constructor"))
        return name.substr(0, name.length - 11);
    return name;
}
/**
 * Checks if the given type is the type of the "window"
 * global variable, which is defined as "Window & globalThis".
 *
 * @returns True if the given type is the type of the window global,
 *          otherwise false.
 * @param type The type to check.
 */
function _isTypeOfWindowGlobal(type) {
    if ((type.flags & ts.TypeFlags.Intersection) === 0)
        return false;
    var components = type.types;
    if (components.length !== 2)
        return false;
    var sym1 = components[0].symbol;
    var sym2 = components[1].symbol;
    if (sym1 === undefined || sym2 === undefined)
        return false;
    var name1 = sym1.name, name2 = sym2.name;
    return (name1 === _WINDOW_TYPE && name2 === _GLOBAL_THIS_TYPE)
        || (name1 === _GLOBAL_THIS_TYPE && name2 === _WINDOW_TYPE);
}
/**
 * Checks if the issues in the given list can be suppressed if
 * the existence of the feature in question is checked with an
 * enclosing conditional statement/expression.
 *
 * @returns True if the given issues can be suppressed through conditional
 *          checks, otherwise false.
 *
 * @param issues An array of Issue objects.
 */
function _canIssuesBeSuppressedByGuards(issues) {
    for (var i = 0; i < issues.length; i++) {
        var issue = issues[i];
        if (issue.kind === 0 /* NOT_SUPPORTED */
            || issue.kind === 1 /* NEEDS_PREFIX */
            || issue.kind === 2 /* NEEDS_ALT_NAME */
            || issue.kind === 3 /* NEEDS_FLAG */) {
            return true;
        }
    }
    return false;
}
