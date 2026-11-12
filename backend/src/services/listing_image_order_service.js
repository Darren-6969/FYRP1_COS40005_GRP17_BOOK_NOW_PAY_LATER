// FR-LIST-001: a listing's photos are shown in sortOrder, and the first one is
// the primary photo customers see on the results page, the car page and the
// chatbot cards.
//
// Every change to the order goes through writeImageOrder, which rewrites the
// whole order at once: positions 0 to n-1 with no gaps or repeats, and the
// photo at 0 as the only primary. Writing one photo's position on its own is
// what let two photos share position 0 (blocker D).

/**
 * Writes the listing's photo order inside the caller's transaction.
 *
 * orderedIds: the ids the caller wants first, in that order. Unknown ids and
 * repeats are ignored. Photos the caller leaves out keep their current
 * relative order after the ones it named, so passing [id] moves one photo to
 * the front and passing [] just closes gaps.
 *
 * Returns the final order of ids.
 */
export async function writeImageOrder(listingId, orderedIds, tx) {
  const images = await tx.listingImage.findMany({
    where: { listingId },
    // The order customers see today: primary first, then position, then age.
    orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
    select: { id: true },
  });

  const known = new Set(images.map((image) => image.id));
  const seen = new Set();
  const order = [];

  for (const value of orderedIds) {
    const id = Number(value);
    if (known.has(id) && !seen.has(id)) {
      seen.add(id);
      order.push(id);
    }
  }

  for (const { id } of images) {
    if (!seen.has(id)) order.push(id);
  }

  for (let index = 0; index < order.length; index += 1) {
    await tx.listingImage.update({
      where: { id: order[index] },
      data: { sortOrder: index, isPrimary: index === 0 },
    });
  }

  return order;
}
