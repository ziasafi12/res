// Mirror of the existing website menu (src/data/menu.js).
// Items and prices are preserved exactly — nothing is invented.
// Items that have sizes (Regular/Large) become one row per size, e.g.
// "Dal Chawal" -> "Dal Chawal (Regular)" £3.99 and "Dal Chawal (Large)" £5.99,
// because the foods table stores a single price per row.
export const MENU = [
  {
    category: "Starters",
    items: [
      { name: "Aloo Tikki", price: 0.99 },
      { name: "Aloo Samosa", price: 0.99 },
      { name: "Chicken Shami Kebab", price: 1.79 },
      { name: "Fries", price: 1.99 },
      { name: "Aloo Tikki Chaat", price: 2.99 },
      { name: "Samosa Chaat", price: 2.99 }
    ]
  },
  {
    category: "Main Course",
    items: [
      { name: "Dal Chawal", sizes: [{ label: "Regular", price: 3.99 }, { label: "Large", price: 5.99 }] },
      { name: "Lobia / Rajma Chawal", sizes: [{ label: "Regular", price: 3.99 }, { label: "Large", price: 5.99 }] },
      { name: "Channa Chawal", sizes: [{ label: "Regular", price: 3.99 }, { label: "Large", price: 5.99 }] },
      { name: "Kari Chawal", sizes: [{ label: "Regular", price: 3.99 }, { label: "Large", price: 5.99 }] },
      { name: "Chicken Biryani", price: 3.99 }
    ]
  },
  {
    category: "Curries — Non-Veg",
    items: [
      { name: "Anda Bhurji", price: 6.49 },
      { name: "Chicken Curry", price: 5.99 },
      { name: "Chicken Charsi Karahi", price: 6.99 },
      { name: "Lamb Charsi Karahi", price: 7.99 }
    ]
  },
  {
    category: "Curries — Veg",
    items: [
      { name: "Channa", price: 3.99 },
      { name: "Special Daal", price: 4.49 },
      { name: "Lobia / Rajma", price: 4.49 },
      { name: "Kari Pakora", price: 4.49 },
      { name: "Mix Sabzi", price: 5.99 },
      { name: "Paneer Bhurji", price: 7.49 }
    ]
  },
  {
    category: "Omelettes",
    items: [
      { name: "Plain Omelette", price: 2.99 },
      { name: "Vegetable Omelette", price: 3.49 },
      { name: "Cheese Omelette", price: 3.99 },
      { name: "Cutlet Omelette", price: 3.99 },
      { name: "Paratha Omelette", price: 4.95 }
    ]
  },
  {
    category: "Parathas",
    items: [
      { name: "Plain Paratha", price: 1.79 },
      { name: "Aloo Paratha", price: 2.99 },
      { name: "Gobi Paratha", price: 3.49 },
      { name: "Mix Paratha", price: 3.49 },
      { name: "Cheese Paratha", price: 3.49 },
      { name: "Paneer Paratha", price: 3.49 },
      { name: "Chicken Paratha", price: 4.49 },
      { name: "Chicken Cheese Paratha", price: 4.99 }
    ]
  },
  {
    category: "Breakfast",
    items: [
      { name: "Paratha + Omelette + Karak Chai", price: 6.95 },
      { name: "Halwa + Channa + 2 Puri & Chai", price: 7.85 }
    ]
  },
  {
    category: "Hot Drinks",
    items: [
      { name: "Karak Chai", price: 2.49 },
      { name: "Gurh wali Chai", price: 2.99 },
      { name: "Zafrani Tea", price: 2.99 }
    ]
  },
  {
    category: "Cold Drinks",
    items: [
      { name: "Mineral Water", price: 0.99 },
      { name: "Soft Drink", price: 0.99 },
      { name: "Red Bull", price: 1.99 },
      { name: "Sweet Lassi", price: 3.99 },
      { name: "Salty Lassi", price: 3.99 },
      { name: "Mango Lassi", price: 3.99 },
      { name: "Fresh Orange Juice", price: 4.99 }
    ]
  },
  {
    category: "Breads",
    items: [
      { name: "Tawa Chapati", price: 0.99 },
      { name: "Puri", price: 0.99 }
    ]
  },
  {
    category: "Desserts",
    items: [
      { name: "Halwa", price: 2.99 },
      { name: "Caramel Cake", price: 3.49 },
      { name: "Pistachio Milk Cake", price: 3.49 }
    ]
  },
  {
    category: "Extras",
    items: [
      { name: "Plain Rice", price: 2.5 },
      { name: "Raita / Pickle / Salad", price: 0.5 },
      { name: "Green Chilli Sauce", price: 0.75 },
      { name: "Butter", price: 0.5 },
      { name: "Yogurt", price: 1.0 }
    ]
  }
];

// Flattens the menu into foods-table rows (one row per food/size).
export function flattenMenu() {
  const rows = [];
  for (const section of MENU) {
    for (const item of section.items) {
      if (item.sizes) {
        for (const s of item.sizes) {
          rows.push({
            name: `${item.name} (${s.label})`,
            price: s.price,
            description: "Available in Regular and Large sizes.",
            category: section.category
          });
        }
      } else {
        rows.push({
          name: item.name,
          price: item.price,
          description: "",
          category: section.category
        });
      }
    }
  }
  return rows;
}
