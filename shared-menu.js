(() => {
const items = [
{ name: "Home", url: "dashboard.html", icon: "⌂" },
{ name: "Packages", url: "packages.html", icon: "▦" },
{ name: "History", url: "transactions.html", icon: "◷" },
{ name: "Referrals", url: "referrals.html", icon: "♧" },
{ name: "Top Up", url: "topup.html", icon: "+" },
{ name: "Withdrawals", url: "withdrawals.html", icon: "↗" },
{ name: "Investments", url: "investments.html", icon: "◇" },
{ name: "Account Settings", url: "settings.html", icon: "⚙" },
{ name: "Log Out", url: "login.html", icon: "⇥", logout: true }
];

const currentPage = location.pathname.split("/").pop() || "dashboard.html";

const style = document.createElement("style");
style.textContent = `
.fundora-menu-button {
width: 42px;
height: 42px;
border: 1px solid rgba(255,255,255,.12);
border-radius: 13px;
background: #171d35;
color: #fff;
font-size: 23px;
cursor: pointer;
display: grid;
place-items: center;
}

.fundora-menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(0,0,0,.58);
  opacity: 0;
  visibility: hidden;
  transition: .25s ease;
}

.fundora-menu-overlay.open {
  opacity: 1;
  visibility: visible;
}

.fundora-menu-panel {
  position: absolute;
  top: 0;
  right: 0;
  width: min(320px, 86%);
  height: 100%;
  overflow-y: auto;
  padding: 25px 18px;
  background: #0e1428;
  border-left: 1px solid rgba(255,255,255,.09);
  transform: translateX(100%);
  transition: transform .28s ease;
}

.fundora-menu-overlay.open .fundora-menu-panel {
  transform: translateX(0);
}

.fundora-menu-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 28px;
}

.fundora-menu-heading strong {
  font-size: 19px;
  color: #fff;
}

.fundora-menu-close {
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 10px;
  background: #202943;
  color: #fff;
  font-size: 22px;
  cursor: pointer;
}

.fundora-menu-list {
  display: grid;
  gap: 7px;
}

.fundora-menu-list a {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 13px 12px;
  border-radius: 12px;
  color: #c2c9dc;
  text-decoration: none;
  font-size: 14px;
  font-weight: 600;
  transition: .2s ease;
}

.fundora-menu-list a .menu-icon {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  background: #1c2540;
  color: #b9a3ff;
  font-size: 19px;
}

.fundora-menu-list a.active {
  color: #c9b8ff;
  background: rgba(128,87,245,.15);
}

.fundora-menu-list a.active .menu-icon {
  background: rgba(128,87,245,.23);
}

.fundora-menu-list a.logout {
  margin-top: 15px;
  color: #ff9b9b;
  border-top: 1px solid rgba(255,255,255,.08);
  border-radius: 0;
  padding-top: 22px;
}

.fundora-menu-list a.logout .menu-icon {
  color: #ff9b9b;
  background: rgba(255,80,80,.10);
}

body.fundora-menu-open {
  overflow: hidden;
}

`;
document.head.appendChild(style);

document.querySelectorAll(".fundora-nav, .bottom-nav").forEach(nav => nav.remove());

const oldButton = document.querySelector(".profile, .header-link");
if (oldButton) oldButton.remove();

const header = document.querySelector("header");

if (header) {
const button = document.createElement("button");
button.className = "fundora-menu-button";
button.type = "button";
button.setAttribute("aria-label", "Open menu");
button.setAttribute("aria-expanded", "false");
button.innerHTML = "☰";
header.appendChild(button);

const overlay = document.createElement("div");
overlay.className = "fundora-menu-overlay";
overlay.innerHTML = `
  <aside class="fundora-menu-panel" aria-label="Fundora navigation">
    <div class="fundora-menu-heading">
      <strong>Fundora Menu</strong>
      <button class="fundora-menu-close" type="button" aria-label="Close menu">×</button>
    </div>
    <nav class="fundora-menu-list"></nav>
  </aside>
`;

const list = overlay.querySelector(".fundora-menu-list");

items.forEach(item => {
  const link = document.createElement("a");
  link.href = item.url;
  link.innerHTML = `<span class="menu-icon">${item.icon}</span><span>${item.name}</span>`;

  if (item.url === currentPage && !item.logout) {
    link.classList.add("active");
    link.setAttribute("aria-current", "page");
  }

  if (item.logout) {
    link.classList.add("logout");
    link.addEventListener("click", event => {
      if (!confirm("Are you sure you want to leave Fundora?")) {
        event.preventDefault();
      }
    });
  }

  list.appendChild(link);
});

document.body.appendChild(overlay);

const closeMenu = () => {
  overlay.classList.remove("open");
  document.body.classList.remove("fundora-menu-open");
  button.setAttribute("aria-expanded", "false");
};

button.addEventListener("click", () => {
  overlay.classList.add("open");
  document.body.classList.add("fundora-menu-open");
  button.setAttribute("aria-expanded", "true");
});

overlay.querySelector(".fundora-menu-close").addEventListener("click", closeMenu);

overlay.addEventListener("click", event => {
  if (event.target === overlay) closeMenu();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeMenu();
});

}
})();
