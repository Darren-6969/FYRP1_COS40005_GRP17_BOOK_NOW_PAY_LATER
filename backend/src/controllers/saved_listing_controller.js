import { parseId } from "../utils/parseId.js";
import {
  listSavedListingIds,
  listSavedListings,
  saveListing,
  unsaveListing,
} from "../services/saved_listing_service.js";

export async function getSavedListings(req, res, next) {
  try {
    res.json({ items: await listSavedListings(req.user.id) });
  } catch (err) {
    next(err);
  }
}

export async function getSavedListingIds(req, res, next) {
  try {
    res.json({ ids: await listSavedListingIds(req.user.id) });
  } catch (err) {
    next(err);
  }
}

export async function putSavedListing(req, res, next) {
  try {
    const listingId = parseId(req.params.listingId, "listing id");
    res.json(await saveListing(req.user.id, listingId));
  } catch (err) {
    next(err);
  }
}

export async function deleteSavedListing(req, res, next) {
  try {
    const listingId = parseId(req.params.listingId, "listing id");
    res.json(await unsaveListing(req.user.id, listingId));
  } catch (err) {
    next(err);
  }
}
