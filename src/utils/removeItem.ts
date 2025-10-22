export const removeItem = <T>(items: T[], item: T) => {
  const index = items.indexOf(item);
  if (index !== -1) items.splice(index, 1);
  return items;
};
