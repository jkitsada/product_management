import { products as fallbackProducts } from "./data.js";

const TOKEN_KEY = "pm_token";

const state = {
  source: "loading",
  products: [],
  authToken: null,
  currentUser: null,
};

const productGrid = document.querySelector("#customerProductGrid");
const productCountBadge = document.querySelector("#customerProductCount");
const footerNote = document.querySelector("#customerFooterNote");
const lineShareButton = document.querySelector("#lineShareButton");
const messengerShareButton = document.querySelector("#messengerShareButton");
const copyLinkButton = document.querySelector("#copyLinkButton");

const redirectToLogin = () => {
  const redirectPath = encodeURIComponent(
    `${window.location.pathname}${window.location.search}`
  );
  localStorage.removeItem(TOKEN_KEY);
  window.location.replace(`/auth?redirect=${redirectPath}`);
};

const requireToken = () => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    redirectToLogin();
    return null;
  }
  return token;
};

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=600&q=80";

const MESSENGER_APP_ID = "REPLACE_WITH_FACEBOOK_APP_ID";

const imageLookup = fallbackProducts.reduce((map, item) => {
  map.set(item.id, item.imageUrl);
  return map;
}, new Map());

const formatNumber = (value) =>
  Number(value).toLocaleString("th-TH", { maximumFractionDigits: 0 });

const formatCurrency = (value) =>
  Number(value).toLocaleString("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
  });

const decorateProduct = (product) => {
  const imageUrl =
    product.imageUrl ||
    imageLookup.get(product.id) ||
    FALLBACK_IMAGE;

  return {
    ...product,
    imageUrl,
  };
};

const renderProducts = (products) => {
  const prepared = products.map(decorateProduct);

  productCountBadge.textContent = `${formatNumber(prepared.length)} รายการ`;

  if (!prepared.length) {
    productGrid.innerHTML = `
      <div class="product-card">
        <div class="product-card__content">
          <h3 class="product-card__title">ยังไม่มีสินค้าในระบบ</h3>
          <p class="product-card__description">
            โปรดติดต่อพนักงานเพื่ออัปเดตรายการ หรือกลับมาใหม่อีกครั้ง
          </p>
        </div>
      </div>
    `;
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
              ราคา ${formatCurrency(product.price)} ต่อ ${product.unit}. คงเหลือในสต็อก ${formatNumber(product.stock)} ${product.unit}
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

const updateFooter = (source) => {
  if (!footerNote) {
    return;
  }

  if (source === "remote") {
    footerNote.textContent = `อัปเดตล่าสุด ${new Date().toLocaleString(
      "th-TH"
    )} จากฐานข้อมูลจริง`;
  } else if (source === "fallback") {
    footerNote.textContent =
      "ไม่สามารถเชื่อมต่อฐานข้อมูลได้ แสดงข้อมูลตัวอย่างสำหรับลูกค้าเท่านั้น";
  } else {
    footerNote.textContent = "กำลังโหลดข้อมูลสินค้า...";
  }
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
      console.warn("Falling back to sample data for customer view.");
      return { source: "fallback", products: fallbackProducts };
    }

    return { source: "remote", products: payload.products };
  } catch (error) {
    console.error("Unable to fetch products from API:", error);
    return { source: "fallback", products: fallbackProducts };
  }
};

const loadCurrentUser = async () => {
  try {
    const response = await fetch("/api/auth/me", {
      headers: {
        Authorization: `Bearer ${state.authToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Unauthorized (${response.status})`);
    }

    const payload = await response.json();
    return payload.user;
  } catch (error) {
    console.error("Unable to load current user:", error);
    redirectToLogin();
    return null;
  }
};

const showShareFeedback = (message) => {
  if (!footerNote) {
    window.alert(message);
    return;
  }

  const original = footerNote.textContent;
  footerNote.textContent = message;
  footerNote.classList.add("highlight");

  setTimeout(() => {
    footerNote.textContent = original;
    footerNote.classList.remove("highlight");
  }, 2500);
};

const setupShareButtons = () => {
  const shareUrl = `${window.location.origin}/customer`;
  const text = "เลือกชมสินค้าที่สนใจจากร้านเราได้ที่ลิงก์นี้นะครับ";

  if (lineShareButton) {
    lineShareButton.addEventListener("click", () => {
      const message = `${text}\n${shareUrl}`;
      const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(message)}`;
      window.open(lineUrl, "_blank");
      showShareFeedback("เปิดหน้าต่าง LINE เพื่อแชร์ลิงก์แล้ว");
    });
  }

  if (messengerShareButton) {
    messengerShareButton.addEventListener("click", () => {
      if (!MESSENGER_APP_ID || MESSENGER_APP_ID === "REPLACE_WITH_FACEBOOK_APP_ID") {
        showShareFeedback("กรุณาตั้งค่า Facebook Messenger App ID ในไฟล์ js/customer.js ก่อนใช้งาน");
        return;
      }

      const redirectUri = shareUrl;
      const messengerUrl = `https://www.facebook.com/dialog/send?app_id=${encodeURIComponent(
        MESSENGER_APP_ID
      )}&link=${encodeURIComponent(shareUrl)}&redirect_uri=${encodeURIComponent(redirectUri)}`;

      window.open(messengerUrl, "_blank");
      showShareFeedback("เปิดหน้าต่าง Messenger เพื่อแชร์ลิงก์แล้ว");
    });
  }

  if (copyLinkButton) {
    copyLinkButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(shareUrl);
        showShareFeedback("คัดลอกลิงก์ไปยังคลิปบอร์ดแล้ว นำไปวางในแชตที่ต้องการได้เลย");
      } catch (error) {
        console.error("Clipboard write failed:", error);
        window.prompt("คัดลอกลิงก์นี้ไปแชร์ในแชตที่ต้องการ", shareUrl);
      }
    });
  }
};

const bootstrap = async () => {
  const token = requireToken();
  if (!token) {
    return;
  }

  state.authToken = token;

  setupShareButtons();
  updateFooter("loading");

  const user = await loadCurrentUser();
  if (!user) {
    return;
  }

  state.currentUser = user;

  const { products, source } = await loadProducts();
  state.products = products;
  state.source = source;

  renderProducts(products);
  updateFooter(source);
};

bootstrap();
