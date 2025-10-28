import { products as fallbackProducts } from "./data.js";

const state = {
  source: "loading",
  products: [],
};

const productGrid = document.querySelector("#customerProductGrid");
const productCountBadge = document.querySelector("#customerProductCount");
const footerNote = document.querySelector("#customerFooterNote");
const shareButton = document.querySelector("#shareButton");
const shareMenu = document.querySelector("#shareMenu");
const shareMenuItems = document.querySelectorAll("[data-share-target]");

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=600&q=80";

const MESSENGER_APP_ID = "1315445346472033";

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
    const response = await fetch("/api/public/products");
    if (!response.ok) {
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

const setupShareButton = () => {
  if (!shareButton) {
    return;
  }

  const url = window.location.href;
  const title = "รายการสินค้าพร้อมจำหน่าย";
  const text = "เลือกชมสินค้าที่สนใจจากร้านเราได้ที่ลิงก์นี้นะครับ";

  const tryWebShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        showShareFeedback("แชร์ลิงก์ไปยังแชตที่ต้องการเรียบร้อยแล้ว");
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("Web Share failed:", error);
          showShareFeedback("ไม่สามารถเปิดหน้าต่างแชร์ได้ กรุณาลองอีกครั้ง");
        }
      }
      return true;
    }
    return false;
  };

  const toggleShareMenu = (visible) => {
    if (!shareMenu) return;
    if (visible) {
      shareMenu.classList.remove("hidden");
    } else {
      shareMenu.classList.add("hidden");
    }
  };

  const openLineShare = () => {
    const message = `${text}\n${url}`;
    const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(message)}`;
    window.open(lineUrl, "_blank");
    showShareFeedback("เปิดหน้าต่าง LINE เพื่อแชร์ลิงก์แล้ว");
  };

  const openMessengerShare = () => {
    if (!MESSENGER_APP_ID || MESSENGER_APP_ID === "REPLACE_WITH_FACEBOOK_APP_ID") {
      showShareFeedback("กรุณาตั้งค่า Facebook Messenger App ID ในไฟล์ js/customer.js ก่อนใช้งาน");
      return;
    }

    const redirectUri = url;
    const messengerUrl = `https://www.facebook.com/dialog/send?app_id=${encodeURIComponent(
      MESSENGER_APP_ID
    )}&link=${encodeURIComponent(url)}&redirect_uri=${encodeURIComponent(redirectUri)}`;

    window.open(messengerUrl, "_blank");
    showShareFeedback("เปิดหน้าต่าง Messenger เพื่อแชร์ลิงก์แล้ว");
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      showShareFeedback("คัดลอกลิงก์ไปยังคลิปบอร์ดแล้ว นำไปวางในแชตที่ต้องการได้เลย");
    } catch (error) {
      console.error("Clipboard write failed:", error);
      window.prompt("คัดลอกลิงก์นี้ไปแชร์ในแชตที่ต้องการ", url);
    }
  };

  shareButton.addEventListener("click", async (event) => {
    event.stopPropagation();
    const webShared = await tryWebShare();
    if (!webShared) {
      const shouldShow = shareMenu?.classList.contains("hidden");
      toggleShareMenu(shouldShow);
    }
  });

  shareMenuItems.forEach((item) => {
    item.addEventListener("click", async (event) => {
      const target = event.currentTarget.dataset.shareTarget;
      toggleShareMenu(false);

      switch (target) {
        case "line":
          openLineShare();
          break;
        case "messenger":
          openMessengerShare();
          break;
        case "copy":
        default:
          await copyLink();
          break;
      }
    });
  });

  document.addEventListener("click", (event) => {
    if (!shareMenu || shareMenu.classList.contains("hidden")) {
      return;
    }
    if (
      !shareMenu.contains(event.target) &&
      event.target !== shareButton
    ) {
      toggleShareMenu(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      toggleShareMenu(false);
    }
  });
};

const bootstrap = async () => {
  setupShareButton();
  updateFooter("loading");

  const { products, source } = await loadProducts();
  state.products = products;
  state.source = source;

  renderProducts(products);
  updateFooter(source);
};

bootstrap();
