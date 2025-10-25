import { isArray, isDefined, jsonStringify } from "fluxio";
import { PbModelBase, PbWhere } from "./types";

export const getFilter = <T extends PbModelBase>(where: PbWhere<T> | undefined): string | undefined => {
    if (!where) return undefined;

    const filters = Object.entries(where || {})
        .map(([key, propFilter]) => {
        if (!isDefined(propFilter)) return '';

        const [operator, operand] = isArray(propFilter) ? propFilter : ['=', propFilter];

        const operandString =
            typeof operand === 'string' ? `"${operand}"`
            : operand instanceof Date ? jsonStringify(operand)
            : operand;

        return `${key} ${operator} ${operandString}`;
        })
        .filter((f) => f);
    if (filters.length === 0) return undefined;

    return `(${filters.join(' && ')})`;
}