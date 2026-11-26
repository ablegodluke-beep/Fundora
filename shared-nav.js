(() => {
const links = [
{
label: "Home",
url: "dashboard.html",
icon: '<svg viewBox="0 0 24 24"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg>'
},
{
label: "Packages",
url: "packages.html",
icon: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>'
},
{
label: "History",
url: "transactions.html",
icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'
},
{
label: "Referrals",
url: "referrals.html",
icon: '<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>'
},
{
label: "Account",
url: "settings.html",
icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>'
}
];

const currentPage = location.pathname.split("/").pop() || "dashboard.html";

const style = document.createElement("style");
style.textContent = `
body {
padding-bottom: 105px !important;
}

.fundora-nav {
  position: fixed;
  z-index: 9999;
  left: 50%;
  bottom: max(15px, env(safe-area-inset-bottom));
  transform: translateX(-50%);
  width: min(520px, calc(100% - 26px));
  min-height: 68px;
  padding: 8px 9px;
  display: flex;
  align-items: center;
  justify-content: space-around;
  gap: 3px;
  background: rgba(15, 20, 39, .96);
  border: 1px solid rgba(255,255,255,.10);
  border-radius: 19px;
  box-shadow: 0 12px 40px rgba(0,0,0,.42);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.fundora-nav a {
  flex: 1;
  min-width: 0;
  min-height: 52px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: #8992aa;
  text-decoration: none;
  border-radius: 13px;
  font-family: inherit;
  transition: background .2s ease, color .2s ease, transform .2s ease;
  -webkit-tap-highlight-color: transparent;
}

.fundora-nav a:active {
  transform: scale(.92);
}

.fundora-nav a.active {
  color: #bba7ff;
  background: rgba(128,87,245,.15);
}

.fundora-nav svg {
  width: 21px;
  height: 21px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.fundora-nav span {
  font-size: 9px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}

@media (min-width: 700px) {
  .fundora-nav {
    bottom: 22px;
  }

  .fundora-nav span {
    font-size: 10px;
  }
}

`;
document.head.appendChild(style);

// Remove the old page-specific navigation.
document.querySelectorAll(".bottom-nav").forEach(nav => nav.remove());

const nav = document.createElement("nav");
nav.className = "fundora-nav";
nav.setAttribute("aria-label", "Main navigation");

links.forEach(item => {
const link = document.createElement("a");
link.href = item.url;

if (currentPage === item.url) {
  link.classList.add("active");
  link.setAttribute("aria-current", "page");
}

link.innerHTML = `${item.icon}<span>${item.label}</span>`;
nav.appendChild(link);

});

document.body.appendChild(nav);
})();
