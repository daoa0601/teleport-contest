export type UnaryOperator = 'not' | '#' | '-' | '~';
export type BinaryOperator =
    | 'or' | 'and'
    | '<' | '>' | '<=' | '>=' | '~=' | '=='
    | '|' | '~' | '&' | '<<' | '>>'
    | '..' | '+' | '-' | '*' | '/' | '//' | '%' | '^';

export interface Program {
    type: 'Chunk';
    body: Statement[];
    filename: string;
}

export interface NameExpression {
    type: 'Name';
    name: string;
}

export interface LiteralExpression {
    type: 'Literal';
    value: string | number | boolean | null;
}

export interface FunctionExpression {
    type: 'Function';
    parameters: string[];
    vararg: boolean;
    body: Statement[];
}

export interface TableField {
    key: Expression | null;
    value: Expression;
}

export interface TableExpression {
    type: 'Table';
    fields: TableField[];
}

export interface IndexExpression {
    type: 'Index';
    target: Expression;
    key: Expression;
}

export interface CallExpression {
    type: 'Call';
    callee: Expression;
    args: Expression[];
}

export interface MethodCallExpression {
    type: 'MethodCall';
    target: Expression;
    method: string;
    args: Expression[];
}

export interface UnaryExpression {
    type: 'Unary';
    operator: UnaryOperator;
    expression: Expression;
}

export interface BinaryExpression {
    type: 'Binary';
    operator: BinaryOperator;
    left: Expression;
    right: Expression;
}

export type AssignmentTarget = NameExpression | IndexExpression;

export type Expression =
    | NameExpression
    | LiteralExpression
    | FunctionExpression
    | TableExpression
    | IndexExpression
    | CallExpression
    | MethodCallExpression
    | UnaryExpression
    | BinaryExpression
    | { type: 'Vararg' }
    | { type: 'Group'; expression: Expression };

export interface IfClause {
    condition: Expression;
    body: Statement[];
}

export type Statement =
    | { type: 'Local'; names: string[]; expressions: Expression[] }
    | { type: 'LocalFunction'; name: string; expression: FunctionExpression }
    | { type: 'Assign'; targets: AssignmentTarget[]; expressions: Expression[] }
    | { type: 'CallStatement'; call: CallExpression | MethodCallExpression }
    | { type: 'If'; clauses: IfClause[]; otherwise: Statement[] }
    | {
        type: 'ForNumeric'; name: string; start: Expression;
        stop: Expression; step: Expression; body: Statement[];
    }
    | { type: 'ForGeneric'; names: string[]; expressions: Expression[]; body: Statement[] }
    | { type: 'While'; condition: Expression; body: Statement[] }
    | { type: 'Repeat'; condition: Expression; body: Statement[] }
    | { type: 'Do'; body: Statement[] }
    | { type: 'Return'; expressions: Expression[] }
    | { type: 'Break' };
