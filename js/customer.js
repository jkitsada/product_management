const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=600&q=80";

const productGrid = document.querySelector("#customerProductGrid");
const productCountBadge = document.querySelector("#customerProductCount");
const footerNote = document.querySelector("#customerFooterNote");
const lineShareButton = document.querySelector("#lineShareButton");
const messengerShareButton = document.querySelector("#messengerShareButton");
const copyLinkButton = document.querySelector("#copyLinkButton");

const tokenFromPath = window.location.pathname.match(/\/customer\/([^/]+)/);
const urlParams = new URLSearchParams(window.location.search);
const shareToken = tokenFromPath ? tokenFromPath[1] : urlParams.get("token");
const shareUrl = shareToken
  ? `${window.location.origin}/customer/${shareToken}`
  : window.location.href;

const state = {
  source: "loading",
  products: [],
  shareToken,
  shareUrl,
};

const MESSENGER_APP_ID = "REPLACE_WITH_FACEBOOK_APP_ID";

const formatNumber = (value) =>
  Number(value).toLocaleString("th-TH", { maximumFractionDigits: 0 });

const formatCurrency = (value) =>
  Number(value).toLocaleString("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
  });

const updateFooter = (source) => {
  if (!footerNote) {
    return;
  }

  if (source === "remote") {
    footerNote.textContent = `อัปเดตล่าสุด ${new Date().toLocaleString(
      "th-TH"
    )}`;
  } else if (source === "fallback") {
    footerNote.textContent =
      "ไม่สามารถเชื่อมต่อฐานข้อมูลได้ แสดงข้อมูลตัวอย่างสำหรับลูกค้าเท่านั้น";
  } else if (source === "invalid") {
    footerNote.textContent = "ลิงก์นี้อาจหมดอายุหรือใช้ไม่ได้แล้ว";
  } else {
    footerNote.textContent = "กำลังโหลดข้อมูลสินค้า...";
  }
};

const showMessageCard = (message) => {
  if (productGrid) {
    productGrid.innerHTML = `
      <div class="product-card">
        <div class="product-card__content">
          <p class="product-card__description">
            ${message}
          </p>
        </div>
      </div>
    `;
  }
  if (productCountBadge) {
    productCountBadge.textContent = "0 รายการ";
  }
};

const decorateProduct = (product) => {
  return {
    ...product,
    imageUrl: product.imageUrl || FALLBACK_IMAGE,
  };
};

const renderProducts = (products) => {
  const prepared = products.map(decorateProduct);

  if (productCountBadge) {
    productCountBadge.textContent = `${formatNumber(prepared.length)} รายการ`;
  }

  if (!prepared.length) {
    showMessageCard("ยังไม่มีสินค้าในระบบ");
    return;
  }

  if (!productGrid) {
    return;
  }

  productGrid.innerHTML = prepared
    .map((product) => {
      const lowStock = Number(product.stock) <= Number(product.reorderPoint);
      const stockClass = [
        "product-card__stock",
        lowStock ? "product-card__stock--low" : "",
      ].join(" ");

      return `
        <article class="product-card">
          <div
            class="product-card__image"
            style="background-image: url('${product.imageUrl}');"
            role="img"
            aria-label="${product.name}"
          >
            <span class="product-card__chip">${product.category}</span>
          </div>
          <div class="product-card__content">
            <h3 class="product-card__title">${product.name}</h3>
            <p class="product-card__description">
              ราคา ${formatCurrency(product.price)} ต่อ ${product.unit}. คงเหลือในสต็อก ${formatNumber(
        product.stock
      )} ${product.unit}
            </p>
            <div class="product-card__meta">
              <span class="${stockClass}">
                คงเหลือ ${formatNumber(product.stock)}
              </span>
              <span>สั่งซื้อซ้ำที่ ${formatNumber(product.reorderPoint)}</span>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
};

const loadProducts = async () => {
  if (!state.shareToken) {
    return { source: "invalid", products: [] };
  }

  try {
    const response = await fetch(
      `/api/public/products/${encodeURIComponent(state.shareToken)}`
    );
    if (!response.ok) {
      if (response.status === 404) {
        return { source: "invalid", products: [] };
      }
      throw new Error(`Request failed with status ${response.status}`);
    }

    const payload = await response.json();
    if (!Array.isArray(payload.products)) {
      return { source: "fallback", products: [] };
    }

    return { source: "remote", products: payload.products };
  } catch (error) {
    console.error("Unable to fetch products from API:", error);
    return { source: "fallback", products: [] };
  }
};

const setupShareButtons = () => {
  const text = "เลือกชมสินค้าที่สนใจจากร้านเราได้ที่ลิงก์นี้นะครับ";

  const ensureShareUrl = () => {
    if (!state.shareToken) {
      window.alert("ลิงก์นี้ไม่พร้อมใช้งาน");
      return null;
    }
    return state.shareUrl;
  };

  lineShareButton?.addEventListener("click", () => {
    const url = ensureShareUrl();
    if (!url) return;
    const message = `${text}\n${url}`;
    const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(message)}`;
    window.open(lineUrl, "_blank");
  });

  messengerShareButton?.addEventListener("click", () => {
    const url = ensureShareUrl();
    if (!url) return;

    if (!MESSENGER_APP_ID || MESSENGER_APP_ID === "REPLACE_WITH_FACEBOOK_APP_ID") {
      window.alert("ยังไม่ได้ตั้งค่า Facebook Messenger App ID");
      return;
    }

    const messengerUrl = `https://www.facebook.com/dialog/send?app_id=${encodeURIComponent(
      MESSENGER_APP_ID
    )}&link=${encodeURIComponent(url)}&redirect_uri=${encodeURIComponent(url)}`;

    window.open(messengerUrl, "_blank");
  });

  copyLinkButton?.addEventListener("click", async () => {
    const url = ensureShareUrl();
    if (!url) return;

    try {
      await navigator.clipboard.writeText(url);
      window.alert("คัดลอกลิงก์แล้ว");
    } catch (error) {
      console.error("Copy link failed:", error);
      window.prompt("คัดลอกลิงก์นี้ด้วยตัวเอง", url);
    }
  });

  if (!state.shareToken) {
    lineShareButton?.setAttribute("disabled", "disabled");
    messengerShareButton?.setAttribute("disabled", "disabled");
    copyLinkButton?.setAttribute("disabled", "disabled");
  } else {
    lineShareButton?.removeAttribute("disabled");
    messengerShareButton?.removeAttribute("disabled");
    copyLinkButton?.removeAttribute("disabled");
  }
};

const bootstrap = async () => {
  setupShareButtons();
  updateFooter("loading");

  const { products, source } = await loadProducts();
  state.products = products;
  state.source = source;

  if (source === "invalid") {
    showMessageCard("ลิงก์นี้หมดอายุหรือไม่ถูกต้อง กรุณาติดต่อผู้ขายเพื่อรับลิงก์ใหม่");
  } else if (source === "fallback") {
    showMessageCard("ไม่สามารถโหลดสินค้าได้ กรุณาลองใหม่อีกครั้ง");
  } else {
    renderProducts(products);
  }

  updateFooter(source);
};

bootstrap();
