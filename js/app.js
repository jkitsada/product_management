import { products } from "./data.js";

const summaryGrid = document.querySelector("#summaryGrid");
const lowStockTable = document.querySelector("#lowStockTable");
const lowStockCount = document.querySelector("#lowStockCount");
const categoryGrid = document.querySelector("#categoryGrid");

const formatNumber = (value) =>
  value.toLocaleString("th-TH", { maximumFractionDigits: 0 });

const formatCurrency = (value) =>
  value.toLocaleString("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  });

const buildSummaryCards = () => {
  const totalProducts = products.length;
  const totalUnits = products.reduce((sum, item) => sum + item.stock, 0);
  const totalValue = products.reduce(
    (sum, item) => sum + item.stock * item.price,
    0
  );
  const lowStockItems = products.filter(
    (item) => item.stock <= item.reorderPoint
  );

  const summaries = [
    {
      title: "จำนวนสินค้า",
      value: `${formatNumber(totalProducts)} รายการ`,
      hint: "ประเภทสินค้าทั้งหมดในระบบ",
    },
    {
      title: "คงเหลือรวม",
      value: `${formatNumber(totalUnits)} ชิ้น`,
      hint: "ยอดสินค้าคงคลังล่าสุด",
    },
    {
      title: "มูลค่าสินค้า",
      value: formatCurrency(totalValue),
      hint: "ประเมินจากราคาขายต่อหน่วย",
    },
    {
      title: "สินค้าใกล้หมด",
      value: `${formatNumber(lowStockItems.length)} รายการ`,
      hint: "ควรวางแผนสั่งซื้อเติม",
    },
  ];

  summaryGrid.innerHTML = summaries
    .map(
      ({ title, value, hint }) => `
        <article class="card">
          <h3>${title}</h3>
          <div class="value">${value}</div>
          <p class="hint">${hint}</p>
        </article>
      `
    )
    .join("");

  return lowStockItems;
};

const renderLowStockTable = (items) => {
  if (items.length === 0) {
    lowStockTable.innerHTML = `
      <tr>
        <td colspan="4" class="placeholder">ยังไม่มีสินค้าใกล้หมดในขณะนี้</td>
      </tr>
    `;
    lowStockCount.textContent = "0 รายการ";
    return;
  }

  lowStockTable.innerHTML = items
    .map(
      ({ id, name, category, stock, unit }) => `
        <tr>
          <td>
            <strong>${name}</strong>
            <div class="muted">${id}</div>
          </td>
          <td>${category}</td>
          <td>${formatNumber(stock)}</td>
          <td>${unit}</td>
        </tr>
      `
    )
    .join("");

  lowStockCount.textContent = `${formatNumber(items.length)} รายการ`;
};

const renderCategoryCards = () => {
  const categories = products.reduce((acc, item) => {
    const category = acc.get(item.category) || {
      items: 0,
      stock: 0,
      value: 0,
    };

    category.items += 1;
    category.stock += item.stock;
    category.value += item.stock * item.price;

    acc.set(item.category, category);
    return acc;
  }, new Map());

  const markup = Array.from(categories.entries())
    .map(([name, stats]) => {
      return `
        <article class="category-card">
          <strong>${name}</strong>
          <div class="meta">
            <span>${formatNumber(stats.items)} รายการ</span>
            <span>${formatNumber(stats.stock)} ชิ้น</span>
          </div>
          <div class="meta">มูลค่า ${formatCurrency(stats.value)}</div>
        </article>
      `;
    })
    .join("");

  categoryGrid.innerHTML = markup;
};

const bootstrap = () => {
  const lowStockItems = buildSummaryCards();
  renderLowStockTable(lowStockItems);
  renderCategoryCards();
};

bootstrap();
