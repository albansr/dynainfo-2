/**
 * Mapping from dimension ID fields to their corresponding name fields
 * Only applies to fields that have separate ID and name columns
 *
 * Note: Name fields only exist in the 'transactions' table
 */
const ID_TO_NAME_MAP: Record<string, string> = {
  customer_id: 'customer_name',
  product_id: 'product_name',
  seller_id: 'seller_name',
  IdRegional: 'Regional',
};

/**
 * Field pair for groupBy dimension
 */
export interface DimensionFieldPair {
  idField: string;
  nameField: string;
}

/**
 * Get the ID and name field pair for a given groupBy dimension
 *
 * @param groupBy - The dimension to group by
 * @returns Object with idField and nameField
 *
 * @example
 * getFieldPair('seller_id') // { idField: 'seller_id', nameField: 'seller_name' }
 * getFieldPair('month') // { idField: 'month', nameField: 'month' }
 */
export function getFieldPair(groupBy: string): DimensionFieldPair {
  return {
    idField: groupBy,
    nameField: ID_TO_NAME_MAP[groupBy] ?? groupBy,
  };
}

/**
 * Check if a dimension has a separate name field
 *
 * @param groupBy - The dimension to check
 * @returns true if the dimension has a separate name field
 */
export function hasNameField(groupBy: string): boolean {
  return groupBy in ID_TO_NAME_MAP;
}
