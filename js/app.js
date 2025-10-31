const fallbackProducts = [];

const TOKEN_KEY = "pm_token";

const state = {
  source: "loading",
  products: [],
  editingId: null,
  authToken: null,
  currentUser: null,
  uploadConfig: { cloudinary: null },
  shareLink: null,
};

const views = document.querySelectorAll("[data-view]");
const navButtons = document.querySelectorAll("[data-view-target]");
const logoutButton = document.querySelector("#logoutButton");
const currentUserEmail = document.querySelector("#currentUserEmail");
const customerLink = document.querySelector("#customerViewLink");

const summaryGrid = document.querySelector("#summaryGrid");
const lowStockTable = document.querySelector("#lowStockTable");
const lowStockCount = document.querySelector("#lowStockCount");
const allProductsTable = document.querySelector("#allProductsTable");
const productCountBadge = document.querySelector("#productCount");
const categoryGrid = document.querySelector("#categoryGrid");
const footerNote = document.querySelector(".footer small");
const dataSourceIndicator = document.querySelector("#dataSourceIndicator");

const productForm = document.querySelector("#productForm");
const productIdInput = document.querySelector("#productId");
const productNameInput = document.querySelector("#productName");
const productCategoryInput = document.querySelector("#productCategory");
const productStockInput = document.querySelector("#productStock");
const productUnitInput = document.querySelector("#productUnit");
const productReorderInput = document.querySelector("#productReorder");
const productPriceInput = document.querySelector("#productPrice");
const productImageUrlInput = document.querySelector("#productImageUrl");
const productImageFileInput = document.querySelector("#productImageFile");
const imageUploadButton = document.querySelector("#imageUploadButton");
const imageClearButton = document.querySelector("#imageClearButton");
const imageFileName = document.querySelector("#imageFileName");
const imagePreview = document.querySelector("#productImagePreview");
const shareLinkDisplay = document.querySelector("#shareLinkDisplay");
const shareExpiryDisplay = document.querySelector("#shareExpiryDisplay");
const shareNotice = document.querySelector("#shareNotice");
const generateShareLinkButton = document.querySelector("#generateShareLinkButton");
const copyShareLinkButton = document.querySelector("#copyShareLinkButton");
const submitButton = document.querySelector("#submitButton");
const cancelEditButton = document.querySelector("#cancelEditButton");
const formHeading = document.querySelector("#formHeading");
const managementNotice = document.querySelector("#managementNotice");
const formStatus = document.querySelector("#formStatus");

const templates = {
  lowStockLoading: `
    <tr>
      <td colspan="4" class="placeholder">กำลังโหลดข้อมูลจากฐานข้อมูล...</td>
    </tr>
  `,
  productsLoading: `
    <tr>
      <td colspan="7" class="placeholder">กำลังโหลดรายการสินค้า...</td>
    </tr>
  `,
};

const DEFAULT_NOTICE =
  "กรอกข้อมูลสินค้าแล้วกดเพิ่มเพื่อบันทึกลงฐานข้อมูล";

const redirectToLogin = () => {
  localStorage.removeItem(TOKEN_KEY);
  window.location.replace("/auth");
};

const requireToken = () => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    redirectToLogin();
    return null;
  }
  return token;
};

const formatNumber = (value) =>
  Number(value).toLocaleString("th-TH", { maximumFractionDigits: 0 });

const formatCurrency = (value) => {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return "-";
  }
  return numeric.toLocaleString("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: numeric % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
};

const updateDataSourceIndicator = (source) => {
  if (!dataSourceIndicator) {
    return;
  }

  dataSourceIndicator.dataset.state = source;

  switch (source) {
    case "remote":
      dataSourceIndicator.textContent = "เชื่อมต่อฐานข้อมูล Neon แล้ว";
      break;
    case "fallback":
      dataSourceIndicator.textContent = "โหมดอ่านอย่างเดียว (ใช้ข้อมูลตัวอย่าง)";
      break;
    default:
      dataSourceIndicator.textContent = "กำลังเชื่อมต่อ...";
      break;
  }
};

const updateFooterStatus = (source) => {
  if (!footerNote) {
    return;
  }

  if (source === "remote") {
    footerNote.textContent = `Updated ${new Date().toLocaleString(
      "th-TH"
    )} • ข้อมูลจากฐานข้อมูล Neon`;
  } else if (source === "fallback") {
    footerNote.textContent =
      "ใช้ข้อมูลตัวอย่างในเครื่อง • ตรวจสอบการเชื่อมต่อฐานข้อมูล";
  } else {
    footerNote.textContent = "กำลังดึงข้อมูลล่าสุดจากฐานข้อมูล...";
  }
};

const setFormMessage = (message = "", type = "neutral") => {
  if (!formStatus) {
    return;
  }
  formStatus.textContent = message;
  formStatus.classList.remove("success", "error");
  if (type === "success") {
    formStatus.classList.add("success");
  } else if (type === "error") {
    formStatus.classList.add("error");
  }
};

const setManagementNotice = (message) => {
  if (managementNotice) {
    managementNotice.textContent = message;
  }
};

const loadAppConfig = async () => {
  try {
    const response = await fetch("/api/config");
    if (!response.ok) {
      throw new Error(`Config request failed with status ${response.status}`);
    }

    const config = await response.json();
    state.uploadConfig = config || {};
  } catch (error) {
    console.error("Failed to load app config:", error);
    state.uploadConfig = {};
  }
};

const formatDateTime = (value) => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  return date.toLocaleString("th-TH", {
    hour12: false,
  });
};

const updateShareLinkUI = () => {
  const link = state.shareLink;
  if (!shareLinkDisplay || !shareExpiryDisplay || !copyShareLinkButton) {
    return;
  }

  if (!link) {
    shareLinkDisplay.textContent = "ยังไม่มีลิงก์สำหรับแชร์";
    shareExpiryDisplay.textContent = "";
    copyShareLinkButton.disabled = true;
    if (shareNotice) {
      shareNotice.textContent =
        "กดสร้างลิงก์เพื่อส่งให้ลูกค้า ลิงก์จะหมดอายุอัตโนมัติภายใน 5 นาที";
    }
    return;
  }

  shareLinkDisplay.textContent = link.url;
  copyShareLinkButton.disabled = false;
  shareExpiryDisplay.textContent = `ลิงก์หมดอายุ ${formatDateTime(link.expiresAt)}`;
  if (shareNotice) {
    shareNotice.textContent = "คัดลอกหรือลิงก์แชร์ให้ลูกค้าได้ทันที";
  }
};

const loadShareLink = async () => {
  try {
    const response = await fetch("/api/share-links/current", {
      headers: { Authorization: `Bearer ${state.authToken}` },
    });

    if (!response.ok) {
      throw new Error(`Share link request failed with status ${response.status}`);
    }

    const payload = await response.json();
    state.shareLink = payload.shareLink;
    updateShareLinkUI();
  } catch (error) {
    console.error("Unable to load share link:", error);
    state.shareLink = null;
    updateShareLinkUI();
  }
};

const generateShareLink = async () => {
  if (!generateShareLinkButton) {
    return;
  }

  generateShareLinkButton.disabled = true;
  setFormMessage("กำลังสร้างลิงก์แชร์...", "neutral");

  try {
    const response = await fetch("/api/share-links", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.authToken}`,
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      if (response.status === 401) {
        redirectToLogin();
        return;
      }
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.message || "ไม่สามารถสร้างลิงก์แชร์ได้");
    }

    const payload = await response.json();
    state.shareLink = payload.shareLink;
    updateShareLinkUI();
    setFormMessage("สร้างลิงก์แชร์เรียบร้อยแล้ว", "success");
  } catch (error) {
    console.error("Generate share link error:", error);
    setFormMessage(error.message, "error");
  } finally {
    generateShareLinkButton.disabled = false;
  }
};

const copyShareLink = async () => {
  const link = state.shareLink;
  if (!link) {
    setFormMessage("ยังไม่มีลิงก์สำหรับคัดลอก", "error");
    return;
  }

  try {
    await navigator.clipboard.writeText(link.url);
    setFormMessage("คัดลอกลิงก์แชร์แล้ว", "success");
  } catch (error) {
    console.error("Copy link failed:", error);
    window.prompt("คัดลอกลิงก์นี้ด้วยตัวเอง", link.url);
  }
};

const resetImageField = () => {
  if (productImageUrlInput) {
    productImageUrlInput.value = "";
  }
  if (productImageFileInput) {
    productImageFileInput.value = "";
  }
  if (imageFileName) {
    imageFileName.textContent = "ยังไม่ได้เลือกรูป";
  }
  if (imagePreview) {
    imagePreview.style.backgroundImage = "";
    imagePreview.classList.remove("has-image");
  }
  if (imageClearButton) {
    imageClearButton.classList.add("hidden");
  }
};

const setImagePreview = (url, displayName) => {
  if (!imagePreview || !imageFileName) {
    return;
  }

  if (!url) {
    resetImageField();
    return;
  }

  imagePreview.style.backgroundImage = `url('${url}')`;
  imagePreview.classList.add("has-image");
  imageFileName.textContent = displayName || "แสดงรูปตัวอย่าง";
  if (imageClearButton) {
    imageClearButton.classList.remove("hidden");
  }
};

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result?.toString() || "");
    reader.onerror = () => reject(reader.error || new Error("อ่านไฟล์ไม่สำเร็จ"));
    reader.readAsDataURL(file);
  });

const uploadImageToCloudinary = async (file) => {
  const cloudinary = state.uploadConfig?.cloudinary;
  if (!cloudinary?.cloudName || !cloudinary?.uploadPreset) {
    return null;
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", cloudinary.uploadPreset);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudinary.cloudName}/image/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error("อัปโหลดรูปไม่สำเร็จ");
  }

  const payload = await response.json();
  return payload.secure_url;
};

const handleImageFileChange = async () => {
  if (!productImageFileInput || !productImageFileInput.files?.length) {
    resetImageField();
    return;
  }

  const file = productImageFileInput.files[0];

  try {
    setFormMessage("กำลังประมวลผลรูปภาพ...", "neutral");

    let imageUrl = null;
    let usedCloudinary = false;
    try {
      imageUrl = await uploadImageToCloudinary(file);
      usedCloudinary = Boolean(imageUrl);
    } catch (error) {
      console.warn("Cloudinary upload failed, falling back to Base64", error);
      imageUrl = null;
    }

    if (!imageUrl) {
      if (file.size > 512 * 1024) {
        setFormMessage(
          "ไฟล์มีขนาดใหญ่ อาจทำให้การบันทึกช้าหรือไม่สำเร็จ กรุณาตั้งค่า Cloudinary เพื่ออัปโหลดได้สะดวก",
          "error"
        );
      } else {
        setFormMessage("ใช้รูปจากเครื่องโดยตรง (Base64)", "neutral");
      }
      imageUrl = await readFileAsDataUrl(file);
    } else if (usedCloudinary) {
      setFormMessage("อัปโหลดรูปเรียบร้อยแล้ว", "success");
    }

    if (productImageUrlInput) {
      productImageUrlInput.value = imageUrl;
    }
    setImagePreview(imageUrl, file.name);
  } catch (error) {
    console.error("Image processing failed:", error);
    setFormMessage("จัดการรูปภาพไม่สำเร็จ กรุณาลองใหม่", "error");
    resetImageField();
  }
};

const setFormEnabled = (enabled) => {
  const controls = productForm?.querySelectorAll("input, button[type='submit']");
  controls?.forEach((control) => {
    control.disabled = !enabled;
  });
  if (cancelEditButton) {
    cancelEditButton.disabled = !enabled;
  }

  if (enabled && state.editingId && productIdInput) {
    productIdInput.disabled = true;
  }
};

const resetForm = () => {
  productForm?.reset();
  state.editingId = null;
  if (productIdInput) {
    productIdInput.disabled = false;
  }
  resetImageField();
  submitButton.textContent = "เพิ่มสินค้า";
  cancelEditButton.classList.add("hidden");
  formHeading.textContent = "เพิ่มสินค้าใหม่";
  setManagementNotice(DEFAULT_NOTICE);
  setFormMessage("");
  setFormEnabled(state.source === "remote");
};

const populateForm = (product) => {
  productIdInput.value = product.id;
  productIdInput.disabled = true;
  productNameInput.value = product.name;
  productCategoryInput.value = product.category;
  productStockInput.value = product.stock;
  productUnitInput.value = product.unit;
  productReorderInput.value = product.reorderPoint;
  productPriceInput.value = product.price;
  if (productImageUrlInput) {
    productImageUrlInput.value = product.imageUrl || "";
  }
  if (product.imageUrl) {
    setImagePreview(product.imageUrl, "รูปปัจจุบัน");
  } else {
    resetImageField();
  }
};

const buildSummaryCards = (products) => {
  const totalProducts = products.length;
  const totalUnits = products.reduce((sum, item) => sum + Number(item.stock), 0);
  const totalValue = products.reduce(
    (sum, item) => sum + Number(item.stock) * Number(item.price),
    0
  );
  const lowStockItems = products.filter(
    (item) => Number(item.stock) <= Number(item.reorderPoint)
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
      title: "มูลค่าสินค้าประมาณการ",
      value: formatCurrency(totalValue),
      hint: "คำนวณจากราคาและจำนวนที่คงเหลือ",
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
    lowStockTable.innerHTML = templates.lowStockLoading;
    lowStockCount.textContent = "0 รายการ";
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
  if (!products.length) {
    categoryGrid.innerHTML =
      '<div class="placeholder">ยังไม่มีข้อมูลสินค้าในระบบ</div>';
    return;
  }

  const categories = products.reduce((acc, item) => {
    const category = acc.get(item.category) || {
      items: 0,
      stock: 0,
      value: 0,
    };

    category.items += 1;
    category.stock += Number(item.stock);
    category.value += Number(item.stock) * Number(item.price);

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

const renderAllProductsTable = (products) => {
  productCountBadge.textContent = `${formatNumber(products.length)} รายการ`;

  if (!products.length) {
    allProductsTable.innerHTML = `
      <tr>
        <td colspan="7" class="placeholder">ยังไม่มีสินค้าในระบบ</td>
      </tr>
    `;
    return;
  }

  const isRemote = state.source === "remote";

  allProductsTable.innerHTML = products
    .map(
      ({ id, name, category, stock, unit, price, reorderPoint }) => `
        <tr>
          <td>
            <strong>${name}</strong>
            <div class="muted">${id}</div>
          </td>
          <td>${category}</td>
          <td>${formatNumber(stock)}</td>
          <td>${unit}</td>
          <td>${formatCurrency(price)}</td>
          <td>${formatNumber(reorderPoint)}</td>
          <td class="actions-col">
            ${
              isRemote
                ? `<div class="table-actions">
                     <button class="btn btn-ghost" data-action="edit" data-id="${id}">
                       แก้ไข
                     </button>
                     <button class="btn btn-danger" data-action="delete" data-id="${id}">
                       ลบ
                     </button>
                   </div>`
                : '<span class="muted">โหมดอ่านอย่างเดียว</span>'
            }
          </td>
        </tr>
      `
    )
    .join("");
};

const loadProducts = async () => {
  try {
    const response = await fetch("/api/products", {
      headers: {
        Authorization: `Bearer ${state.authToken}`,
      },
    });
    if (!response.ok) {
      if (response.status === 401) {
        redirectToLogin();
        return { source: "fallback", products: fallbackProducts };
      }
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

const refreshProducts = async () => {
  lowStockTable.innerHTML = templates.lowStockLoading;
  allProductsTable.innerHTML = templates.productsLoading;

  const { products, source } = await loadProducts();

  state.products = products;
  state.source = source;

  updateDataSourceIndicator(source);
  updateFooterStatus(source);

  if (source === "remote") {
    setFormEnabled(true);
    setFormMessage("");
    if (!state.editingId) {
      setManagementNotice(DEFAULT_NOTICE);
    }
  } else if (source === "fallback") {
    resetForm();
    setFormEnabled(false);
    setManagementNotice(
      "ไม่สามารถเชื่อมต่อฐานข้อมูลได้ ขณะนี้ใช้งานในโหมดอ่านอย่างเดียว"
    );
    setFormMessage(
      "ไม่พบการเชื่อมต่อฐานข้อมูล แสดงข้อมูลตัวอย่างแทน",
      "error"
    );
  }

  const lowStockItems = buildSummaryCards(products);
  renderLowStockTable(lowStockItems);
  renderAllProductsTable(products);
  renderCategoryCards(products);
};

const handleSubmit = async (event) => {
  event.preventDefault();
  if (state.source !== "remote") {
    setFormMessage(
      "ไม่สามารถบันทึกได้เนื่องจากโหมดอ่านอย่างเดียว",
      "error"
    );
    return;
  }

  const formData = new FormData(productForm);
  const payload = {
    name: formData.get("name")?.trim(),
    category: formData.get("category")?.trim(),
    stock: Number(formData.get("stock")),
    unit: formData.get("unit")?.trim(),
    reorderPoint: Number(formData.get("reorderPoint")),
    price: Number(formData.get("price")),
    imageUrl: formData.get("imageUrl")?.trim() || null,
  };

  if (!state.editingId) {
    payload.id = formData.get("id")?.trim();
  }

  const url = state.editingId
    ? `/api/products/${encodeURIComponent(state.editingId)}`
    : "/api/products";
  const method = state.editingId ? "PUT" : "POST";

  submitButton.disabled = true;
  submitButton.textContent = state.editingId ? "กำลังบันทึก..." : "กำลังเพิ่ม...";
  setFormMessage(
    state.editingId ? "กำลังบันทึกการแก้ไข..." : "กำลังเพิ่มสินค้าใหม่..."
  );

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.authToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      if (response.status === 401) {
        redirectToLogin();
        return;
      }
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.message || "ไม่สามารถบันทึกข้อมูลได้");
    }

    await refreshProducts();
    resetForm();
    setFormMessage(
      state.editingId ? "บันทึกการแก้ไขเรียบร้อยแล้ว" : "เพิ่มสินค้าเรียบร้อยแล้ว",
      "success"
    );
  } catch (error) {
    console.error("Form submission error:", error);
    setFormMessage(error.message, "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = state.editingId
      ? "บันทึกการแก้ไข"
      : "เพิ่มสินค้า";
  }
};

const handleCancelEdit = () => {
  resetForm();
  setFormMessage("ยกเลิกการแก้ไขแล้ว");
};

const startEdit = (id) => {
  const product = state.products.find((item) => item.id === id);
  if (!product) {
    setFormMessage("ไม่พบสินค้าที่ต้องการแก้ไข", "error");
    return;
  }

  state.editingId = product.id;
  populateForm(product);
  submitButton.textContent = "บันทึกการแก้ไข";
  cancelEditButton.classList.remove("hidden");
  formHeading.textContent = "แก้ไขสินค้า";
  setManagementNotice("ปรับข้อมูลสินค้าแล้วกดบันทึกเพื่ออัปเดตฐานข้อมูล");
  setFormMessage(`กำลังแก้ไขสินค้า ${product.id}`);
  setFormEnabled(true);

  productForm.scrollIntoView({ behavior: "smooth", block: "center" });
};

const handleDelete = async (id) => {
  if (state.source !== "remote") {
    setFormMessage(
      "ไม่สามารถลบสินค้าได้เนื่องจากโหมดอ่านอย่างเดียว",
      "error"
    );
    return;
  }

  const product = state.products.find((item) => item.id === id);
  if (!product) {
    setFormMessage("ไม่พบสินค้าที่ต้องการลบ", "error");
    return;
  }

  const confirmed = window.confirm(
    `ต้องการลบสินค้า ${product.name} (${product.id}) ใช่หรือไม่?`
  );

  if (!confirmed) {
    return;
  }

  setFormMessage("กำลังลบสินค้า...");

  try {
    const response = await fetch(`/api/products/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${state.authToken}`,
      },
    });

    if (!response.ok && response.status !== 204) {
      if (response.status === 401) {
        redirectToLogin();
        return;
      }
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.message || "ไม่สามารถลบสินค้าได้");
    }

    if (state.editingId === id) {
      resetForm();
    }

    await refreshProducts();
    setFormMessage("ลบสินค้าเรียบร้อยแล้ว", "success");
  } catch (error) {
    console.error("Delete error:", error);
    setFormMessage(error.message, "error");
  }
};

const handleTableClick = (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const { action, id } = button.dataset;
  if (!id) {
    return;
  }

  if (action === "edit") {
    startEdit(id);
  } else if (action === "delete") {
    handleDelete(id);
  }
};

const showView = (target) => {
  views.forEach((view) => {
    view.classList.toggle("hidden", view.dataset.view !== target);
  });

  navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.viewTarget === target);
  });
};

const bootstrap = async () => {
  const token = requireToken();
  if (!token) {
    return;
  }

  state.authToken = token;

  await loadAppConfig();

  imageUploadButton?.addEventListener("click", () => {
    productImageFileInput?.click();
  });

  productImageFileInput?.addEventListener("change", () => {
    handleImageFileChange();
  });

  imageClearButton?.addEventListener("click", () => {
    resetImageField();
    if (productImageUrlInput) {
      productImageUrlInput.value = "";
    }
  });

  generateShareLinkButton?.addEventListener("click", generateShareLink);
  copyShareLinkButton?.addEventListener("click", copyShareLink);

  if (customerLink) {
    customerLink.addEventListener("click", (event) => {
      if (state.shareLink?.url) {
        customerLink.href = state.shareLink.url;
      } else {
        customerLink.href = "/customer";
      }
    });
  }

  logoutButton?.addEventListener("click", () => {
    redirectToLogin();
  });

  try {
    const meResponse = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!meResponse.ok) {
      throw new Error("unauthorized");
    }
    const { user } = await meResponse.json();
    state.currentUser = user;
    if (currentUserEmail) {
      currentUserEmail.textContent = user.email;
    }
  } catch (error) {
    redirectToLogin();
    return;
  }

  await loadShareLink();

  navButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.viewTarget || "dashboard";
      showView(target);
    });
  });

  showView("dashboard");
  updateDataSourceIndicator("loading");
  updateFooterStatus("loading");
  lowStockTable.innerHTML = templates.lowStockLoading;
  allProductsTable.innerHTML = templates.productsLoading;

  productForm.addEventListener("submit", handleSubmit);
  cancelEditButton.addEventListener("click", handleCancelEdit);
  allProductsTable.addEventListener("click", handleTableClick);

  await refreshProducts();
};

bootstrap();
