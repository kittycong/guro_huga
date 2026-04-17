const HOLIDAYS = {
  "2026-01-01": "신정",
  "2026-02-16": "설날",
  "2026-02-17": "설 연휴",
  "2026-02-18": "대체공휴일",
  "2026-03-01": "삼일절",
  "2026-03-02": "대체공휴일",
  "2026-05-05": "어린이날",
  "2026-05-25": "대체공휴일",
  "2026-06-06": "현충일",
  "2026-08-15": "광복절",
  "2026-08-17": "대체공휴일",
  "2026-09-25": "추석",
  "2026-10-03": "개천절",
  "2026-10-05": "대체공휴일",
  "2026-10-09": "한글날",
  "2026-12-25": "성탄절"
};

const SUBSTITUTE_HOLIDAYS = new Set(["2026-02-18", "2026-03-02", "2026-05-25", "2026-08-17", "2026-10-05"]);
const COLORS = ["#c75272", "#2d7c61", "#305f94", "#7153b8", "#b67a1c", "#be3947", "#0d6d58", "#5760b4"];
const STORAGE_KEYS = {
  draft: "guro_huga_local_draft",
  token: "guro_huga_github_token",
  syncPrefs: "guro_huga_sync_prefs"
};

const MENU_DEFS = [
  { key: "dashboard", label: "대시보드" },
  { key: "cal", label: "달력 보기" },
  { key: "hist", label: "사용 내역" },
  { key: "set", label: "연차 설정" },
  { key: "emp", label: "직원 목록" },
  { key: "mgr", label: "전체 현황" },
  { key: "sub", label: "대체휴가" },
  { key: "perm", label: "권한 관리" },
  { key: "sync", label: "공유 저장" }
];

const ui = {
  activeView: "dashboard",
  currentYear: new Date().getFullYear(),
  currentMonth: new Date().getMonth(),
  managerYear: new Date().getFullYear(),
  selectedEmployeeId: "",
  settingsEmployeeId: "",
  subEmployeeId: "",
  modalType: ""
};

let state = {
  version: 2,
  updatedAt: "",
  repo: {
    owner: "kittycong",
    name: "guro_huga",
    branch: "main",
    dataPath: "data/app-data.json"
  },
  settings: {
    warningMonth: 10,
    expiryRiskDays: 3,
    promotionMinDays: 5,
    promotionMaxUsagePercent: 40
  },
  employees: [],
  records: [],
  totals: {},
  subLeaves: [],
  perms: {}
};

let githubSha = "";
let lastLoadedAt = "";
let lastSavedAt = "";
let saveTimer = null;
let saveQueued = false;
let saveInFlight = false;
let syncStatus = { tone: "idle", label: "대기", detail: "공유 데이터 준비 중" };

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindStaticEvents();
  await loadInitialState();
  normalizeState();
  initializeSelections();
  hydrateSyncForm();
  renderAll();
}

function bindStaticEvents() {
  document.body.addEventListener("click", async (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action) return;

    if (action === "open-record-modal") openRecordModal();
    if (action === "open-employee-modal") openEmployeeModal();
    if (action === "open-subleave-modal") openSubLeaveModal();
    if (action === "open-settings-view") switchView("set");
    if (action === "close-modal") closeModal();
    if (action === "prev-month") moveMonth(-1);
    if (action === "next-month") moveMonth(1);
    if (action === "add-setting-year") addSettingYear();
    if (action === "save-token") saveToken();
    if (action === "clear-token") clearToken();
    if (action === "save-now") await saveSharedNow();
    if (action === "reload-shared" || action === "refresh-remote") await reloadFromRemote();
  });

  document.getElementById("emp-sel").addEventListener("change", (event) => {
    ui.selectedEmployeeId = event.target.value;
    renderAll();
  });

  document.getElementById("set-emp-sel").addEventListener("change", (event) => {
    ui.settingsEmployeeId = event.target.value;
    renderSettings();
  });

  document.getElementById("join-date").addEventListener("change", (event) => {
    const employee = employeeById(ui.settingsEmployeeId);
    if (!employee) return;
    employee.joinDate = event.target.value;
    touchState("입사일 수정");
    renderSettings();
  });

  document.getElementById("auto-save-toggle").addEventListener("change", (event) => {
    const prefs = getSyncPrefs();
    prefs.autoSave = event.target.checked;
    saveSyncPrefs(prefs);
    syncStatus.detail = prefs.autoSave ? "수정 시 자동저장 사용" : "자동저장 꺼짐";
    renderSyncStatus();
  });

  ["repo-owner", "repo-name", "repo-branch", "repo-path"].forEach((id) => {
    document.getElementById(id).addEventListener("change", updateRepoFields);
  });

  document.getElementById("modal-overlay").addEventListener("click", (event) => {
    if (event.target.id === "modal-overlay") closeModal();
  });
}

async function loadInitialState() {
  const draft = readJsonStorage(STORAGE_KEYS.draft);
  if (draft) {
    state = draft;
    lastLoadedAt = formatDateTime(new Date());
    setSyncStatus("idle", "초안", "로컬 초안을 불러왔습니다.");
  }

  try {
    const response = await fetch(`./data/app-data.json?ts=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`공유 파일 로딩 실패 (${response.status})`);
    const data = await response.json();
    state = data;
    lastLoadedAt = formatDateTime(new Date());
    setSyncStatus("success", "공유", "공유 JSON 데이터를 불러왔습니다.");
  } catch (error) {
    if (!draft) {
      setSyncStatus("error", "오류", error.message);
    }
  }

  await refreshGithubSha();
}

async function refreshGithubSha() {
  try {
    const url = githubApiUrl(state.repo.owner, state.repo.name, state.repo.dataPath, state.repo.branch);
    const response = await fetch(url, { headers: githubHeaders(false) });
    if (!response.ok) return;
    const payload = await response.json();
    githubSha = payload.sha || "";
  } catch (_error) {
    // Ignore sha refresh errors; read-only mode still works.
  }
}

function normalizeState() {
  state.version = state.version || 2;
  state.repo = Object.assign({
    owner: "kittycong",
    name: "guro_huga",
    branch: "main",
    dataPath: "data/app-data.json"
  }, state.repo || {});
  state.settings = Object.assign({
    warningMonth: 10,
    expiryRiskDays: 3,
    promotionMinDays: 5,
    promotionMaxUsagePercent: 40
  }, state.settings || {});
  state.employees = Array.isArray(state.employees) ? state.employees : [];
  state.records = Array.isArray(state.records) ? state.records : [];
  state.subLeaves = Array.isArray(state.subLeaves) ? state.subLeaves : [];
  state.totals = state.totals || {};
  state.perms = state.perms || {};

  if (!state.employees.length) {
    state.employees = [{
      id: "e1",
      name: "김휘원",
      dept: "구로센터",
      role: "간사",
      joinDate: "2022-03-01",
      color: COLORS[0]
    }];
  }

  state.employees.forEach((employee, index) => {
    employee.color = employee.color || COLORS[index % COLORS.length];
    if (!state.perms[employee.id]) {
      state.perms[employee.id] = {
        grade: index === 0 ? "admin" : "normal",
        menus: {}
      };
    }
  });
}

function initializeSelections() {
  const firstId = state.employees[0]?.id || "";
  ui.selectedEmployeeId = ui.selectedEmployeeId || firstId;
  ui.settingsEmployeeId = ui.settingsEmployeeId || ui.selectedEmployeeId;
  ui.subEmployeeId = ui.subEmployeeId || ui.selectedEmployeeId;
  ui.currentYear = ui.currentYear || new Date().getFullYear();
  ui.managerYear = ui.managerYear || ui.currentYear;
}

function renderAll() {
  renderNavigation();
  renderSidebar();
  renderDashboard();
  renderCalendarView();
  renderHistory();
  renderSettings();
  renderEmployees();
  renderSubLeaves();
  renderPermissions();
  renderManager();
  renderSyncPage();
  renderSyncStatus();
}

function renderNavigation() {
  const container = document.getElementById("nav-list");
  const current = currentUser();
  container.innerHTML = MENU_DEFS
    .filter((menu) => hasMenuAccess(current?.id, menu.key))
    .map((menu) => {
      const active = ui.activeView === menu.key ? " active" : "";
      return `<button class="nav-btn${active}" type="button" data-view="${menu.key}">${menu.label}<span>›</span></button>`;
    })
    .join("");

  container.querySelectorAll(".nav-btn").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });
}

function renderSidebar() {
  const selected = currentUser();
  document.getElementById("emp-sel").innerHTML = state.employees
    .map((employee) => `<option value="${employee.id}" ${employee.id === ui.selectedEmployeeId ? "selected" : ""}>${employee.name}</option>`)
    .join("");

  document.getElementById("sb-avatar").style.background = selected?.color || COLORS[0];
  document.getElementById("sb-avatar").textContent = (selected?.name || "휴가").slice(0, 2);
  document.getElementById("sb-name").textContent = selected?.name || "";
  document.getElementById("sb-meta").textContent = [selected?.dept, selected?.role].filter(Boolean).join(" · ");
}

function renderDashboard() {
  const year = ui.managerYear;
  document.getElementById("dashboard-year-label").textContent = `${year}년 기준`;

  const summaries = state.employees.map((employee) => employeeSummary(employee.id, year));
  const totalGrant = summaries.reduce((sum, item) => sum + item.total, 0);
  const totalUsed = summaries.reduce((sum, item) => sum + item.used, 0);
  const totalRemain = summaries.reduce((sum, item) => sum + item.remain, 0);
  const peopleAtRisk = summaries.filter((item) => item.alertLevel === "urgent" || item.alertLevel === "warning").length;
  const promotionTargets = summaries.filter((item) => item.promotionNeeded).length;

  document.getElementById("dashboard-kpis").innerHTML = [
    kpiCard("primary", "직원 수", `${state.employees.length}`, "명", "현재 관리 대상"),
    kpiCard("white", "총 연차 생성", totalGrant.toFixed(1), "일", "전체 직원 합산"),
    kpiCard("green", "총 사용", totalUsed.toFixed(1), "일", "연차/반차 반영"),
    kpiCard("amber", "소멸·촉진 대상", `${promotionTargets}`, "명", "촉진 검토 필요"),
    kpiCard("red", "위험 인원", `${peopleAtRisk}`, "명", "잔여/소멸 경고")
  ].join("");

  const alerts = buildAlerts(summaries);
  document.getElementById("alert-count").textContent = `${alerts.length}건`;
  document.getElementById("alert-list").innerHTML = alerts.length ? alerts.map(renderAlertItem).join("") : emptyState("현재 표시할 경고가 없습니다.");

  document.getElementById("dashboard-body").innerHTML = summaries.map((item) => {
    const latest = latestRecord(item.employee.id, year)?.date || "없음";
    const tone = item.alertLevel === "urgent" ? "red" : item.alertLevel === "warning" ? "amber" : "green";
    const label = item.promotionNeeded ? "촉진 필요" : item.alertLabel;
    return `
      <tr>
        <td>${employeeCell(item.employee)}</td>
        <td>${item.employee.dept || "-"}</td>
        <td>${item.total}</td>
        <td>${item.used}</td>
        <td><strong>${item.remain}</strong></td>
        <td>${item.usagePercent}%</td>
        <td>${latest}</td>
        <td><span class="tag ${tone}">${label}</span></td>
      </tr>
    `;
  }).join("");

  document.getElementById("dept-summary").innerHTML = buildDepartmentSummary(summaries);
}

function renderCalendarView() {
  const employee = currentUser();
  if (!employee) return;
  const summary = employeeSummary(employee.id, ui.currentYear);
  document.getElementById("cal-heading").textContent = `${employee.name} · ${ui.currentYear}년 ${ui.currentMonth + 1}월`;
  document.getElementById("month-label").textContent = `${ui.currentYear}년 ${ui.currentMonth + 1}월`;
  document.getElementById("personal-kpis").innerHTML = [
    kpiCard("white", "생성 연차", summary.total.toFixed(1), "일", `${ui.currentYear}년 기준`),
    kpiCard("green", "사용", summary.used.toFixed(1), "일", "연차 + 반차"),
    kpiCard("amber", "반차 횟수", `${summary.halfCount}`, "회", "0.5일 / 0.25일 포함"),
    kpiCard("red", "공휴일", `${monthHolidayCount(ui.currentYear, ui.currentMonth)}`, "일", "이번 달"),
    kpiCard("primary", "잔여", summary.remain.toFixed(1), "일", summary.alertLabel)
  ].join("");

  renderYearTabs("year-tabs", ui.currentYear, (year) => {
    ui.currentYear = year;
    renderAll();
  });
  renderCalendarGrid();
  renderMonthHistory();
}

function renderHistory() {
  renderYearTabs("history-year-tabs", ui.currentYear, (year) => {
    ui.currentYear = year;
    renderHistory();
    renderCalendarView();
  });

  const records = state.records
    .filter((record) => record.empId === ui.selectedEmployeeId && record.date.startsWith(String(ui.currentYear)))
    .sort((left, right) => right.date.localeCompare(left.date));

  document.getElementById("history-count").textContent = `총 ${records.length}건`;
  document.getElementById("history-body").innerHTML = records.length ? records.map(renderRecordRow).join("") : emptyState("해당 연도 기록이 없습니다.");
}

function renderSettings() {
  const selected = employeeById(ui.settingsEmployeeId) || currentUser();
  if (!selected) return;
  ui.settingsEmployeeId = selected.id;

  document.getElementById("set-emp-sel").innerHTML = state.employees
    .map((employee) => `<option value="${employee.id}" ${employee.id === selected.id ? "selected" : ""}>${employee.name}</option>`)
    .join("");

  document.getElementById("join-date").value = selected.joinDate || "";
  const years = allYears();
  const auto = accrual(selected.joinDate, ui.currentYear);
  document.getElementById("accrual-hint").textContent = selected.joinDate
    ? `${selected.name}님의 ${ui.currentYear}년 자동 계산 연차는 ${auto}일입니다.`
    : "입사일을 입력하면 자동 계산 기준이 표시됩니다.";

  document.getElementById("year-inputs").innerHTML = years.map((year) => {
    const value = getTotal(selected.id, year);
    const autoValue = accrual(selected.joinDate, year);
    return `
      <div>
        <label class="field-label">${year}년</label>
        <input class="field" type="number" min="0" max="50" step="0.5" value="${value}" data-total-emp="${selected.id}" data-total-year="${year}">
        <div class="row-desc">자동 계산 ${autoValue}일</div>
      </div>
    `;
  }).join("");

  document.querySelectorAll("[data-total-emp]").forEach((input) => {
    input.addEventListener("change", (event) => {
      const empId = event.target.dataset.totalEmp;
      const year = event.target.dataset.totalYear;
      state.totals[`${empId}_${year}`] = Number(event.target.value) || 0;
      touchState("연도별 연차 수정");
      renderAll();
    });
  });
}

function renderEmployees() {
  document.getElementById("employee-grid").innerHTML = state.employees.map((employee) => {
    const summary = employeeSummary(employee.id, ui.managerYear);
    const width = summary.total ? Math.min(100, Math.round((summary.used / summary.total) * 100)) : 0;
    return `
      <div class="employee-card ${employee.id === ui.selectedEmployeeId ? "selected" : ""}">
        <div class="avatar" style="background:${employee.color}">${employee.name.slice(0, 2)}</div>
        <div class="employee-name">${employee.name}</div>
        <div class="employee-meta">${[employee.dept, employee.role].filter(Boolean).join(" · ") || "정보 없음"}</div>
        <div class="progress"><span style="width:${width}%"></span></div>
        <div class="employee-meta">${summary.used} / ${summary.total}일 사용 · 잔여 ${summary.remain}일</div>
        <div class="card-actions">
          <button class="action-link" type="button" data-emp-open="${employee.id}">달력 보기</button>
          <button class="action-link" type="button" data-emp-edit="${employee.id}">수정</button>
          <button class="action-link" type="button" data-emp-delete="${employee.id}">삭제</button>
        </div>
      </div>
    `;
  }).join("");

  document.querySelectorAll("[data-emp-open]").forEach((button) => {
    button.addEventListener("click", () => {
      ui.selectedEmployeeId = button.dataset.empOpen;
      switchView("cal");
    });
  });

  document.querySelectorAll("[data-emp-edit]").forEach((button) => {
    button.addEventListener("click", () => openEmployeeModal(button.dataset.empEdit));
  });

  document.querySelectorAll("[data-emp-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteEmployee(button.dataset.empDelete));
  });
}

function renderSubLeaves() {
  document.getElementById("sub-kpis").innerHTML = [
    kpiCard("white", "전체 잔여", totalSubBalance().toFixed(1), "일", "모든 직원 합산"),
    kpiCard("green", "총 부여", sumSubByType("grant").toFixed(1), "일", "누적"),
    kpiCard("red", "총 사용", sumSubByType("use").toFixed(1), "일", "누적"),
    kpiCard("primary", "이력 건수", `${state.subLeaves.length}`, "건", "전체 직원")
  ].join("");

  document.getElementById("sub-employee-tabs").innerHTML = state.employees.map((employee) => {
    const balance = subBalance(employee.id);
    return `<button class="pill ${employee.id === ui.subEmployeeId ? "active" : ""}" type="button" data-sub-emp="${employee.id}">${employee.name} (${balance.toFixed(1)}일)</button>`;
  }).join("");

  document.querySelectorAll("[data-sub-emp]").forEach((button) => {
    button.addEventListener("click", () => {
      ui.subEmployeeId = button.dataset.subEmp;
      renderSubLeaves();
    });
  });

  const employee = employeeById(ui.subEmployeeId) || currentUser();
  if (!employee) return;
  ui.subEmployeeId = employee.id;
  document.getElementById("sub-balance-label").textContent = employee.name;
  document.getElementById("sub-balance").innerHTML = `
    <div class="sub-balance">
      <div>
        <div class="sub-value">${subBalance(employee.id).toFixed(1)}일</div>
        <div class="row-desc">현재 사용 가능한 대체휴가</div>
      </div>
      <button class="btn primary small" type="button" data-action="open-subleave-modal">부여 / 사용</button>
    </div>
  `;

  const history = state.subLeaves
    .filter((item) => item.empId === employee.id)
    .sort((left, right) => right.date.localeCompare(left.date));

  document.getElementById("sub-history-count").textContent = `총 ${history.length}건`;
  document.getElementById("sub-history-body").innerHTML = history.length ? history.map(renderSubRow).join("") : emptyState("대체휴가 이력이 없습니다.");

  document.querySelectorAll("[data-sub-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteSubLeave(button.dataset.subDelete));
  });
}

function renderPermissions() {
  document.getElementById("permission-body").innerHTML = state.employees.map((employee) => {
    const grade = state.perms[employee.id]?.grade || "normal";
    return `
      <tr>
        <td>${employeeCell(employee)}</td>
        <td>
          <select class="field" data-grade-emp="${employee.id}">
            <option value="admin" ${grade === "admin" ? "selected" : ""}>관리자</option>
            <option value="normal" ${grade === "normal" ? "selected" : ""}>일반</option>
            <option value="limit" ${grade === "limit" ? "selected" : ""}>제한</option>
          </select>
        </td>
        ${["dashboard", "cal", "hist", "set", "emp", "mgr", "sub", "sync"].map((menu) => `
          <td>
            <input type="checkbox" data-menu-emp="${employee.id}" data-menu-key="${menu}" ${hasRawMenu(employee.id, menu) ? "checked" : ""}>
          </td>
        `).join("")}
      </tr>
    `;
  }).join("");

  document.querySelectorAll("[data-grade-emp]").forEach((select) => {
    select.addEventListener("change", (event) => {
      const empId = event.target.dataset.gradeEmp;
      state.perms[empId] = state.perms[empId] || { grade: "normal", menus: {} };
      state.perms[empId].grade = event.target.value;
      touchState("권한등급 수정");
      renderAll();
    });
  });

  document.querySelectorAll("[data-menu-emp]").forEach((checkbox) => {
    checkbox.addEventListener("change", (event) => {
      const empId = event.target.dataset.menuEmp;
      const key = event.target.dataset.menuKey;
      state.perms[empId] = state.perms[empId] || { grade: "normal", menus: {} };
      state.perms[empId].menus[key] = event.target.checked;
      touchState("메뉴 권한 수정");
    });
  });
}

function renderManager() {
  renderYearTabs("manager-year-tabs", ui.managerYear, (year) => {
    ui.managerYear = year;
    renderManager();
    renderDashboard();
  });

  document.getElementById("manager-body").innerHTML = state.employees.map((employee) => {
    const summary = employeeSummary(employee.id, ui.managerYear);
    const latest = latestRecord(employee.id, ui.managerYear)?.date || "없음";
    return `
      <tr>
        <td>${employeeCell(employee)}</td>
        <td>${employee.dept || "-"}</td>
        <td>${summary.total}</td>
        <td>${summary.used}</td>
        <td><strong>${summary.remain}</strong></td>
        <td>${summary.usagePercent}%</td>
        <td>${latest}</td>
        <td><button class="action-link" type="button" data-manager-open="${employee.id}">상세</button></td>
      </tr>
    `;
  }).join("");

  document.querySelectorAll("[data-manager-open]").forEach((button) => {
    button.addEventListener("click", () => {
      ui.selectedEmployeeId = button.dataset.managerOpen;
      switchView("cal");
    });
  });
}

function renderSyncPage() {
  document.getElementById("repo-owner").value = state.repo.owner;
  document.getElementById("repo-name").value = state.repo.name;
  document.getElementById("repo-branch").value = state.repo.branch;
  document.getElementById("repo-path").value = state.repo.dataPath;
  document.getElementById("github-token").value = localStorage.getItem(STORAGE_KEYS.token) || "";
  document.getElementById("auto-save-toggle").checked = !!getSyncPrefs().autoSave;
  document.getElementById("last-saved-at").textContent = lastSavedAt || "없음";
  document.getElementById("last-loaded-at").textContent = lastLoadedAt || "없음";
  document.getElementById("sync-detail-status").textContent = syncStatus.label;
  document.getElementById("sync-log").textContent = syncStatus.detail;
}

function renderSyncStatus() {
  const pill = document.getElementById("sync-pill");
  pill.className = `sync-pill ${syncStatus.tone}`;
  pill.textContent = syncStatus.label;
  document.getElementById("sync-message").textContent = syncStatus.detail;
  document.getElementById("last-saved-at").textContent = lastSavedAt || "없음";
  document.getElementById("last-loaded-at").textContent = lastLoadedAt || "없음";
  document.getElementById("sync-detail-status").textContent = syncStatus.label;
  document.getElementById("sync-log").textContent = syncStatus.detail;
}

function switchView(view) {
  if (!hasMenuAccess(currentUser()?.id, view)) return;
  ui.activeView = view;
  document.querySelectorAll(".view").forEach((section) => section.classList.remove("active"));
  document.getElementById(`view-${view}`)?.classList.add("active");
  renderNavigation();
}

function renderYearTabs(containerId, selectedYear, onClick) {
  document.getElementById(containerId).innerHTML = allYears().map((year) => `
    <button class="year-tab ${selectedYear === year ? "active" : ""}" type="button" data-year="${year}">${year}년</button>
  `).join("");
  document.getElementById(containerId).querySelectorAll("[data-year]").forEach((button) => {
    button.addEventListener("click", () => onClick(Number(button.dataset.year)));
  });
}

function renderCalendarGrid() {
  const grid = document.getElementById("calendar-grid");
  const firstDay = new Date(ui.currentYear, ui.currentMonth, 1).getDay();
  const daysInMonth = new Date(ui.currentYear, ui.currentMonth + 1, 0).getDate();
  const todayKey = formatDateKey(new Date());
  const cells = [];

  for (let index = 0; index < firstDay; index += 1) {
    cells.push(`<button class="day-cell empty" type="button" disabled></button>`);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = `${ui.currentYear}-${pad(ui.currentMonth + 1)}-${pad(day)}`;
    const records = recordsOnDate(ui.selectedEmployeeId, key);
    const holiday = HOLIDAYS[key];
    const isSubHoliday = SUBSTITUTE_HOLIDAYS.has(key);
    const isToday = key === todayKey;
    const classes = ["day-cell"];
    if (isToday) classes.push("today");
    if (holiday) classes.push("holiday");
    if (isSubHoliday) classes.push("sub");
    if (records.some((record) => record.type === "연차")) classes.push("leave");
    if (records.some((record) => record.type !== "연차")) classes.push("half");
    const tags = [];
    if (holiday) tags.push(`<span class="day-tag holiday">${holiday}</span>`);
    if (isSubHoliday) tags.push(`<span class="day-tag sub">대체휴일</span>`);
    records.forEach((record) => tags.push(`<span class="day-tag ${record.type === "연차" ? "leave" : "half"}">${record.type}</span>`));

    cells.push(`
      <button class="${classes.join(" ")}" type="button" data-date="${key}">
        <div class="day-number">${day}</div>
        ${tags.join("")}
      </button>
    `);
  }

  grid.innerHTML = cells.join("");
  grid.querySelectorAll("[data-date]").forEach((button) => {
    button.addEventListener("click", () => openRecordModal(button.dataset.date));
  });
}

function renderMonthHistory() {
  const prefix = `${ui.currentYear}-${pad(ui.currentMonth + 1)}`;
  const monthRecords = state.records
    .filter((record) => record.empId === ui.selectedEmployeeId && record.date.startsWith(prefix))
    .sort((left, right) => left.date.localeCompare(right.date));
  document.getElementById("month-history-title").textContent = `${ui.currentMonth + 1}월 기록`;
  document.getElementById("month-history-count").textContent = `${monthRecords.length}건`;
  document.getElementById("month-history-body").innerHTML = monthRecords.length ? monthRecords.map(renderRecordRow).join("") : emptyState("이번 달 기록이 없습니다.");
}

function renderRecordRow(record) {
  return `
    <div class="row-item">
      <div class="row-main">
        <div class="row-title">${record.date} · ${record.type}</div>
        <div class="row-desc">${record.memo || "메모 없음"}</div>
      </div>
      <div class="button-row">
        <span class="tag ${record.type === "연차" ? "blue" : "amber"}">${leaveDelta(record.type)}일</span>
        <button class="action-link" type="button" data-record-delete="${record.id}">삭제</button>
      </div>
    </div>
  `;
}

function renderSubRow(item) {
  return `
    <div class="row-item">
      <div class="row-main">
        <div class="row-title">${item.date} · ${item.type === "grant" ? "부여" : "사용"} ${item.days}일</div>
        <div class="row-desc">${item.memo || "메모 없음"}</div>
      </div>
      <div class="button-row">
        <span class="tag ${item.type === "grant" ? "green" : "red"}">${item.type === "grant" ? "+" : "-"}${item.days}</span>
        <button class="action-link" type="button" data-sub-delete="${item.id}">삭제</button>
      </div>
    </div>
  `;
}

function renderAlertItem(alert) {
  return `
    <div class="row-item">
      <div class="row-main">
        <div class="row-title">${alert.title}</div>
        <div class="row-desc">${alert.description}</div>
      </div>
      <span class="tag ${alert.tone}">${alert.badge}</span>
    </div>
  `;
}

function buildDepartmentSummary(summaries) {
  const map = new Map();
  summaries.forEach((item) => {
    const key = item.employee.dept || "미지정";
    const value = map.get(key) || { total: 0, used: 0, count: 0 };
    value.total += item.total;
    value.used += item.used;
    value.count += 1;
    map.set(key, value);
  });

  return Array.from(map.entries()).map(([dept, value]) => {
    const usage = value.total ? Math.round((value.used / value.total) * 100) : 0;
    return `
      <div class="row-item">
        <div class="row-main">
          <div class="row-title">${dept}</div>
          <div class="row-desc">${value.count}명 · 생성 ${value.total.toFixed(1)}일 · 사용 ${value.used.toFixed(1)}일</div>
        </div>
        <span class="tag ${usage >= 80 ? "red" : usage >= 50 ? "amber" : "green"}">${usage}%</span>
      </div>
    `;
  }).join("") || emptyState("부서 데이터가 없습니다.");
}

function buildAlerts(summaries) {
  const alerts = [];
  summaries.forEach((item) => {
    if (item.remain <= 0) {
      alerts.push({
        title: `${item.employee.name} · 잔여 연차 없음`,
        description: `${item.employee.dept || "부서 미지정"} · 잔여 연차가 0일 이하입니다.`,
        badge: "긴급",
        tone: "red"
      });
    } else if (item.expiryRisk) {
      alerts.push({
        title: `${item.employee.name} · 연차 소멸 위험`,
        description: `${item.remain}일 남아 있어 ${state.settings.warningMonth}월 이후 소멸 위험으로 분류했습니다.`,
        badge: "주의",
        tone: "amber"
      });
    }

    if (item.promotionNeeded) {
      alerts.push({
        title: `${item.employee.name} · 촉진 검토 필요`,
        description: `사용률 ${item.usagePercent}% / 잔여 ${item.remain}일로 촉진 대상 기준을 충족했습니다.`,
        badge: "촉진",
        tone: "purple"
      });
    }
  });
  return alerts.sort((left, right) => {
    const order = { red: 0, amber: 1, purple: 2, green: 3 };
    return order[left.tone] - order[right.tone];
  });
}

function employeeSummary(empId, year) {
  const employee = employeeById(empId);
  const records = state.records.filter((record) => record.empId === empId && record.date.startsWith(String(year)));
  const used = round(records.reduce((sum, record) => sum + leaveDelta(record.type), 0));
  const total = getTotal(empId, year);
  const remain = round(total - used);
  const usagePercent = total ? Math.min(999, Math.round((used / total) * 100)) : 0;
  const halfCount = records.filter((record) => record.type !== "연차").length;
  const currentMonth = new Date().getMonth() + 1;
  const expiryRisk = currentMonth >= state.settings.warningMonth && remain > state.settings.expiryRiskDays;
  const promotionNeeded = currentMonth >= state.settings.warningMonth && remain >= state.settings.promotionMinDays && usagePercent <= state.settings.promotionMaxUsagePercent;
  const alertLevel = remain <= 0 ? "urgent" : expiryRisk ? "warning" : "safe";
  const alertLabel = remain <= 0 ? "소진 완료" : expiryRisk ? "소멸 주의" : "안정";
  return { employee, total, used, remain, usagePercent, halfCount, expiryRisk, promotionNeeded, alertLevel, alertLabel };
}

function moveMonth(diff) {
  const date = new Date(ui.currentYear, ui.currentMonth + diff, 1);
  ui.currentYear = date.getFullYear();
  ui.currentMonth = date.getMonth();
  renderCalendarView();
  renderHistory();
}

function openRecordModal(date = "") {
  const options = state.employees.map((employee) => `<option value="${employee.id}" ${employee.id === ui.selectedEmployeeId ? "selected" : ""}>${employee.name}</option>`).join("");
  openModal("휴가 기록 추가", "연차와 반차를 기록하면 자동저장됩니다.", `
    <label class="field-label">직원</label>
    <select id="record-emp" class="field">${options}</select>
    <label class="field-label">날짜</label>
    <input id="record-date" class="field" type="date" value="${date}">
    <label class="field-label">유형</label>
    <select id="record-type" class="field">
      <option value="연차">연차</option>
      <option value="반차-오전">반차-오전</option>
      <option value="반차-오후">반차-오후</option>
      <option value="반반차-오전">반반차-오전</option>
      <option value="반반차-오후">반반차-오후</option>
    </select>
    <label class="field-label">메모</label>
    <textarea id="record-memo" class="field" rows="3" placeholder="메모를 남겨두면 대시보드에서 참고하기 좋습니다."></textarea>
    <div class="button-row">
      <button class="btn ghost" type="button" data-action="close-modal">취소</button>
      <button class="btn primary" type="button" id="record-save-btn">저장</button>
    </div>
  `);
  document.getElementById("record-save-btn").addEventListener("click", saveRecordFromModal);
}

function saveRecordFromModal() {
  const empId = document.getElementById("record-emp").value;
  const date = document.getElementById("record-date").value;
  const type = document.getElementById("record-type").value;
  const memo = document.getElementById("record-memo").value.trim();
  if (!date) {
    alert("날짜를 선택해 주세요.");
    return;
  }
  if (state.records.some((record) => record.empId === empId && record.date === date && record.type === type)) {
    alert("같은 날짜와 유형의 기록이 이미 있습니다.");
    return;
  }
  state.records.push({ id: `r${Date.now()}`, empId, date, type, memo });
  ui.selectedEmployeeId = empId;
  const parts = date.split("-");
  ui.currentYear = Number(parts[0]);
  ui.currentMonth = Number(parts[1]) - 1;
  touchState("휴가 기록 추가");
  closeModal();
  renderAll();
}

function openEmployeeModal(empId = "") {
  const employee = employeeById(empId);
  const colorChoices = COLORS.map((color) => `
    <button type="button" class="action-link" data-color-pick="${color}" style="background:${color};color:#fff;border:none">${color === (employee?.color || COLORS[0]) ? "선택됨" : "색상"}</button>
  `).join("");
  openModal(employee ? "직원 정보 수정" : "직원 추가", "직원 기본 정보를 입력합니다.", `
    <input id="employee-id" type="hidden" value="${employee?.id || ""}">
    <label class="field-label">이름</label>
    <input id="employee-name" class="field" type="text" value="${employee?.name || ""}">
    <label class="field-label">부서</label>
    <input id="employee-dept" class="field" type="text" value="${employee?.dept || ""}">
    <label class="field-label">직책</label>
    <input id="employee-role" class="field" type="text" value="${employee?.role || ""}">
    <label class="field-label">입사일</label>
    <input id="employee-join" class="field" type="date" value="${employee?.joinDate || ""}">
    <label class="field-label">대표색상</label>
    <input id="employee-color" class="field" type="text" value="${employee?.color || COLORS[0]}">
    <div class="button-row">${colorChoices}</div>
    <div class="button-row">
      <button class="btn ghost" type="button" data-action="close-modal">취소</button>
      <button class="btn primary" type="button" id="employee-save-btn">저장</button>
    </div>
  `);
  document.querySelectorAll("[data-color-pick]").forEach((button) => {
    button.addEventListener("click", () => {
      document.getElementById("employee-color").value = button.dataset.colorPick;
    });
  });
  document.getElementById("employee-save-btn").addEventListener("click", saveEmployeeFromModal);
}

function saveEmployeeFromModal() {
  const empId = document.getElementById("employee-id").value;
  const name = document.getElementById("employee-name").value.trim();
  const dept = document.getElementById("employee-dept").value.trim();
  const role = document.getElementById("employee-role").value.trim();
  const joinDate = document.getElementById("employee-join").value;
  const color = document.getElementById("employee-color").value.trim() || COLORS[0];
  if (!name) {
    alert("이름을 입력해 주세요.");
    return;
  }

  if (empId) {
    const employee = employeeById(empId);
    Object.assign(employee, { name, dept, role, joinDate, color });
  } else {
    const newId = `e${Date.now()}`;
    state.employees.push({ id: newId, name, dept, role, joinDate, color });
    state.perms[newId] = { grade: "normal", menus: {} };
    ui.selectedEmployeeId = newId;
  }
  touchState(empId ? "직원 정보 수정" : "직원 추가");
  closeModal();
  renderAll();
}

function openSubLeaveModal() {
  const options = state.employees.map((employee) => `<option value="${employee.id}" ${employee.id === ui.subEmployeeId ? "selected" : ""}>${employee.name}</option>`).join("");
  openModal("대체휴가 부여 / 사용", "부여 또는 사용 이력을 저장하면 전체 대시보드에도 즉시 반영됩니다.", `
    <label class="field-label">직원</label>
    <select id="sub-emp" class="field">${options}</select>
    <label class="field-label">유형</label>
    <select id="sub-type" class="field">
      <option value="grant">부여</option>
      <option value="use">사용</option>
    </select>
    <label class="field-label">일수</label>
    <input id="sub-days" class="field" type="number" min="0.5" step="0.5" value="1">
    <label class="field-label">날짜</label>
    <input id="sub-date" class="field" type="date" value="${formatDateKey(new Date())}">
    <label class="field-label">메모</label>
    <textarea id="sub-memo" class="field" rows="3"></textarea>
    <div class="button-row">
      <button class="btn ghost" type="button" data-action="close-modal">취소</button>
      <button class="btn primary" type="button" id="sub-save-btn">저장</button>
    </div>
  `);
  document.getElementById("sub-save-btn").addEventListener("click", saveSubLeaveFromModal);
}

function saveSubLeaveFromModal() {
  const empId = document.getElementById("sub-emp").value;
  const type = document.getElementById("sub-type").value;
  const days = Number(document.getElementById("sub-days").value);
  const date = document.getElementById("sub-date").value;
  const memo = document.getElementById("sub-memo").value.trim();
  if (!date || !days) {
    alert("날짜와 일수를 확인해 주세요.");
    return;
  }
  if (type === "use" && subBalance(empId) < days && !window.confirm(`잔여 대체휴가(${subBalance(empId)}일)보다 많이 사용합니다. 계속할까요?`)) {
    return;
  }
  state.subLeaves.push({ id: `s${Date.now()}`, empId, type, days, date, memo });
  ui.subEmployeeId = empId;
  touchState("대체휴가 저장");
  closeModal();
  renderAll();
}

function openModal(title, subtitle, body) {
  document.getElementById("modal-title").textContent = title;
  document.getElementById("modal-subtitle").textContent = subtitle;
  document.getElementById("modal-body").innerHTML = body;
  document.getElementById("modal-overlay").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modal-overlay").classList.add("hidden");
}

function deleteEmployee(empId) {
  const employee = employeeById(empId);
  if (!employee) return;
  if (!window.confirm(`${employee.name} 직원을 삭제할까요? 관련 기록도 함께 삭제됩니다.`)) return;
  state.employees = state.employees.filter((item) => item.id !== empId);
  state.records = state.records.filter((item) => item.empId !== empId);
  state.subLeaves = state.subLeaves.filter((item) => item.empId !== empId);
  delete state.perms[empId];
  initializeSelections();
  touchState("직원 삭제");
  renderAll();
}

function deleteRecord(recordId) {
  if (!window.confirm("이 기록을 삭제할까요?")) return;
  state.records = state.records.filter((record) => record.id !== recordId);
  touchState("휴가 기록 삭제");
  renderAll();
}

function deleteSubLeave(subId) {
  if (!window.confirm("이 대체휴가 이력을 삭제할까요?")) return;
  state.subLeaves = state.subLeaves.filter((item) => item.id !== subId);
  touchState("대체휴가 이력 삭제");
  renderAll();
}

document.body.addEventListener("click", (event) => {
  const recordDelete = event.target.closest("[data-record-delete]");
  if (recordDelete) deleteRecord(recordDelete.dataset.recordDelete);
});

function addSettingYear() {
  const nextYear = Math.max(...allYears()) + 1;
  const key = `${ui.settingsEmployeeId}_${nextYear}`;
  state.totals[key] = accrual(employeeById(ui.settingsEmployeeId)?.joinDate, nextYear);
  touchState("연도 추가");
  renderSettings();
}

function touchState(message) {
  state.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify(state));
  const prefs = getSyncPrefs();
  if (prefs.autoSave) {
    scheduleSharedSave(message);
  } else {
    setSyncStatus("idle", "초안", `${message} 완료 · 자동저장이 꺼져 있습니다.`);
  }
}

function scheduleSharedSave(message) {
  setSyncStatus("saving", "저장중", `${message} 반영 중...`);
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveSharedData(message);
  }, 900);
}

async function saveSharedNow() {
  await saveSharedData("수동 저장");
}

async function saveSharedData(message) {
  const token = localStorage.getItem(STORAGE_KEYS.token);
  if (!token) {
    setSyncStatus("error", "토큰없음", `${message} 완료. 공유 JSON에 저장하려면 관리자 토큰을 설정해 주세요.`);
    return;
  }

  if (saveInFlight) {
    saveQueued = true;
    return;
  }

  saveInFlight = true;
  try {
    if (!githubSha) {
      await refreshGithubSha();
    }
    const content = btoa(unescape(encodeURIComponent(`${JSON.stringify(state, null, 2)}\n`)));
    const response = await fetch(githubApiUrl(state.repo.owner, state.repo.name, state.repo.dataPath), {
      method: "PUT",
      headers: githubHeaders(true),
      body: JSON.stringify({
        message: `chore: update shared vacation data (${message})`,
        content,
        sha: githubSha || undefined,
        branch: state.repo.branch
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.message || `GitHub 저장 실패 (${response.status})`);
    }

    const payload = await response.json();
    githubSha = payload.content?.sha || githubSha;
    lastSavedAt = formatDateTime(new Date());
    setSyncStatus("success", "저장됨", `${message} 완료 · GitHub 공유 JSON이 업데이트되었습니다.`);
  } catch (error) {
    setSyncStatus("error", "실패", error.message);
  } finally {
    saveInFlight = false;
    if (saveQueued) {
      saveQueued = false;
      saveSharedData("연속 변경");
    }
    renderSyncStatus();
  }
}

async function reloadFromRemote() {
  try {
    const response = await fetch(`./data/app-data.json?ts=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`공유 데이터 다시 읽기 실패 (${response.status})`);
    state = await response.json();
    normalizeState();
    initializeSelections();
    lastLoadedAt = formatDateTime(new Date());
    setSyncStatus("success", "새로고침", "GitHub Pages에 배포된 공유 데이터를 다시 읽었습니다.");
    renderAll();
  } catch (error) {
    setSyncStatus("error", "실패", error.message);
    renderSyncStatus();
  }
}

function updateRepoFields() {
  state.repo.owner = document.getElementById("repo-owner").value.trim() || state.repo.owner;
  state.repo.name = document.getElementById("repo-name").value.trim() || state.repo.name;
  state.repo.branch = document.getElementById("repo-branch").value.trim() || state.repo.branch;
  state.repo.dataPath = document.getElementById("repo-path").value.trim() || state.repo.dataPath;
  touchState("저장소 설정 변경");
  refreshGithubSha();
}

function hydrateSyncForm() {
  const prefs = getSyncPrefs();
  document.getElementById("auto-save-toggle").checked = !!prefs.autoSave;
}

function getSyncPrefs() {
  return readJsonStorage(STORAGE_KEYS.syncPrefs) || { autoSave: true };
}

function saveSyncPrefs(prefs) {
  localStorage.setItem(STORAGE_KEYS.syncPrefs, JSON.stringify(prefs));
}

function saveToken() {
  const token = document.getElementById("github-token").value.trim();
  if (!token) {
    alert("토큰을 입력해 주세요.");
    return;
  }
  localStorage.setItem(STORAGE_KEYS.token, token);
  setSyncStatus("success", "토큰저장", "관리자 토큰을 이 브라우저에 저장했습니다.");
  renderSyncStatus();
}

function clearToken() {
  localStorage.removeItem(STORAGE_KEYS.token);
  document.getElementById("github-token").value = "";
  setSyncStatus("idle", "토큰삭제", "이 브라우저에서 관리자 토큰을 제거했습니다.");
  renderSyncStatus();
}

function currentUser() {
  return employeeById(ui.selectedEmployeeId) || state.employees[0] || null;
}

function employeeById(empId) {
  return state.employees.find((employee) => employee.id === empId);
}

function recordsOnDate(empId, date) {
  return state.records.filter((record) => record.empId === empId && record.date === date);
}

function latestRecord(empId, year) {
  return state.records
    .filter((record) => record.empId === empId && record.date.startsWith(String(year)))
    .sort((left, right) => right.date.localeCompare(left.date))[0];
}

function accrual(joinDate, year) {
  if (!joinDate) return 15;
  const join = new Date(joinDate);
  const ref = new Date(year, 0, 1);
  if (ref < join) return 0;
  const years = Math.floor((ref - join) / (1000 * 60 * 60 * 24 * 365.25));
  if (years < 1) {
    return Math.min(Math.floor((ref - join) / (1000 * 60 * 60 * 24 * 30.44)), 11);
  }
  if (years <= 2) return 15;
  return Math.min(15 + Math.floor((years - 1) / 2), 25);
}

function getTotal(empId, year) {
  const key = `${empId}_${year}`;
  if (state.totals[key] !== undefined) return Number(state.totals[key]);
  return accrual(employeeById(empId)?.joinDate, year);
}

function leaveDelta(type) {
  if (type === "연차") return 1;
  if (type.startsWith("반반차")) return 0.25;
  return 0.5;
}

function allYears() {
  const years = new Set([new Date().getFullYear(), ui.currentYear, ui.managerYear]);
  state.records.forEach((record) => years.add(Number(record.date.slice(0, 4))));
  Object.keys(state.totals).forEach((key) => years.add(Number(key.split("_")[1])));
  return Array.from(years).sort((left, right) => left - right);
}

function monthHolidayCount(year, month) {
  const prefix = `${year}-${pad(month + 1)}`;
  return Object.keys(HOLIDAYS).filter((key) => key.startsWith(prefix)).length;
}

function subBalance(empId) {
  return round(state.subLeaves
    .filter((item) => item.empId === empId)
    .reduce((sum, item) => sum + (item.type === "grant" ? item.days : -item.days), 0));
}

function totalSubBalance() {
  return state.employees.reduce((sum, employee) => sum + subBalance(employee.id), 0);
}

function sumSubByType(type) {
  return state.subLeaves
    .filter((item) => item.type === type)
    .reduce((sum, item) => sum + item.days, 0);
}

function hasRawMenu(empId, menuKey) {
  const perm = state.perms[empId];
  if (!perm || !perm.menus || perm.menus[menuKey] === undefined) return true;
  return !!perm.menus[menuKey];
}

function hasMenuAccess(empId, menuKey) {
  const perm = state.perms[empId];
  if (!perm) return true;
  if (perm.grade === "admin") return true;
  if (perm.grade === "limit") return ["dashboard", "cal", "hist"].includes(menuKey);
  return hasRawMenu(empId, menuKey);
}

function employeeCell(employee) {
  return `
    <div style="display:flex;align-items:center;gap:10px;">
      <div class="avatar" style="background:${employee.color};width:34px;height:34px;border-radius:12px;">${employee.name.slice(0, 2)}</div>
      <div>
        <div style="font-weight:700;">${employee.name}</div>
        <div class="row-desc">${employee.role || ""}</div>
      </div>
    </div>
  `;
}

function kpiCard(tone, label, value, unit, help) {
  return `
    <div class="kpi-card ${tone}">
      <div class="kpi-label">${label}</div>
      <div class="kpi-value">${value}<small>${unit}</small></div>
      <div class="kpi-help">${help}</div>
    </div>
  `;
}

function emptyState(message) {
  return `<div class="empty-state">${message}</div>`;
}

function pad(number) {
  return String(number).padStart(2, "0");
}

function round(number) {
  return Math.round(number * 100) / 100;
}

function formatDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDateTime(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function githubApiUrl(owner, repo, path, branch = "") {
  const url = new URL(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`);
  if (branch) url.searchParams.set("ref", branch);
  return url.toString();
}

function githubHeaders(includeWrite) {
  const headers = {
    "Accept": "application/vnd.github+json"
  };
  const token = localStorage.getItem(STORAGE_KEYS.token);
  if (includeWrite && token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function setSyncStatus(tone, label, detail) {
  syncStatus = { tone, label, detail };
}

function readJsonStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (_error) {
    return null;
  }
}
