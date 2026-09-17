const CARSXE_BASE_URL = "https://api.carsxe.com";

export async function getVehicleImages({
  make,
  model,
  year,
}) {
  if (!process.env.CARSXE_API_KEY) {
    throw new Error(
      "CARSXE_API_KEY is not configured"
    );
  }

  if (!make || !model) {
    throw new Error(
      "Vehicle make and model are required"
    );
  }

  const params = new URLSearchParams({
    key: process.env.CARSXE_API_KEY,
    make: String(make).trim(),
    model: String(model).trim(),
    transparent: "true",
    size: "Large",
    license: "ShareCommercially",
    format: "json",
  });

  if (year) {
    params.set(
      "year",
      String(year)
    );
  }

  const response = await fetch(
    `${CARSXE_BASE_URL}/images?${params.toString()}`
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message ||
        "Failed to retrieve vehicle images"
    );
  }

  if (data?.success === false) {
    throw new Error(
      data?.message ||
        "CarsXE image request failed"
    );
  }

  return (data?.images || []).map(
    (image) => ({
      url: image.link,

      thumbnailUrl:
        image.thumbnailLink ||
        image.link,

      width:
        Number(image.width) ||
        null,

      height:
        Number(image.height) ||
        null,

      mime:
        image.mime ||
        null,

      sourceUrl:
        image.contextLink ||
        null,
    })
  );
}