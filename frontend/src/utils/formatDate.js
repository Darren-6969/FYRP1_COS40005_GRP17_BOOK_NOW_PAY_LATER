export const formatDate = (date) => {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
};