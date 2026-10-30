/* SUBAKO prototype runtime — chrome, role simulation, charts, tabs.
   Hanya untuk prototipe review. Tidak ada panggilan jaringan. */
(function () {
  "use strict";

  /* ---------------------------------------------------------------- nav */
  const NAV = [
    { group: "Utama", items: [
      { id: "dashboard", href: "02-dashboard.html", label: "Dashboard", icon: "grid", roles: "VIEWER OPERATOR PEKASEH ADMIN" },
      { id: "monitoring", href: "03-monitoring.html", label: "Monitoring", icon: "activity", roles: "VIEWER OPERATOR PEKASEH ADMIN" },
      { id: "gates", href: "04-gates.html", label: "Pintu Air", icon: "gate", roles: "VIEWER OPERATOR PEKASEH ADMIN", badge: "1" },
    ]},
    { group: "Tata Kelola Air", items: [
      { id: "schedule", href: "06-rules.html#jadwal", label: "Jadwal Distribusi", icon: "calendar", roles: "VIEWER OPERATOR PEKASEH ADMIN" },
      { id: "rules", href: "06-rules.html", label: "Aturan Air", icon: "rule", roles: "VIEWER OPERATOR PEKASEH ADMIN" },
      { id: "ledger", href: "07-ledger.html", label: "Buku Catatan Air", icon: "book", roles: "VIEWER OPERATOR PEKASEH ADMIN" },
    ]},
    { group: "Informasi", items: [
      { id: "alerts", href: "08-alerts.html", label: "Peringatan", icon: "bell", roles: "VIEWER OPERATOR PEKASEH ADMIN", badge: "3" },
      { id: "reports", href: "09-reports.html", label: "Laporan", icon: "report", roles: "VIEWER OPERATOR PEKASEH ADMIN" },
    ]},
    { group: "Administrasi", items: [
      { id: "admin", href: "10-admin.html", label: "Pengguna & Perangkat", icon: "shield", roles: "PEKASEH ADMIN" },
      { id: "styleguide", href: "styleguide.html", label: "Styleguide", icon: "palette", roles: "VIEWER OPERATOR PEKASEH ADMIN" },
    ]},
  ];

  const ICONS = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    activity: '<path d="M3 12h4l2 6 4-12 2 6h6"/>',
    gate: '<path d="M4 20V9l6-4 6 4v11"/><path d="M9 20v-5h3v5"/><path d="M4 9h13"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    rule: '<path d="M7 4h10l3 3v13H7z"/><path d="M10 11h7M10 15h5"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 0-2 2z"/><path d="M8 7h8M8 11h8"/>',
    bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
    report: '<path d="M4 20V6M4 20h16"/><rect x="8" y="11" width="3" height="6"/><rect x="14" y="7" width="3" height="10"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    palette: '<circle cx="12" cy="12" r="9"/><circle cx="9" cy="9" r="1.2"/><circle cx="15" cy="9" r="1.2"/><circle cx="9.5" cy="15" r="1.2"/>',
  };

  const icon = (name, size = 16) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;

  const ROLE_LABEL = {
    VIEWER: "Petani · Viewer",
    OPERATOR: "Operator Subak",
    PEKASEH: "Pekaseh",
    ADMIN: "Administrator Teknis",
  };

  const state = {
    role: sessionStorage.getItem("subako.role") || "PEKASEH",
  };

  function renderChrome() {
    const page = document.body.dataset.page || "dashboard";
    const sidebar = document.querySelector("[data-sidebar]");
    if (sidebar) {
      sidebar.innerHTML = `
        <a class="brand" href="index.html" style="text-decoration:none">
          <span class="brand__mark">${icon("gate", 19)}</span>
          <span><span class="brand__name">SUBAKO</span><br><span class="brand__sub">by Mikiko Technology</span></span>
        </a>
        ${NAV.map((g) => `
          <div class="nav-label">${g.group}</div>
          ${g.items.map((it) => `
            <a class="nav-link${it.id === page ? " is-active" : ""}" href="${it.href}" data-roles="${it.roles}">
              ${icon(it.icon)}<span>${it.label}</span>${it.badge ? `<span class="count">${it.badge}</span>` : ""}
            </a>`).join("")}
        `).join("")}
        <div class="sidebar__foot">
          SUBAKO Web-PWA v0.1<br>Tradition decides.<br>Technology measures.
        </div>`;
    }

    const topbar = document.querySelector("[data-topbar]");
    if (topbar) {
      const title = document.body.dataset.title || "";
      topbar.innerHTML = `
        <div class="topbar__title">${title}</div>
        <div class="spacer"></div>
        <div class="site-select">
          <span class="muted small">Site</span>
          <select aria-label="Pilih site">
            <option>Subak Sari · Tabanan</option>
            <option>Subak Kedampal · Jembrana</option>
          </select>
        </div>
        <span class="badge badge--demo" title="Prototipe hanya menampilkan data simulasi">DEMO</span>
        <span class="badge badge--live"><i class="dot-live"></i> LIVE · 14:32 WITA</span>
        <button class="icon-btn" aria-label="Peringatan (3 terbuka)" data-roles="VIEWER OPERATOR PEKASEH ADMIN">
          ${icon("bell")}<span class="dot">3</span>
        </button>
        <div class="row" style="gap:8px">
          <div class="avatar">PK</div>
          <div class="who"><b data-role-name>Pekaseh</b><span>Subak Sari</span></div>
        </div>`;
    }

    const body = document.querySelector("[data-bottomnav]");
    if (body) {
      body.innerHTML = `
        <a href="02-dashboard.html" class="${page === "dashboard" ? "is-active" : ""}">${icon("grid", 20)}<span>Beranda</span></a>
        <a href="06-rules.html#jadwal" class="${page === "schedule" ? "is-active" : ""}">${icon("calendar", 20)}<span>Jadwal</span></a>
        <a href="04-gates.html" class="${page === "gates" ? "is-active" : ""}">${icon("gate", 20)}<span>Pintu</span></a>
        <a href="08-alerts.html" class="${page === "alerts" ? "is-active" : ""}">${icon("bell", 20)}<span>Peringatan</span></a>
        <a href="index.html">${icon("activity", 20)}<span>Lainnya</span></a>`;
    }
  }

  /* --------------------------------------------------------------- role */
  function applyRole(role) {
    state.role = role;
    sessionStorage.setItem("subako.role", role);
    document.documentElement.dataset.role = role;
    document.querySelectorAll("[data-roles]").forEach((el) => {
      const allowed = el.dataset.roles.split(/\s+/);
      el.hidden = !allowed.includes(role);
    });
    document.querySelectorAll("[data-role-name]").forEach((el) => { el.textContent = ROLE_LABEL[role].split(" · ")[0]; });
    document.querySelectorAll("[data-role-select]").forEach((el) => { el.value = role; });
    document.querySelectorAll("[data-role-label]").forEach((el) => { el.textContent = ROLE_LABEL[role]; });
    // Jangan biarkan tab yang tidak berhak tetap aktif setelah role berubah.
    document.querySelectorAll("[data-tabs]").forEach((group) => {
      const active = group.querySelector("[data-tab].is-active");
      if (!active || active.hidden) {
        const first = [...group.querySelectorAll("[data-tab]")].find((b) => !b.hidden);
        if (first) first.click();
      }
    });
  }

  /* -------------------------------------------------------------- charts */
  const NS = "http://www.w3.org/2000/svg";

  function niceBounds(values, pad = 0.12) {
    const nums = values.filter((v) => typeof v === "number" && isFinite(v));
    if (!nums.length) return { min: 0, max: 1 };
    let min = Math.min(...nums);
    let max = Math.max(...nums);
    if (min === max) { min -= 1; max += 1; }
    const span = (max - min) * pad;
    return { min: min - span, max: max + span };
  }

  function pathFrom(values, x, y) {
    let d = "";
    let open = false;
    values.forEach((v, i) => {
      if (typeof v !== "number" || !isFinite(v)) { open = false; return; }
      d += `${open ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      open = true;
    });
    return d;
  }

  function renderLineChart(el) {
    let cfg;
    try { cfg = JSON.parse(el.dataset.chart); } catch (e) { return; }
    const W = 760;
    const H = cfg.height || 210;
    const padL = 46, padR = 14, padT = 12, padB = 26;
    const labels = cfg.labels || [];
    const series = cfg.series || [];
    const all = series.flatMap((s) => s.values).concat(cfg.threshold ? [cfg.threshold.value] : []);
    const { min, max } = niceBounds(all, 0.15);
    const n = Math.max(2, (series[0] && series[0].values.length) || labels.length || 2);
    const x = (i) => padL + (i * (W - padL - padR)) / (n - 1);
    const y = (v) => padT + ((max - v) / (max - min)) * (H - padT - padB);

    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("class", "chart");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", cfg.aria || "Grafik deret waktu");

    const ticks = 4;
    for (let t = 0; t <= ticks; t++) {
      const v = min + ((max - min) * t) / ticks;
      const yy = y(v);
      const line = document.createElementNS(NS, "line");
      line.setAttribute("x1", padL); line.setAttribute("x2", W - padR);
      line.setAttribute("y1", yy); line.setAttribute("y2", yy);
      line.setAttribute("stroke", "#eef2f4"); line.setAttribute("stroke-width", "1");
      svg.appendChild(line);
      const txt = document.createElementNS(NS, "text");
      txt.setAttribute("x", padL - 8); txt.setAttribute("y", yy + 3);
      txt.setAttribute("text-anchor", "end");
      txt.textContent = v.toFixed(cfg.decimals ?? 1);
      svg.appendChild(txt);
    }

    labels.forEach((lab, i) => {
      if (!lab) return;
      const txt = document.createElementNS(NS, "text");
      txt.setAttribute("x", x(i)); txt.setAttribute("y", H - 8);
      txt.setAttribute("text-anchor", i === 0 ? "start" : i === labels.length - 1 ? "end" : "middle");
      txt.textContent = lab;
      svg.appendChild(txt);
    });

    if (cfg.threshold) {
      const tv = cfg.threshold.value;
      const th = document.createElementNS(NS, "line");
      th.setAttribute("x1", padL); th.setAttribute("x2", W - padR);
      th.setAttribute("y1", y(tv)); th.setAttribute("y2", y(tv));
      th.setAttribute("stroke", "#e8a23b"); th.setAttribute("stroke-width", "1.5");
      th.setAttribute("stroke-dasharray", "5 4");
      svg.appendChild(th);
      if (cfg.threshold.label) {
        const tl = document.createElementNS(NS, "text");
        tl.setAttribute("x", W - padR); tl.setAttribute("y", y(tv) - 5);
        tl.setAttribute("text-anchor", "end");
        tl.setAttribute("fill", "#8a5a12");
        tl.textContent = cfg.threshold.label;
        svg.appendChild(tl);
      }
    }

    series.forEach((s) => {
      if (s.fill) {
        const area = document.createElementNS(NS, "path");
        const d = pathFrom(s.values, x, y);
        if (d) {
          const first = s.values.findIndex((v) => typeof v === "number");
          const last = s.values.length - 1 - [...s.values].reverse().findIndex((v) => typeof v === "number");
          const closed = `${d}L${x(last).toFixed(1)},${(H - padB).toFixed(1)}L${x(first).toFixed(1)},${(H - padB).toFixed(1)}Z`;
          area.setAttribute("d", closed);
          area.setAttribute("fill", s.color);
          area.setAttribute("opacity", "0.10");
          svg.appendChild(area);
        }
      }
      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", pathFrom(s.values, x, y));
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", s.color);
      path.setAttribute("stroke-width", s.width || 2);
      path.setAttribute("stroke-linejoin", "round");
      path.setAttribute("stroke-linecap", "round");
      if (s.dashed) path.setAttribute("stroke-dasharray", "5 4");
      svg.appendChild(path);

      if (cfg.gapNote) {
        // penanda eksplisit untuk segmen tanpa data
        s.values.forEach((v, i) => {
          if (typeof v !== "number") {
            const bar = document.createElementNS(NS, "rect");
            bar.setAttribute("x", x(i) - 3); bar.setAttribute("y", padT);
            bar.setAttribute("width", 6); bar.setAttribute("height", H - padT - padB);
            bar.setAttribute("fill", "#f1f5f7");
            svg.insertBefore(bar, svg.firstChild);
          }
        });
      }
    });

    el.innerHTML = "";
    el.appendChild(svg);
  }

  function renderSpark(el) {
    const values = (el.dataset.spark || "").split(",").map((v) => (v.trim() === "" ? NaN : Number(v)));
    const color = el.dataset.color || "#159d8a";
    const W = 180, H = 30, pad = 2;
    const { min, max } = niceBounds(values, 0.3);
    const x = (i) => pad + (i * (W - pad * 2)) / Math.max(1, values.length - 1);
    const y = (v) => pad + ((max - v) / (max - min || 1)) * (H - pad * 2);
    const d = pathFrom(values, x, y);
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="none" aria-hidden="true">
      <path d="${d}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round"></path>
    </svg>`;
  }

  function renderBars(el) {
    const values = (el.dataset.bars || "").split(",").map(Number).filter((v) => !isNaN(v));
    const max = Math.max(...values, 1);
    el.innerHTML = `<div class="row" style="align-items:flex-end;gap:3px;height:${el.dataset.height || 44}px">
      ${values.map((v) => `<span style="flex:1;background:${v / max > 0.8 ? "#d84c4c" : "#159d8a"};opacity:.85;height:${Math.max(4, (v / max) * 100)}%;border-radius:2px"></span>`).join("")}
    </div>`;
  }

  /* ---------------------------------------------------------------- tabs */
  function initTabs() {
    document.querySelectorAll("[data-tabs]").forEach((group) => {
      const buttons = [...group.querySelectorAll("[data-tab]")];
      const panels = [...document.querySelectorAll(`[data-panel="${group.dataset.tabs}"] > [data-tab-panel]`)];
      const activate = (name) => {
        buttons.forEach((b) => b.classList.toggle("is-active", b.dataset.tab === name));
        panels.forEach((p) => { p.hidden = p.dataset.tabPanel !== name; });
      };
      buttons.forEach((b) => b.addEventListener("click", () => activate(b.dataset.tab)));
      const hash = location.hash.replace("#", "");
      if (hash && buttons.some((b) => b.dataset.tab === hash)) activate(hash);
    });
  }

  /* ------------------------------------------------------------ countdown */
  function initCountdowns() {
    document.querySelectorAll("[data-countdown]").forEach((el) => {
      let s = Number(el.dataset.countdown || 90);
      const tick = () => {
        el.textContent = `${s}s`;
        if (s <= 0) { el.textContent = "kedaluwarsa"; return; }
        s -= 1;
        setTimeout(tick, 1000);
      };
      tick();
    });
  }

  /* ------------------------------------------------------- command demo */
  function initCommandDemo() {
    const form = document.querySelector("[data-command-demo]");
    if (!form) return;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const panel = document.querySelector("[data-command-result]");
      if (!panel) return;
      panel.hidden = false;
      panel.innerHTML = `
        <div class="banner banner--info" role="status">
          <span>⏳</span>
          <div>
            <strong>Perintah terkirim (SENT).</strong> Menunggu ACK perangkat dalam
            <span data-countdown="90">90s</span>. Status belum berhasil sampai ACK dan
            posisi aktual terverifikasi.
            <div class="small mt-4">command_id <span class="mono">c4d9…7a1</span> · rule v3 · nonce 8f3a…c0e</div>
          </div>
        </div>`;
      initCountdowns();
      panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  /* ------------------------------------------------------------- misc UI */
  function initMisc() {
    document.querySelectorAll("[data-copy]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(btn.dataset.copy);
          const old = btn.textContent;
          btn.textContent = "tersalin";
          setTimeout(() => { btn.textContent = old; }, 1400);
        } catch (e) { /* clipboard tidak tersedia di prototipe file:// */ }
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderChrome();
    applyRole(state.role);
    document.querySelectorAll("[data-chart]").forEach(renderLineChart);
    document.querySelectorAll("[data-spark]").forEach(renderSpark);
    document.querySelectorAll("[data-bars]").forEach(renderBars);
    initTabs();
    initCountdowns();
    initCommandDemo();
    initMisc();
    document.querySelectorAll("[data-role-select]").forEach((sel) => {
      sel.addEventListener("change", (e) => applyRole(e.target.value));
    });
  });
})();
