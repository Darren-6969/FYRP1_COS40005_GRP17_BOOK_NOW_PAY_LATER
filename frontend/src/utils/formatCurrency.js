export const formatCurrency = (value) => {
  return `RM ${Number(value || 0).toFixed(2)}`;
};