/**
 * Generates a sequential, zero-padded unique ID with a prefix, e.g. LB1001, LB1002.
 * Looks at the highest existing numeric suffix for the given prefix and increments it.
 */
export async function generateSequentialId(Model, field, prefix, startAt = 1000) {
  const regex = new RegExp(`^${prefix}(\\d+)$`);
  const existing = await Model.find({ [field]: { $regex: regex } })
    .sort({ [field]: -1 })
    .limit(50)
    .select(field)
    .lean();

  let maxNum = startAt;
  for (const doc of existing) {
    const match = doc[field]?.match(regex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  return `${prefix}${maxNum + 1}`;
}
