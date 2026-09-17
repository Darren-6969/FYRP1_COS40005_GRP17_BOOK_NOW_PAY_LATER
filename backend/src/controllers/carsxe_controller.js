import {
  getVehicleImages,
} from "../services/carsxe_service.js";

export async function searchVehicleImages(
  req,
  res,
  next
) {
  try {
    const {
      make,
      model,
      year,
    } = req.query;

    if (!make || !model) {
      return res
        .status(400)
        .json({
          message:
            "Make and model are required.",
        });
    }

    const images =
      await getVehicleImages({
        make,
        model,
        year,
      });

    res.json({
      images,
    });
  } catch (err) {
    next(err);
  }
}