# Test item: the "Miscellaneous" listing type

A temporary, bookable, fixed-price item for testing payments, cancellations and refunds.

- **Operator:** Listings, Add Listing, Listing Type **Miscellaneous (test item)**. Fill in the name, description, fixed price and photo (branch is required), save, then publish it.
- **Customer:** signed in, open **`/test-items`** (for example `https://<your domain>/test-items`) and press **Book this item**. Signed-out visitors are sent to log in first.
- **From there it is an ordinary booking request.** The operator accepts it, the customer pays by Stripe or DuitNow, and cancel and refund work as for any booking. It has no dates (so a customer can cancel at any time), no car, no licence and no stock. It is not linked to the listing and does not appear in the car catalogue.
- Its bookings count in the dashboards and pilot metrics like any booking (the service type is `TEST_ITEM`), and the listing counts towards the operator's published-listing limit.

## Delete it when testing is finished

Every piece is tagged **`TEST-ITEM-MISC`**. Find them all with:

```bash
grep -rn "TEST-ITEM-MISC" backend frontend/src
```

**Delete these files** (the booking path):

| File | What it is |
| --- | --- |
| `backend/src/controllers/test_item_controller.js` | Lists the items and creates the booking |
| `backend/src/routes/test_item_routes.js` | The two routes |
| `frontend/src/pages/public/TestItems.jsx` | The `/test-items` page |
| `frontend/src/services/test_item_service.js` | The two API calls |

**Delete the tagged lines** in these files (the listing type and the wiring):

| File | What to delete |
| --- | --- |
| `backend/src/app.js` | The import and the mount of `test_item_routes` |
| `frontend/src/App.jsx` | The `TestItems` import and its route |
| `frontend/src/pages/operator/OperatorListingForm.jsx` | The `isMisc` flag, the "Miscellaneous (test item)" option, the `isMisc` parts of the name placeholder, validation and payload, the "Fixed Price" field, the `isMisc` wrappers around Quantity and Policies (remove the wrapper but keep the section), and the two photo wording lines |
| `frontend/src/pages/operator/OperatorListings.jsx` | The "Miscellaneous (test item)" filter option and the `MISCELLANEOUS` label block |
| `backend/src/controllers/listing_controller.js` | The `"MISCELLANEOUS"` line in the allowed categories of `createListing` |
| `backend/prisma/schema.prisma` | The `MISCELLANEOUS` value of `enum ListingCategory` (optional, see below) |
| `backend/prisma/migrations/20261103100000_add_miscellaneous_listing_category/` | Leave it. A migration that has been applied must not be deleted |

## Before deleting the code

Remove the test data first. Bookings made from the item stay in the database (their service type is `TEST_ITEM`); delete or leave them as you prefer.

```sql
DELETE FROM "Listing" WHERE category = 'MISCELLANEOUS';
```

A Postgres enum value cannot be dropped, so `MISCELLANEOUS` stays in the database after the code is removed. That is harmless. If it is removed from `schema.prisma`, add a migration that recreates the enum without it, which is only worth doing if nothing else needs the value.
