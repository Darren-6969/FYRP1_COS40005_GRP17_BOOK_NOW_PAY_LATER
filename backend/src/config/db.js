import { PrismaClient } from "@prisma/client";

import { signedPrivateFileUrl } from "../services/private_file_storage.js";

// Receipt photos uploaded as files are private (non-negotiable 3). Every read
// of Receipt.imageUrl, including nested includes and selects, returns a
// short-lived signed link for those, so no controller can forget it and the
// storage key never reaches a client. Older receipts (data: URL or https
// link in imageUrl) are returned unchanged.
const prisma = new PrismaClient().$extends({
  result: {
    receipt: {
      imageUrl: {
        needs: { imageUrl: true, storageKey: true },
        compute(receipt) {
          if (!receipt.storageKey) return receipt.imageUrl;
          return signedPrivateFileUrl(receipt.storageKey) ?? "";
        },
      },
      // Internal only: never sent in API responses.
      storageKey: {
        needs: {},
        compute() {
          return undefined;
        },
      },
    },
  },
});

export default prisma;
