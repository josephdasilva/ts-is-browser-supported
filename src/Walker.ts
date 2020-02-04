import {AbstractWalker} from "tslint";
import * as ts from "typescript";

import {ClientCompatChecker, Issue, IssueKind} from "./ClientCompatChecker";
import {Dictionary, stringEndsWith, substringEquals, stringStartsWith} from "./utils";

const _WINDOW_TYPE: string = "Window";

const _GLOBAL_THIS_TYPE: string = "globalThis";

const _ADD_EVENT_LISTENER: string = "addEventListener";

export class Walker extends AbstractWalker {

    private m_typeChecker: ts.TypeChecker;
    private m_compatChecker: ClientCompatChecker;

    private m_globalWhitelist: Dictionary<boolean>;
    private m_propertyWhitelist: Dictionary<Dictionary<boolean>>;
    private m_eventWhitelist: Dictionary<Dictionary<boolean>>;

    private m_visitCallback: (node: ts.Node) => void;
    private m_visitTypeNodeCallback: (node: ts.Node) => void;

    /**
     * This contains a list of property access expressions
     * (as arrays of names) that are known to be defined in the
     * current scope because they were checked in the condition
     * of a conditional statement or expression. So no issues that
     * indicate that a feature is not supported (or supported under
     * certain conditions) should be reported for instances of these
     * expressions.
     */
    private m_guardStack: string[][] = [];

    public constructor(
        sourceFile: ts.SourceFile,
        program: ts.Program,
        ruleName: string,
        compatChecker: ClientCompatChecker,
        globalWhitelist: Dictionary<boolean>,
        propertyWhitelist: Dictionary<Dictionary<boolean>>,
        eventWhitelist: Dictionary<Dictionary<boolean>>) 
    {
        super(sourceFile, ruleName, undefined);

        this.m_typeChecker = program.getTypeChecker();
        this.m_compatChecker = compatChecker;
        this.m_globalWhitelist = globalWhitelist;
        this.m_propertyWhitelist = propertyWhitelist;
        this.m_eventWhitelist = eventWhitelist;

        // Ensure that "this" is captured in these callbacks.
        this.m_visitCallback = x => this._visit(x);
        this.m_visitTypeNodeCallback = x => this._visitTypeNode(x);
    }

    public walk(sourceFile: ts.SourceFile): void {
        return sourceFile.forEachChild(this.m_visitCallback);
    }

    private _visit(node: ts.Node, isInGuardContext: boolean = false): void {
        switch (node.kind) {
            case ts.SyntaxKind.ParenthesizedExpression:
                return this._visit(_unwrapParentheses(<ts.Expression>node), isInGuardContext);

            case ts.SyntaxKind.PropertyAccessExpression:
                return this._visitPropertyAccess(<ts.PropertyAccessExpression>node, isInGuardContext);

            case ts.SyntaxKind.CallExpression:
                return this._visitCallOrNew(<ts.CallExpression>node);

            case ts.SyntaxKind.NewExpression:
                return this._visitCallOrNew(<ts.NewExpression>node);

            case ts.SyntaxKind.ElementAccessExpression:
                return this._visitElementAccess(<ts.ElementAccessExpression>node);

            case ts.SyntaxKind.BinaryExpression:
                return this._visitBinaryExpression(<ts.BinaryExpression>node);

            case ts.SyntaxKind.IfStatement:
                return this._visitIfStatement(<ts.IfStatement>node);

            case ts.SyntaxKind.ConditionalExpression:
                return this._visitConditionalExpression(<ts.ConditionalExpression>node);

            case ts.SyntaxKind.MethodDeclaration:
            case ts.SyntaxKind.MethodSignature:
            case ts.SyntaxKind.Constructor:
            case ts.SyntaxKind.GetAccessor:
            case ts.SyntaxKind.SetAccessor:
            case ts.SyntaxKind.FunctionExpression:
            case ts.SyntaxKind.FunctionDeclaration:
            case ts.SyntaxKind.ArrowFunction:
            case ts.SyntaxKind.IndexSignature:
                return this._visitFunctionDecl(<ts.FunctionLikeDeclaration | ts.IndexSignatureDeclaration>node);

            case ts.SyntaxKind.VariableDeclaration:
            case ts.SyntaxKind.PropertyDeclaration:
            case ts.SyntaxKind.PropertySignature:
            case ts.SyntaxKind.Parameter:
                return this._visitVariableDecl(<ts.VariableLikeDeclaration>node);

            case ts.SyntaxKind.TypeReference:
                return this._visitTypeNode(<ts.TypeNode>node);

            default:
                return node.forEachChild(this.m_visitCallback);
        }
    }

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
    private _visitPropertyAccess(node: ts.PropertyAccessExpression, isInGuardContext: boolean): void {
        const propName: string = node.name.text;

        const targetType: ts.Type =
            this.m_typeChecker.getApparentType(this.m_typeChecker.getTypeAtLocation(node.expression));

        let targetSymbol: ts.Symbol | undefined = undefined;
        if (node.expression.kind === ts.SyntaxKind.Identifier)
            targetSymbol = this.m_typeChecker.getSymbolAtLocation(node.expression);

        let isStatic: boolean = targetSymbol !== undefined
            && (targetSymbol.flags & ts.SymbolFlags.Type) !== 0;

        if (isInGuardContext) {
            // If this is a static property access in a guard context, the type
            // must still be checked - unless the type is also guarded, in which
            // case there it would already exist on the current guard stack.
            if (isStatic)
                this._checkGlobal(node.expression, targetSymbol!);
            return;
        }

        const prop: ts.Symbol | undefined = this.m_typeChecker.getPropertyOfType(targetType, propName);

        if (prop === undefined)
            return;

        let declType: ts.Type | null = this._getDeclaringType(prop);
        let checkBaseTypes: boolean = false;

        if (declType === null) {
            declType = targetType;
            checkBaseTypes = true;
        }

        if (isStatic)
            this._checkGlobal(node.expression, targetSymbol!);

        this._checkPropertyOrEvent(node, declType, prop, isStatic, false, checkBaseTypes);
        return this._visit(node.expression);
    }

    /**
     * Visitor for an element access expression.
     * @param node An element access expression node.
     */
    private _visitElementAccess(node: ts.ElementAccessExpression): void {
        if (ts.isIdentifier(node.expression)) {
            const symbol: ts.Symbol | undefined = this.m_typeChecker.getSymbolAtLocation(node.expression);
            if (symbol !== undefined)
                this._checkGlobal(node.expression, symbol);
        }
        else {
            this._visit(node.expression);
        }

        this._visit(node.argumentExpression);
    }

    /**
     * Visitor for a function call or new expression.
     * @param node A call or new expression node.
     */
    private _visitCallOrNew(node: ts.CallExpression | ts.NewExpression): void {
        if (node.typeArguments !== undefined)
            node.typeArguments.forEach(this.m_visitTypeNodeCallback);

        const func: ts.Node = node.expression;
        if (ts.isIdentifier(func)) {
            const symbol: ts.Symbol | undefined = this.m_typeChecker.getSymbolAtLocation(func);
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
    }

    /**
     * Checks for compatibility of events in addEventListener calls. If the
     * given node does not represent a call to addEventListener, nothing is done.
     * 
     * @param node A call expression node. 
     */
    private _checkAddEventListenerCall(node: ts.CallExpression): void {
        if (node.arguments.length < 2)
            return;

        const func: ts.Node = node.expression;
        if (func.kind !== ts.SyntaxKind.PropertyAccessExpression)
            return;

        const propAccess = <ts.PropertyAccessExpression>node.expression;
        if (propAccess.name.text !== _ADD_EVENT_LISTENER)
            return;

        const firstArg: ts.Node = node.arguments[0];
        if (firstArg.kind !== ts.SyntaxKind.StringLiteral)
            return;

        const eventName: string = (<ts.StringLiteral>firstArg).text;
        const targetType: ts.Type = this.m_typeChecker.getTypeAtLocation(propAccess.expression);

        this._checkPropertyOrEvent(firstArg, targetType, eventName, false, true, false)
    }

    /**
     * Visitor for a function declaration.
     * @param node A function or index signature declaration node.
     */
    private _visitFunctionDecl(node: ts.FunctionLikeDeclaration | ts.IndexSignatureDeclaration): void {
        if (node.type !== undefined)
            this._visitTypeNode(node.type);
        if (node.decorators !== undefined)
            node.decorators.forEach(this.m_visitCallback);

        if (node.typeParameters !== undefined)
            node.typeParameters.forEach(this.m_visitCallback);

        node.parameters.forEach(this.m_visitCallback);

        if (node.kind !== ts.SyntaxKind.IndexSignature) {
            const body = (<ts.FunctionLikeDeclaration>node).body;
            if (body !== undefined)
                return this._visit(body);
        }
    }

    /**
     * Visitor for a variable, property or parameter declaration.
     * @param node A variable, property or parameter declaration node.
     */
    private _visitVariableDecl(node: ts.VariableLikeDeclaration): void {
        if (node.decorators !== undefined)
            node.decorators.forEach(this.m_visitCallback);

        if (!("type" in node) || node.type === undefined) {
            // Type may be inferred.
            // Not checking binding patterns for now.
            if (node.name.kind !== ts.SyntaxKind.ArrayBindingPattern
                && node.name.kind !== ts.SyntaxKind.ObjectBindingPattern) 
            {
                this._checkType(this._getNodeApparentType(node), node.name);
            }
        }
        else {
            this._visitTypeNode(<ts.Node>node.type);
        }

        if (node.kind === ts.SyntaxKind.VariableDeclaration
            || node.kind === ts.SyntaxKind.PropertyDeclaration
            || node.kind === ts.SyntaxKind.Parameter) 
        {
            const nodeWithInit = <ts.VariableDeclaration | ts.PropertyDeclaration | ts.ParameterDeclaration>node;
            if (nodeWithInit.initializer !== undefined)
                this._visit(nodeWithInit.initializer);
        }
    }

    /**
     * Visitor for a type node.
     * @param node A type node.
     */
    private _visitTypeNode(node: ts.Node): void {
        if (!ts.isTypeNode(node))
            return;
        // Don't recurse in _checkType, since the type node will be recursed.
        this._checkType(this._getNodeApparentType(node), node, false);
        return node.forEachChild(this.m_visitTypeNodeCallback);
    }

    /**
     * Visitor for a binary operator expression.
     * @param node An expression node representing a binary operation.
     */
    private _visitBinaryExpression(node: ts.BinaryExpression): void {
        let chainExpressions: ts.Expression[] | null = null;
        let isOr: boolean = false;

        if (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
            || node.operatorToken.kind === ts.SyntaxKind.BarBarToken)
        {
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

        const oldGuardStackDepth = this.m_guardStack.length;

        for (let i: number = 0; i < chainExpressions.length; i++) {
            let guardExpr: GuardExpression = _makeGuardExpression(chainExpressions[i]);
            
            if (guardExpr.isValid && (isOr ? guardExpr.isNegative : !guardExpr.isNegative)) {
                this._visit(guardExpr.operand, true);
                this.m_guardStack.push(guardExpr.propChain!);
            }
            else {
                this._visit(guardExpr.operand, false);
            }
        }

        // Restore the old guard stack once evaluation is finished.
        this.m_guardStack.length = oldGuardStackDepth;
    }

    /**
     * Visitor for an if statement.
     * @param node A node representing an if statement.
     */
    private _visitIfStatement(node: ts.IfStatement): void {
        return this._visitIfStatementOrExpr(node.expression, node.thenStatement, node.elseStatement);
    }

    /**
     * Visitor for a conditional (?:) expression
     * @param node A node representing a conditional expression.
     */
    private _visitConditionalExpression(node: ts.ConditionalExpression): void {
        return this._visitIfStatementOrExpr(node.condition, node.whenTrue, node.whenFalse);
    }

    /**
     * Visits an if statement or conditional expression.
     * 
     * @param condition The condition expression.
     * @param thenNode  The branch taken if the condition is true.
     * @param elseNode  The branch taken if the condition is false.
     */
    private _visitIfStatementOrExpr(
        condition: ts.Expression, thenNode: ts.Node, elseNode: ts.Node | undefined = undefined): void 
    {
        condition = _unwrapParentheses(condition);

        let hasLeadingNotOp: boolean = false;
        while (ts.isPrefixUnaryExpression(condition)
            && condition.operator === ts.SyntaxKind.ExclamationToken)
        {
            hasLeadingNotOp = !hasLeadingNotOp;
            condition = _unwrapParentheses(condition.operand);
        }

        if (condition.kind !== ts.SyntaxKind.BinaryExpression
            && condition.kind !== ts.SyntaxKind.Identifier
            && condition.kind !== ts.SyntaxKind.PropertyAccessExpression)
        {
            // Fast path.
            this._visit(condition);
            this._visit(thenNode);
            if (elseNode !== undefined)
                this._visit(elseNode);
            return;
        }

        let thenGuards: string[][] = [];
        let elseGuards: string[][] = [];
        this._visitIfConditionAndGetGuards(condition, thenGuards, elseGuards);

        if (hasLeadingNotOp) {
            const temp = thenGuards;
            thenGuards = elseGuards;
            elseGuards = temp;
        }

        const oldGuardStackDepth = this.m_guardStack.length;

        this.m_guardStack.push.apply(this.m_guardStack, thenGuards);
        this._visit(thenNode);
        this.m_guardStack.length = oldGuardStackDepth;

        if (elseNode !== undefined) {
            this.m_guardStack.push.apply(this.m_guardStack, elseGuards);
            this._visit(elseNode);
            this.m_guardStack.length = oldGuardStackDepth;
        }
    }

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
    private _visitIfConditionAndGetGuards(
        condition: ts.Expression, thenGuards: string[][], elseGuards: string[][]): void
    {
        if (!ts.isBinaryExpression(condition)) {
            // Fast path.
            // No need to check the !X case as _visitIfStatementOrExpr will remove
            // an outermost not operator if it is present.

            _getPropAccessChainNames(condition, _tempStringArray)
            if (_tempStringArray.length >= 2) {
                thenGuards.push(_tempStringArray.slice());
                this._visit(condition, true);
            }
            else {
                this._visit(condition, false);
            }
            return;
        }

        let isOrChain: boolean = false;
        let isSingle: boolean = false;
        const chainExpressions: ts.Expression[] = [];

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

        const oldGuardStackDepth = this.m_guardStack.length;

        for (let i: number = 0; i < chainExpressions.length; i++) {
            const guardExpr: GuardExpression = _makeGuardExpression(chainExpressions[i]);

            const isNegative = guardExpr.isNegative;
            const isConditionGuard: boolean = isOrChain ? isNegative : !isNegative;
            const isThenGuard: boolean = (!isOrChain || isSingle) && !isNegative;
            const isElseGuard: boolean = (isOrChain || isSingle) && isNegative;

            if (guardExpr.isValid && (isConditionGuard || isThenGuard || isElseGuard)) {
                this._visit(guardExpr.operand, true);

                if (isConditionGuard)
                    this.m_guardStack.push(guardExpr.propChain!);
                if (isThenGuard)
                    thenGuards.push(guardExpr.propChain!);
                if (isElseGuard)
                    elseGuards.push(guardExpr.propChain!);
            }
            else {
                this._visit(guardExpr.operand, false);
            }
        }

        // Restore the old guard stack once evaluation is finished.
        this.m_guardStack.length = oldGuardStackDepth;
    }

    /**
     * Returns the apparent type of the given node.
     * @param node The expression or declaraton node whose type is to be obtained.
     */
    private _getNodeApparentType(node: ts.Node): ts.Type {
        return this.m_typeChecker.getApparentType(this.m_typeChecker.getTypeAtLocation(node));
    }

    /**
     * Gets the type that declared the given property symbol.
     * @returns The type that declared the symbol, or null if no declaring
     *          type can be found.
     * @param symbol A symbol.
     */
    private _getDeclaringType(symbol: ts.Symbol): ts.Type | null {
        if (symbol.declarations.length === 0)
            return null;
            
        for (let i: number = 0; i < symbol.declarations.length; i++) {
            const declNode: ts.Node = symbol.declarations[0].parent;
            if ((declNode.kind & (ts.SyntaxKind.ClassDeclaration | ts.SyntaxKind.InterfaceDeclaration)) === 0) 
                continue;
            
            const nameNode = (<ts.ClassDeclaration | ts.InterfaceDeclaration>declNode).name;
            if (nameNode !== undefined)
                return this.m_typeChecker.getTypeAtLocation(nameNode);
        }

        return null;
    }

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
    private _checkType(type: ts.Type, node: ts.Node, recurse: boolean = true): void {
        const symbol: ts.Symbol | undefined = type.symbol;
        
        if (symbol)
            this._checkGlobal(node, symbol);

        if (!recurse)
            return;

        if ((type.flags & ts.TypeFlags.UnionOrIntersection) !== 0) {
            // Check the component types of a union or intersection.
            const components: ts.Type[] = (<ts.UnionOrIntersectionType>type).types;
            for (let i: number = 0; i < components.length; i++)
                this._checkType(components[i], node, recurse);
        }
        else if ((type.flags & ts.TypeFlags.Object) !== 0) {
            // Check the type arguments of a generic type.
            const typeArgs = _getTypeArguments(type);
            if (typeArgs !== null && typeArgs.length !== 0) {
                for (let i: number = 0; i < typeArgs.length; i++)
                    this._checkType(typeArgs[i], node, recurse);
            }
        }
    }

    private _checkGlobal(node: ts.Node, symbol: ts.Symbol): void {
        // Check whitelist.
        if (this.m_globalWhitelist.get(symbol.name))
            return;

        const issues: Issue[] = _tempIssueArray;
        issues.length = 0;

        if (!this.m_compatChecker.checkGlobal(symbol.name, issues))
            return;

        // Only report errors for symbols defined in a standard library.
        if (!_isDefinedInStandardLib(symbol))
            return;

        // Check guards.
        if (_canIssuesBeSuppressedByGuards(issues) && this._checkForEnclosingGuards(node))
            return;

        for (let i: number = 0; i < issues.length; i++)
            this.addFailureAtNode(node, issues[i].getMessage());
    }

    private _checkPropertyOrEvent(
        node: ts.Node, type: ts.Type, prop: ts.Symbol | string, isStatic: boolean,
        isEvent: boolean, checkBaseTypes: boolean): void 
    {
        const propIsSymbol: boolean = typeof(prop) !== "string";
        const propName: string = propIsSymbol ? (<ts.Symbol>prop).name : <string>prop;

        const issues: Issue[] = _tempIssueArray;
        issues.length = 0;
        
        this._getPropertyOrEventIssues(type, propName, isStatic, isEvent, checkBaseTypes, issues);

        if (issues.length === 0)
            return;

        // Only report if the property (or its declaring type, if the property symbol is not
        // available) is declared in a standard library.
        if ((propIsSymbol && !_isDefinedInStandardLib(<ts.Symbol>prop))
            || (!propIsSymbol && type.symbol !== undefined && !_isDefinedInStandardLib(type.symbol)))
        {
            return;
        }

        // Check guards.
        if (!isEvent && _canIssuesBeSuppressedByGuards(issues)
            && this._checkForEnclosingGuards(node, isStatic ? null : type)) 
        {
            return;
        }

        const nodeForError = ts.isPropertyAccessExpression(node) ? node.name : node;
        for (let i: number = 0; i < issues.length; i++)
            this.addFailureAtNode(nodeForError, issues[i].getMessage());
    }

    private _getPropertyOrEventIssues(
        type: ts.Type, propName: string, isStatic: boolean, isEvent: boolean, 
        checkBaseTypes: boolean, issues: Issue[]): void 
    {
        let typeName: string;
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
        const whitelist = isEvent ? this.m_eventWhitelist.get(typeName) : this.m_propertyWhitelist.get(typeName);
        if (whitelist !== undefined && (whitelist.get(propName) || whitelist.get("*")))
            return;
        
        const hasIssue: boolean = this.m_compatChecker.checkPropertyOrEvent(typeName, propName, isEvent, issues);
        if (hasIssue || !checkBaseTypes)
            return;
        
        const baseTypes: ts.Type[] | undefined = type.getBaseTypes();
        if (baseTypes === undefined)
            return;
        for (let i: number = 0; i < baseTypes.length; i++)
            this._getPropertyOrEventIssues(baseTypes[i], propName, isStatic, isEvent, checkBaseTypes, issues);
    }

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
    private _checkForEnclosingGuards(node: ts.Node, declTypeOfInstanceProp: ts.Type | null = null): boolean {
        if (node.kind !== ts.SyntaxKind.Identifier
            && node.kind !== ts.SyntaxKind.PropertyAccessExpression) 
        {
            return false;
        }

        const propChain: string[] = _tempStringArray;
        _getPropAccessChainNames(<ts.Expression>node, propChain);

        const declTypeName: string | null =
            (declTypeOfInstanceProp && declTypeOfInstanceProp.symbol)
                ? declTypeOfInstanceProp.symbol.name
                : null;

        if (propChain.length === 0 && declTypeName === null)
            return false;
            
        const propName: string | null = ts.isPropertyAccessExpression(node) ? node.name.text : null;

        // Search for a matching property access in the guard stack.

        const stack = this.m_guardStack;
        for (let i: number = stack.length - 1; i >= 0; i--) {
            const guard = stack[i];

            if (guard.length === propChain.length) {
                // Check for an exact match.
                let matches: boolean = true;
                for (let j: number = guard.length - 1; j >= 0 && matches; j--)
                    matches = matches && guard[j] === propChain[j];
                if (matches)
                    return true;
            }

            // If the declaring type T is available for an instance property, check for T.prototype.x
            if (declTypeName !== null && guard.length === 3
                && guard[2] === propName && guard[1] === "prototype" && guard[0] === declTypeName) 
            {
                return true;
            }
        }

        return false;
    }

}

const _tempStringArray: string[] = [];

const _tempIssueArray: Issue[] = [];

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
function _getPropAccessChainNames(expr: ts.Expression, arr: string[]): boolean {
    arr.length = 0;
    return _getPropAccessChainNamesHelper(expr, arr);

    function _getPropAccessChainNamesHelper(expr: ts.Expression, arr: string[]): boolean {
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
function _getBinaryOpChainOperands(
    expr: ts.Expression, op: ts.BinaryOperator, arr: ts.Expression[]): void 
{
    arr.length = 0;
    return _getBinaryOpChainOperandsHelper(expr, op, arr);

    function _getBinaryOpChainOperandsHelper(
        expr: ts.Expression, op: ts.BinaryOperator, arr: ts.Expression[]): void 
    {
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
class GuardExpression {
    /**
     * The operand of the guard expression.
     */
    public readonly operand: ts.Expression;
    /**
     * True if the guard expression is negative.
     */
    public readonly isNegative: boolean;
    /**
     * True if the guard expression is a typeof expression.
     */
    public readonly isTypeof: boolean;
    /**
     * If the guard expression's operand is a property access chain beginning
     * with an identifier, this is an array containing the names of the identifiers
     * involved in the chain (e.g. ["A","B","C","D"] for A.B.C.D). Otherwise, this
     * is null. If the guard expression uses the in operator with a string literal
     * name operand, that name is included in the chain.
     */
    public readonly propChain: string[] | null;

    public constructor(
        operand: ts.Expression, isNegative: boolean, isTypeof: boolean, propChain: string[] | null)
    {
        this.operand = operand;
        this.isNegative = isNegative;
        this.isTypeof = isTypeof;
        this.propChain = propChain;
    }

    /**
     * Returns a value indicating whether this is a valid guard
     * expression for a variable or property.
     */
    public get isValid(): boolean {
        // A variable operand (without any dot accesses, i.e. a chain length of 1) 
        // is a valid guard only when used in a typeof expression. This is because
        // browsers throw a ReferenceError when a nonexistent variable is used anywhere
        // other than as an argument to typeof.
        return this.propChain !== null
            && (this.propChain.length >= 2 || (this.propChain.length === 1 && this.isTypeof));
    }
}

/**
 * Creates a guard expression from the given expression node.
 * 
 * @returns The created GuardExpression instance.
 * @param expr An expression node.
 */
function _makeGuardExpression(expr: ts.Expression): GuardExpression {
    let hasNotOperator: boolean = false;

    while (ts.isPrefixUnaryExpression(expr) && expr.operator == ts.SyntaxKind.ExclamationToken) {
        hasNotOperator = !hasNotOperator;
        expr = _unwrapParentheses(expr.operand);
    }

    let operand: ts.Expression = expr;
    let isNegative: boolean = false;
    let isTypeof: boolean = false;
    let nameForInOp: string | null = null;

    if (ts.isBinaryExpression(expr)) {
        let left: ts.Expression = expr.left;
        let right: ts.Expression = expr.right;
        const op: ts.BinaryOperator = expr.operatorToken.kind;

        const isEqualTo =
            (op === ts.SyntaxKind.EqualsEqualsToken 
            || op === ts.SyntaxKind.EqualsEqualsEqualsToken);
        const isNotEqualTo =
            (op === ts.SyntaxKind.ExclamationEqualsToken 
            || op === ts.SyntaxKind.ExclamationEqualsEqualsToken);

        if (isEqualTo || isNotEqualTo) {
            if (left.kind === ts.SyntaxKind.StringLiteral || _isUndefinedExpression(left)) {
                const temp = left;
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

    let propChain: string[] | null = null;

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
function _getTypeArguments(type: ts.Type): readonly ts.Type[] | null {
    if ((type.flags & ts.TypeFlags.Object) === 0)
        return null;

    const objectType = <ts.ObjectType>type;
    if ((objectType.objectFlags & ts.ObjectFlags.Reference) === 0)
        return null;

    const typeArgs = (<ts.TypeReference>objectType).typeArguments;
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
function _unwrapParentheses(expr: ts.Expression): ts.Expression {
    while (expr.kind === ts.SyntaxKind.ParenthesizedExpression)
        expr = (<ts.ParenthesizedExpression>expr).expression;
    return expr;
}

/**
 * Returns true if the given node represents the value "undefined".
 * @param node A syntax tree node.
 */
function _isUndefinedExpression(node: ts.Node): boolean {
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
function _isDefinedInStandardLib(symbol: ts.Symbol): boolean {
    const decls = symbol.declarations;

    for (let i: number = 0; i < decls.length; i++) {
        let decl: ts.Node = decls[i];
        while (!ts.isSourceFile(decl))
            decl = decl.parent;
        
        const fileName: string = decl.fileName;
        const lastSlashPos: number = fileName.lastIndexOf("/");

        if (substringEquals(fileName, lastSlashPos + 1, "lib."))
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
function _removeConstructorSuffix(name:string): string {
    if (stringEndsWith(name, "Constructor"))
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
function _isTypeOfWindowGlobal(type: ts.Type): boolean {
    if ((type.flags & ts.TypeFlags.Intersection) === 0)
        return false;

    const components: ts.Type[] = (<ts.IntersectionType>type).types;
    if (components.length !== 2)
        return false;

    const sym1: ts.Symbol | undefined = components[0].symbol;
    const sym2: ts.Symbol | undefined = components[1].symbol;
    if (sym1 === undefined || sym2 === undefined)
        return false;

    const name1: string = sym1.name, name2: string = sym2.name;
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
function _canIssuesBeSuppressedByGuards(issues: Issue[]): boolean {
    for (let i: number = 0; i < issues.length; i++) {
        const issue: Issue = issues[i];
        if (issue.kind === IssueKind.NOT_SUPPORTED
            || issue.kind === IssueKind.NEEDS_PREFIX
            || issue.kind === IssueKind.NEEDS_ALT_NAME
            || issue.kind === IssueKind.NEEDS_FLAG)
        {
            return true;
        }
    }
    return false;
}