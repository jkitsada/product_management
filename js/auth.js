const TOKEN_KEY = "pm_token";

const form = document.querySelector("#authForm");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const feedback = document.querySelector("#authFeedback");
const toggleButtons = document.querySelectorAll(".auth-toggle__button");

let mode = "login";

const setFeedback = (message, type = "error") => {
  if (!feedback) return;
  feedback.textContent = message;
  feedback.classList.remove("success");
  if (type === "success") {
    feedback.classList.add("success");
  }
};

const switchMode = (nextMode) => {
  mode = nextMode;
  toggleButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });

  const submitButton = form.querySelector(".auth-submit");
  if (submitButton) {
    submitButton.textContent = mode === "login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก";
  }

  setFeedback("");
};

toggleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const nextMode = button.dataset.mode || "login";
    switchMode(nextMode);
  });
});

const redirectToApp = () => {
  window.location.replace("/");
};

const submitAuth = async (event) => {
  event.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    setFeedback("กรุณากรอกอีเมลและรหัสผ่าน");
    return;
  }

  setFeedback(mode === "login" ? "กำลังเข้าสู่ระบบ..." : "กำลังสร้างบัญชี...", "success");

  try {
    const response = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.message || "ไม่สามารถดำเนินการได้");
    }

    if (!payload.token) {
      throw new Error("การตอบกลับไม่ถูกต้องจากเซิร์ฟเวอร์");
    }

    localStorage.setItem(TOKEN_KEY, payload.token);
    setFeedback(
      mode === "login"
        ? "เข้าสู่ระบบสำเร็จ กำลังนำคุณเข้าสู่ระบบ..."
        : "สมัครสมาชิกสำเร็จ กำลังนำคุณเข้าสู่ระบบ...",
      "success"
    );

    setTimeout(redirectToApp, 800);
  } catch (error) {
    console.error("Auth error:", error);
    setFeedback(error.message || "เกิดข้อผิดพลาด กรุณาลองใหม่");
  }
};

form?.addEventListener("submit", submitAuth);

// ถ้ามี token อยู่แล้วพาเข้าหน้า dashboard ทันที
if (localStorage.getItem(TOKEN_KEY)) {
  redirectToApp();
}
