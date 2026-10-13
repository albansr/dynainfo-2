/**
 * Groupings whose listings include groups with no sales in the period (a
 * seller with only budget or cartera, a customer with only cartera), so their
 * budget and RET. CARTERA are not dropped. Products stay driven by the sales
 * rows: their listing shows units and cost, not cartera, and cartera-only items
 * would add rows of zeros.
 */
const GROUPINGS_FROM_EVERY_SOURCE = new Set([
  'seller_id', 'IdRegional', 'ProveedorComercial', 'channel', 'customer_id', 'customer_name',
]);

export function listsGroupsWithoutSales(groupBy: string): boolean {
  return GROUPINGS_FROM_EVERY_SOURCE.has(groupBy);
}
