import { products as fallbackProducts } from "./data.js";

const summaryGrid = document.querySelector("#summaryGrid");
const lowStockTable = document.querySelector("#lowStockTable");
const lowStockCount = document.querySelector("#lowStockCount");
const categoryGrid = document.querySelector("#categoryGrid");
const footerNote = document.querySelector(".footer small");

const loadingRow = `
  <tr>
    <td colspan="4" class="placeholder">กำลังโหลดข้อมูลจากฐานข้อมูล...</td>
  </tr>
`;

const formatNumber = (value) =>
  Number(value).toLocaleString("th-TH", { maximumFractionDigits: 0 });

const formatCurrency = (value) =>
  Number(value).toLocaleString("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  });

const updateFooterStatus = (source) => {
  if (!footerNote) {
    return;
  }

  if (source === "remote") {
    footerNote.textContent = `Updated ${new Date().toLocaleString(
      "th-TH"
    )} • ข้อมูลจากฐานข้อมูล Neon`;
  } else {
    footerNote.textContent =
      "ใช้ข้อมูลตัวอย่างในเครื่อง • ตรวจสอบการเชื่อมต่อฐานข้อมูล";
  }
};

const buildSummaryCards = (products) => {
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
  if (!Array.isArray(items)) {
    lowStockTable.innerHTML = loadingRow;
    return;
  }

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

const renderCategoryCards = (products) => {
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

const loadProducts = async () => {
  try {
    const response = await fetch("/api/products");
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const payload = await response.json();
    if (payload.fallback || !Array.isArray(payload.products)) {
      console.warn("Falling back to local sample data.");
      return { source: "fallback", products: fallbackProducts };
    }

    return { source: "remote", products: payload.products };
  } catch (error) {
    console.error("Unable to fetch products from API:", error);
    return { source: "fallback", products: fallbackProducts };
  }
};

const bootstrap = async () => {
  lowStockTable.innerHTML = loadingRow;

  const { products, source } = await loadProducts();
  updateFooterStatus(source);

  const lowStockItems = buildSummaryCards(products);
  renderLowStockTable(lowStockItems);
  renderCategoryCards(products);
};

bootstrap();
