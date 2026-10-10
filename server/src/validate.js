// Request validation. All values are normalized on the server; the client
// can never bypass these rules.

function toInt(value) {
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

// Validates food create/update payloads.
export function foodInput(body = {}) {
  const errors = [];

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) errors.push("Food name is required.");
  else if (name.length > 120) errors.push("Food name must be 120 characters or fewer.");

  let description = typeof body.description === "string" ? body.description.trim() : "";
  if (description.length > 500) errors.push("Description must be 500 characters or fewer.");

  let price =
    body.price === undefined || body.price === null || body.price === ""
      ? NaN
      : Number(body.price);
  if (!Number.isFinite(price) || price < 0 || price > 999999) {
    errors.push("Price must be a valid number between 0 and 999999.");
  }
  price = Math.round(price * 100) / 100;

  let category = typeof body.category === "string" ? body.category.trim() : "";
  if (category.length > 60) errors.push("Category must be 60 characters or fewer.");

  let image = typeof body.image === "string" && body.image.trim() ? body.image.trim() : null;
  if (image && image.length > 500) {
    errors.push("Image URL must be 500 characters or fewer.");
    image = null;
  }

  const availability =
    body.availability === undefined ? true : Boolean(body.availability);

  return {
    errors,
    value: { name, description, price, category, image, availability }
  };
}

// Validates invoice payloads. Prices come from the database, not the client.
export function invoiceInput(body = {}) {
  const errors = [];

  const customerName =
    typeof body.customer_name === "string" ? body.customer_name.trim() : "";
  if (!customerName) errors.push("Customer name is required.");
  else if (customerName.length > 120)
    errors.push("Customer name must be 120 characters or fewer.");

  const foodId = toInt(body.food_id);
  if (foodId === null || foodId <= 0) errors.push("Please select a valid food.");

  const quantity = toInt(body.quantity);
  if (quantity === null || quantity <= 0)
    errors.push("Quantity must be a whole number greater than zero.");
  else if (quantity > 9999) errors.push("Quantity must be 9999 or fewer.");

  return { errors, value: { customerName, foodId, quantity } };
}
