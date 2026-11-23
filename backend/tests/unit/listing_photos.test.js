import { test } from "node:test";
import assert from "node:assert/strict";
import { photoUrlsFrom } from "../../src/services/listing_image_order_service.js";

test("photos keep the operator's order and drop repeats", () => {
  assert.deepEqual(
    photoUrlsFrom({ imageUrls: ["/media/a.webp", "https://cdn.example.com/b.jpg", "/media/a.webp"] }),
    ["/media/a.webp", "https://cdn.example.com/b.jpg"]
  );
  assert.deepEqual(photoUrlsFrom({ carsxeImageUrl: "/media/c.webp" }), ["/media/c.webp"]);
  assert.deepEqual(photoUrlsFrom({}), []);
});

test("more than five photos, or a bad link, is refused", () => {
  const six = Array.from({ length: 6 }, (_, i) => `/media/${i}.webp`);
  assert.throws(() => photoUrlsFrom({ imageUrls: six }), (e) => e.appCode === "LISTING_PHOTOS_INVALID");
  assert.throws(() => photoUrlsFrom({ imageUrls: ["javascript:alert(1)"] }), (e) => e.statusCode === 400);
});
