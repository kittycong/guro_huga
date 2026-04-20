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
  syncPrefs: "guro_huga_sync_prefs",
  adminPw: "guro_huga_admin_pw_v1",
  archive: "guro_huga_archive_v1"
};

const MENU_DEFS = [
  { key: "dashboard", label: "대시보드" },
  { key: "leave", label: "휴가 통합" },
  { key: "cal", label: "달력 보기" },
  { key: "hist", label: "사용 내역" },
  { key: "set", label: "연차 설정" },
  { key: "emp", label: "직원 목록" },
  { key: "mgr", label: "전체 현황" },
  { key: "sub", label: "대체휴가" },
  { key: "spe", label: "특별휴가" },
  { key: "office", label: "사무실 현황" },
  { key: "hr", label: "인사정보 등록" },
  { key: "payroll", label: "인사·급여관리" },
  { key: "datahub", label: "데이터 허브" },
  { key: "erp", label: "ERP 구조" },
  { key: "perm", label: "권한 관리" },
  { key: "sync", label: "공유 저장" }
];

const ui = {
  activeView: "dashboard",
  currentYear: new Date().getFullYear(),
  currentMonth: new Date().getMonth(),
  managerYear: new Date().getFullYear(),
  hrYear: new Date().getFullYear(),
  selectedEmployeeId: "",
  settingsEmployeeId: "",
  subEmployeeId: "",
  specialEmployeeId: "",
  wageCalcEmployeeId: "",
  leaveTab: "overview",
  orgEditId: "",
  collapsedCards: {},
  histFilter: { month: "", type: "", search: "" },
  empFilter: { search: "", dept: "", risk: "all", viewMode: "card" },
  officeFilter: { dept: "", role: "", balance: "all" },
  hrFilter: { search: "", status: "" },
  managerFilter: { search: "", dept: "", risk: "all", usageMin: "", usageMax: "", remainMin: "", sort: "name" },
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
    promotionMaxUsagePercent: 40,
    opsMemo: "",
    welfareStandard: defaultWelfareStandard(),
    payGradeTable: defaultSeoulPayGradeTable2026(),
    hometaxRate: 0,
    localTaxRate: 10,
    simpleTaxTable: [],
    simpleTaxMeta: defaultSimpleTaxMeta(),
    allowanceRules: defaultAllowanceRules(),
    birthdayRule: defaultBirthdayRule(),
    activeLaborRuleYear: 2026,
    laborRuleCache: {}
  },
  employees: [],
  records: [],
  totals: {},
  subLeaves: [],
  specialLeaves: [],
  hrRecords: {},
  orgUnits: [],
  auditLogs: [],
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
    const actionElement = event.target.closest("[data-action]");
    const action = actionElement?.dataset.action;
    if (!action) return;

    if (action === "open-record-modal") openRecordModal();
    if (action === "open-employee-modal") openEmployeeModal();
    if (action === "open-subleave-modal") openSubLeaveModal();
    if (action === "open-bulk-subleave-modal") openBulkSubLeaveModal();
    if (action === "open-specialleave-modal") openSpecialLeaveModal();
    if (action === "open-settings-view") switchView("set");
    if (action === "close-modal") closeModal();
    if (action === "prev-month") moveMonth(-1);
    if (action === "next-month") moveMonth(1);
    if (action === "add-setting-year") addSettingYear();
    if (action === "save-settings") saveSettingsFromView();
    if (action === "reset-settings") renderSettings();
    if (action === "save-token") saveToken();
    if (action === "clear-token") clearToken();
    if (action === "save-admin-password") saveAdminPassword();
    if (action === "clear-admin-password") clearAdminPassword();
    if (action === "save-ops-memo") saveOpsMemo();
    if (action === "download-backup") downloadBackup();
    if (action === "import-backup") document.getElementById("backup-import-hidden").click();
    if (action === "export-excel") exportExcelSnapshot();
    if (action === "import-excel") document.getElementById("excel-import-input").click();
    if (action === "export-hr-excel") exportHrExcel();
    if (action === "import-hr-excel") document.getElementById("hr-excel-import-input").click();
    if (action === "import-pay-grade-excel") document.getElementById("pay-grade-import-input").click();
    if (action === "import-tax-table-excel") document.getElementById("tax-table-import-input").click();
    if (action === "save-hr-info") saveHrInfoFromView();
    if (action === "save-payroll-info") savePayrollInfoFromView();
    if (action === "apply-welfare-template") applyWelfareTemplate();
    if (action === "save-welfare-template") saveWelfareTemplate();
    if (action === "add-pay-grade-row") addPayGradeRow();
    if (action === "save-pay-grade-table") savePayGradeTable();
    if (action === "apply-seoul-pay-template") applySeoulPayTemplate();
    if (action === "export-category-excel") exportCategoryExcel();
    if (action === "import-category-excel") document.getElementById("category-excel-import-input").click();
    if (action === "download-current-snapshot") downloadCurrentSnapshot();
    if (action === "restore-last-snapshot") restoreLastSnapshot();
    if (action === "save-birthday-rule") saveBirthdayRule();
    if (action === "run-birthday-grant") runBirthdayHalfDayGrant();
    if (action === "load-labor-rule") await loadLaborRule();
    if (action === "activate-labor-rule") activateLaborRuleYear();
    if (action === "save-now") await saveSharedNow();
    if (action === "reload-shared" || action === "refresh-remote") await reloadFromRemote();
    if (action === "open-erp-menu") switchView(actionElement.dataset.view || "dashboard");
    if (action === "save-org-unit") saveOrgUnit();
    if (action === "reset-org-unit-form") resetOrgUnitForm();
    if (action === "auto-build-org") autoBuildOrgUnits();
    if (action === "edit-org-unit") editOrgUnit(actionElement.dataset.orgUnitId);
    if (action === "delete-org-unit") deleteOrgUnit(actionElement.dataset.orgUnitId);
    if (action === "toggle-erp-module") toggleErpModule(actionElement.dataset.erpModuleId);
    if (action === "switch-leave-tab") switchLeaveTab(actionElement.dataset.leaveTab || "overview");
    if (action === "run-wage-calculator") runWageCalculator();
    if (action === "toggle-card-collapse") toggleCardCollapse(actionElement.dataset.cardKey);
  });

  document.getElementById("emp-sel").addEventListener("change", (event) => {
    ui.selectedEmployeeId = event.target.value;
    renderAll();
  });

  document.getElementById("set-emp-sel").addEventListener("change", (event) => {
    ui.settingsEmployeeId = event.target.value;
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

  document.getElementById("excel-import-input").addEventListener("change", importExcelSnapshot);
  document.getElementById("hr-excel-import-input").addEventListener("change", importHrExcel);
  document.getElementById("category-excel-import-input").addEventListener("change", importCategoryExcel);
  document.getElementById("pay-grade-import-input").addEventListener("change", importPayGradeExcel);
  document.getElementById("tax-table-import-input").addEventListener("change", importSimpleTaxTableExcel);
  document.getElementById("backup-import-hidden").addEventListener("change", importBackupSnapshot);
  document.getElementById("wage-calc-emp").addEventListener("change", (event) => {
    ui.wageCalcEmployeeId = event.target.value;
    loadWageCalcFromEmployee();
  });
  document.getElementById("manager-search").addEventListener("input", (event) => {
    ui.managerFilter.search = event.target.value.trim().toLowerCase();
    renderManager();
  });
  document.getElementById("manager-dept").addEventListener("input", (event) => {
    ui.managerFilter.dept = event.target.value.trim().toLowerCase();
    renderManager();
  });
  document.getElementById("manager-risk").addEventListener("change", (event) => {
    ui.managerFilter.risk = event.target.value;
    renderManager();
  });
  document.getElementById("manager-usage-min").addEventListener("input", (event) => {
    ui.managerFilter.usageMin = event.target.value;
    renderManager();
  });
  document.getElementById("manager-usage-max").addEventListener("input", (event) => {
    ui.managerFilter.usageMax = event.target.value;
    renderManager();
  });
  document.getElementById("manager-remain-min").addEventListener("input", (event) => {
    ui.managerFilter.remainMin = event.target.value;
    renderManager();
  });
  document.getElementById("manager-sort").addEventListener("change", (event) => {
    ui.managerFilter.sort = event.target.value;
    renderManager();
  });
  document.getElementById("hist-month").addEventListener("change", (event) => {
    ui.histFilter.month = event.target.value;
    renderHistory();
  });
  document.getElementById("hist-type").addEventListener("change", (event) => {
    ui.histFilter.type = event.target.value;
    renderHistory();
  });
  document.getElementById("hist-search").addEventListener("input", (event) => {
    ui.histFilter.search = event.target.value.trim().toLowerCase();
    renderHistory();
  });
  document.getElementById("emp-search").addEventListener("input", (event) => {
    ui.empFilter.search = event.target.value.trim().toLowerCase();
    renderEmployees();
  });
  document.getElementById("emp-dept").addEventListener("input", (event) => {
    ui.empFilter.dept = event.target.value.trim().toLowerCase();
    renderEmployees();
  });
  document.getElementById("emp-risk").addEventListener("change", (event) => {
    ui.empFilter.risk = event.target.value;
    renderEmployees();
  });
  document.getElementById("emp-view-mode").addEventListener("change", (event) => {
    ui.empFilter.viewMode = event.target.value;
    renderEmployees();
  });
  document.getElementById("sub-employee-search").addEventListener("input", () => renderSubLeaves());
  document.getElementById("office-dept-filter").addEventListener("input", (event) => {
    ui.officeFilter.dept = event.target.value.trim().toLowerCase();
    renderOfficeView();
  });
  document.getElementById("office-role-filter").addEventListener("input", (event) => {
    ui.officeFilter.role = event.target.value.trim().toLowerCase();
    renderOfficeView();
  });
  document.getElementById("office-balance-filter").addEventListener("change", (event) => {
    ui.officeFilter.balance = event.target.value;
    renderOfficeView();
  });
  document.getElementById("hr-search").addEventListener("input", (event) => {
    ui.hrFilter.search = event.target.value.trim().toLowerCase();
    renderHrView();
  });
  document.getElementById("hr-status-filter").addEventListener("change", (event) => {
    ui.hrFilter.status = event.target.value.trim().toLowerCase();
    renderHrView();
  });
  document.getElementById("category-select").addEventListener("change", renderDataHub);

  document.body.addEventListener("change", (event) => {
    const moduleId = event.target.dataset.erpModuleId;
    if (!moduleId) return;
    const moduleState = getErpModuleState(moduleId);
    if (event.target.dataset.erpOwner !== undefined) moduleState.ownerId = event.target.value;
    if (event.target.dataset.erpDue !== undefined) moduleState.dueDate = event.target.value;
    if (event.target.dataset.erpStatus !== undefined) moduleState.status = event.target.value;
    if (event.target.dataset.erpNote !== undefined) moduleState.note = event.target.value.trim();
    touchState(`ERP 모듈 설정 변경 (${moduleId})`);
    renderErpView();
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
    promotionMaxUsagePercent: 40,
    opsMemo: "",
    welfareStandard: defaultWelfareStandard(),
    payGradeTable: defaultSeoulPayGradeTable2026(),
    hometaxRate: 0,
    localTaxRate: 10,
    simpleTaxTable: [],
    simpleTaxMeta: defaultSimpleTaxMeta(),
    allowanceRules: defaultAllowanceRules(),
    birthdayRule: defaultBirthdayRule(),
    activeLaborRuleYear: 2026,
    laborRuleCache: {},
    erpModuleState: {},
    monthlyStandardHours: 209,
    defaultWorkHoursPerDay: 8,
    employmentRules: defaultEmploymentRules()
  }, state.settings || {});
  state.settings.simpleTaxMeta = normalizeSimpleTaxMeta(state.settings.simpleTaxMeta);
  state.employees = Array.isArray(state.employees) ? state.employees : [];
  state.records = Array.isArray(state.records) ? state.records : [];
  state.subLeaves = Array.isArray(state.subLeaves) ? state.subLeaves : [];
  state.specialLeaves = Array.isArray(state.specialLeaves) ? state.specialLeaves : [];
  state.hrRecords = state.hrRecords || {};
  state.orgUnits = Array.isArray(state.orgUnits) ? state.orgUnits : [];
  state.auditLogs = Array.isArray(state.auditLogs) ? state.auditLogs : [];
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
    employee.photo = employee.photo || "";
    employee.birthDate = employee.birthDate || "";
    employee.personalInfo = employee.personalInfo || "";
    employee.fiscalYearMonth = Number(employee.fiscalYearMonth || 1);
    employee.resignationDate = employee.resignationDate || "";
    employee.monthlyBasePay = Number(employee.monthlyBasePay || 0);
    employee.workHoursPerDay = Number(employee.workHoursPerDay || state.settings.defaultWorkHoursPerDay || 8);
    employee.leaveUnitPrice = Number(employee.leaveUnitPrice || 0);
    employee.averageDailyWage = Number(employee.averageDailyWage || 0);
    if (!state.perms[employee.id]) {
      state.perms[employee.id] = {
        grade: index === 0 ? "admin" : "normal",
        menus: {}
      };
    }
  });

  if (!state.orgUnits.length) {
    const depts = [...new Set(state.employees.map((employee) => employee.dept).filter(Boolean))];
    state.orgUnits = depts.map((dept, index) => ({
      id: `org_${index + 1}`,
      name: dept,
      parentId: "",
      leaderId: "",
      note: "직원 목록 기준 자동 생성"
    }));
  }
}

function initializeSelections() {
  const firstId = state.employees[0]?.id || "";
  ui.selectedEmployeeId = ui.selectedEmployeeId || firstId;
  ui.settingsEmployeeId = ui.settingsEmployeeId || ui.selectedEmployeeId;
  ui.subEmployeeId = ui.subEmployeeId || ui.selectedEmployeeId;
  ui.specialEmployeeId = ui.specialEmployeeId || ui.selectedEmployeeId;
  ui.wageCalcEmployeeId = ui.wageCalcEmployeeId || ui.selectedEmployeeId;
  ui.currentYear = ui.currentYear || new Date().getFullYear();
  ui.managerYear = ui.managerYear || ui.currentYear;
  ui.hrYear = ui.hrYear || ui.currentYear;
}

function renderAll() {
  renderNavigation();
  renderSidebar();
  renderActiveView();
  renderSyncStatus();
}

function renderActiveView() {
  const viewRenderers = {
    dashboard: renderDashboard,
    leave: renderLeaveHub,
    cal: renderCalendarView,
    hist: renderHistory,
    set: renderSettings,
    emp: renderEmployees,
    mgr: renderManager,
    sub: renderSubLeaves,
    spe: renderSpecialLeaves,
    office: renderOfficeView,
    hr: renderHrView,
    payroll: renderPayrollCenter,
    datahub: renderDataHub,
    erp: renderErpView,
    perm: renderPermissions,
    sync: renderSyncPage
  };
  const renderer = viewRenderers[ui.activeView] || renderDashboard;
  renderer();
  initCollapsibleCards();
}

function initCollapsibleCards() {
  const scope = document.getElementById(`view-${ui.activeView}`);
  if (!scope) return;
  scope.querySelectorAll(".card").forEach((card, index) => {
    const title = card.querySelector(".card-title")?.textContent?.trim() || `card-${index}`;
    const key = `${ui.activeView}:${title}`;
    card.dataset.cardKey = key;
    if (!card.querySelector("[data-action='toggle-card-collapse']")) {
      const head = card.querySelector(".card-head");
      if (!head) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn ghost small card-collapse-btn";
      button.dataset.action = "toggle-card-collapse";
      button.dataset.cardKey = key;
      head.appendChild(button);
    }
    if (ui.collapsedCards[key] === undefined && title.includes("템플릿")) ui.collapsedCards[key] = true;
    applyCardCollapse(card, !!ui.collapsedCards[key]);
  });
}

function toggleCardCollapse(cardKey) {
  if (!cardKey) return;
  ui.collapsedCards[cardKey] = !ui.collapsedCards[cardKey];
  const card = document.querySelector(`.card[data-card-key="${cardKey}"]`);
  if (!card) return;
  applyCardCollapse(card, ui.collapsedCards[cardKey]);
}

function applyCardCollapse(card, collapsed) {
  card.classList.toggle("collapsed", collapsed);
  card.querySelectorAll(":scope > :not(.card-head)").forEach((node) => {
    node.style.display = collapsed ? "none" : "";
  });
  const btn = card.querySelector("[data-action='toggle-card-collapse']");
  if (btn) btn.textContent = collapsed ? "펼치기" : "접기";
}

function renderNavigation() {
  const container = document.getElementById("nav-list");
  const current = currentUser();
  const grouped = [
    { label: "개인", keys: ["cal", "hist"] },
    { label: "운영", keys: ["dashboard", "mgr", "emp", "office"] },
    { label: "휴가관리", keys: ["leave", "set", "sub", "spe"] },
    { label: "인사관리", keys: ["hr", "payroll", "perm"] },
    { label: "시스템", keys: ["sync", "datahub", "erp"] }
  ];
  const menuMap = new Map(MENU_DEFS.map((menu) => [menu.key, menu]));
  container.innerHTML = grouped.map((group) => {
    const buttons = group.keys
      .map((key) => menuMap.get(key))
      .filter((menu) => menu && hasMenuAccess(current?.id, menu.key))
      .map((menu) => {
        const active = ui.activeView === menu.key ? " active" : "";
        return `<button class="nav-btn${active}" type="button" data-view="${menu.key}">${menu.label}<span>›</span></button>`;
      })
      .join("");
    if (!buttons) return "";
    return `<div class="nav-section"><div class="nav-label">${group.label}</div>${buttons}</div>`;
  }).join("");

  container.querySelectorAll(".nav-btn").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });
}

function renderSidebar() {
  const selected = currentUser();
  document.getElementById("emp-sel").innerHTML = state.employees
    .map((employee) => `<option value="${employee.id}" ${employee.id === ui.selectedEmployeeId ? "selected" : ""}>${employee.name}</option>`)
    .join("");

  const avatar = document.getElementById("sb-avatar");
  avatar.style.background = selected?.color || COLORS[0];
  avatar.innerHTML = avatarContent(selected);
  document.getElementById("sb-name").textContent = selected?.name || "";
  document.getElementById("sb-meta").textContent = [selected?.dept, selected?.role].filter(Boolean).join(" · ");
}

function renderDashboard() {
  const year = ui.managerYear;
  document.getElementById("dashboard-year-label").textContent = `${year}년 기준`;

  const summaries = state.employees.map((employee) => employeeSummary(employee.id, year));
  const totalRemain = summaries.reduce((sum, item) => sum + item.remain, 0);
  const avgUsage = summaries.length ? Math.round(summaries.reduce((sum, item) => sum + item.usagePercent, 0) / summaries.length) : 0;
  const peopleAtRisk = summaries.filter((item) => item.alertLevel === "urgent" || item.alertLevel === "warning").length;
  const promotionTargets = summaries.filter((item) => item.promotionNeeded).length;
  document.getElementById("dashboard-kpis").innerHTML = [
    kpiCard("primary", "전체 직원 수", `${state.employees.length}`, "명", "운영 대상"),
    kpiCard("blue", "평균 사용률", `${avgUsage}`, "%", "연차 기준"),
    kpiCard("amber", "촉진 필요", `${promotionTargets}`, "명", "사용률 기준"),
    kpiCard("red", "위험 인원", `${peopleAtRisk}`, "명", "소멸/잔여 경고")
  ].join("");

  const alerts = buildAlerts(summaries);
  document.getElementById("alert-count").textContent = `${alerts.length}건`;
  document.getElementById("alert-list").innerHTML = alerts.length ? alerts.map(renderAlertItem).join("") : emptyState("현재 표시할 경고가 없습니다.");

  document.getElementById("dept-summary").innerHTML = buildDepartmentSummary(summaries);
  document.getElementById("dashboard-body").innerHTML = summaries.map((item) => {
    const latest = latestRecord(item.employee.id, year)?.date || "없음";
    const tone = item.alertLevel === "urgent" ? "red" : item.alertLevel === "warning" ? "amber" : "green";
    const label = item.promotionNeeded ? "촉진 필요" : item.alertLabel;
    return `
      <tr>
        <td>${employeeCell(item.employee)}</td>
        <td>${item.employee.dept || "-"}</td>
        <td>${item.remain.toFixed(1)}일</td>
        <td>${item.usagePercent}%</td>
        <td>${latest}</td>
        <td><span class="tag ${tone}">${label}</span></td>
      </tr>
    `;
  }).join("");

  document.getElementById("ops-memo").value = state.settings.opsMemo || "";
  document.getElementById("audit-log-list").innerHTML = state.auditLogs.length
    ? [...state.auditLogs].slice(-20).reverse().map((log) => `
      <div class="row-item col">
        <div class="row-title">${log.action}</div>
        <div class="row-desc">${log.at}</div>
      </div>
    `).join("")
    : emptyState("아직 기록된 변경 로그가 없습니다.");

  document.querySelectorAll("[data-manager-open]").forEach((button) => {
    button.addEventListener("click", () => {
      ui.selectedEmployeeId = button.dataset.managerOpen;
      switchView("cal");
    });
  });
}

function renderLeaveHub() {
  renderLeaveHubTabs();
  const year = ui.currentYear;
  const summaries = state.employees.map((employee) => employeeSummary(employee.id, year));
  const root = document.getElementById("leave-hub-content");
  if (!root) return;
  if (ui.leaveTab === "overview") {
    root.innerHTML = renderLeaveOverviewTable(summaries);
    return;
  }
  if (ui.leaveTab === "sub") {
    root.innerHTML = renderLeaveSubTable();
    return;
  }
  root.innerHTML = renderLeaveSpecialTable();
}

function renderLeaveHubTabs() {
  const tabRoot = document.getElementById("leave-hub-tabs");
  if (!tabRoot) return;
  const tabs = [
    ["overview", "연차 오버뷰"],
    ["sub", "대체휴가"],
    ["special", "특별휴가"]
  ];
  tabRoot.innerHTML = tabs.map(([key, label]) => `
    <button class="chip-btn${ui.leaveTab === key ? " active" : ""}" data-action="switch-leave-tab" data-leave-tab="${key}">${label}</button>
  `).join("");
}

function switchLeaveTab(tab) {
  ui.leaveTab = tab;
  renderLeaveHub();
}

function renderLeaveOverviewTable(summaries) {
  return `
    <div class="kpi-grid">
      ${kpiCard("white", "직원 수", `${summaries.length}`, "명", `${ui.currentYear}년 기준`)}
      ${kpiCard("green", "총 생성", `${summaries.reduce((sum, item) => sum + item.total, 0).toFixed(1)}`, "일", "연차 기준")}
      ${kpiCard("amber", "총 사용", `${summaries.reduce((sum, item) => sum + item.used, 0).toFixed(1)}`, "일", "연차 기준")}
      ${kpiCard("primary", "총 잔여", `${summaries.reduce((sum, item) => sum + item.remain, 0).toFixed(1)}`, "일", "연차 기준")}
    </div>
    <div class="card">
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>직원</th><th>부서</th><th>생성</th><th>사용</th><th>잔여</th><th>사용률</th><th>상태</th></tr></thead>
          <tbody>
            ${summaries.map((item) => `<tr>
              <td>${employeeCell(item.employee)}</td>
              <td>${item.employee.dept || "-"}</td>
              <td>${item.total.toFixed(1)}</td>
              <td>${item.used.toFixed(1)}</td>
              <td>${item.remain.toFixed(1)}</td>
              <td>${item.usagePercent}%</td>
              <td><span class="tag ${item.alertLevel === "safe" ? "green" : "amber"}">${item.alertLabel}</span></td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderLeaveSubTable() {
  const rows = [...state.subLeaves].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return renderLeaveTxTable("대체휴가", rows);
}

function renderLeaveSpecialTable() {
  const rows = [...state.specialLeaves].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return renderLeaveTxTable("특별휴가", rows);
}

function renderLeaveTxTable(title, rows) {
  return `
    <div class="card">
      <div class="card-head"><div class="card-title">${title} 기록</div></div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>일자</th><th>직원</th><th>구분</th><th>일수</th><th>사유</th><th>메모</th></tr></thead>
          <tbody>
            ${rows.length ? rows.map((item) => `<tr>
              <td>${item.date || "-"}</td>
              <td>${findEmployee(item.empId)?.name || "-"}</td>
              <td>${item.action === "grant" ? "부여" : "사용"}</td>
              <td>${Number(item.days || 0).toFixed(1)}</td>
              <td>${item.reason || "-"}</td>
              <td>${item.memo || item.evidence || "-"}</td>
            </tr>`).join("") : `<tr><td colspan="6">${emptyState("기록이 없습니다.")}</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderCalendarView() {
  const employee = currentUser();
  if (!employee) return;
  const summary = employeeSummary(employee.id, ui.currentYear);
  const monthPrefix = `${ui.currentYear}-${pad(ui.currentMonth + 1)}`;
  const plannedThisMonth = state.records
    .filter((record) => record.empId === employee.id && record.date.startsWith(monthPrefix))
    .reduce((sum, record) => sum + leaveDelta(record.type), 0);
  document.getElementById("cal-heading").textContent = `${employee.name} · ${ui.currentYear}년 ${ui.currentMonth + 1}월`;
  document.getElementById("month-label").textContent = `${ui.currentYear}년 ${ui.currentMonth + 1}월`;
  document.getElementById("personal-kpis").innerHTML = [
    kpiCard("blue", "올해 발생", summary.total.toFixed(1), "일", `${ui.currentYear}년 기준`),
    kpiCard("green", "사용", summary.used.toFixed(1), "일", "연차 + 반차"),
    kpiCard("primary", "잔여", summary.remain.toFixed(1), "일", summary.alertLabel),
    kpiCard("amber", "이번 달 예정", plannedThisMonth.toFixed(1), "일", `${ui.currentMonth + 1}월 기록`)
  ].join("");

  renderYearTabs("year-tabs", ui.currentYear, (year) => {
    ui.currentYear = year;
    renderCalendarView();
    renderHistory();
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
    .filter((record) => !ui.histFilter.month || record.date.slice(5, 7) === ui.histFilter.month)
    .filter((record) => !ui.histFilter.type || record.type === ui.histFilter.type)
    .filter((record) => {
      if (!ui.histFilter.search) return true;
      return `${record.date} ${record.type} ${record.memo || ""}`.toLowerCase().includes(ui.histFilter.search);
    })
    .sort((left, right) => right.date.localeCompare(left.date));

  document.getElementById("history-count").textContent = `총 ${records.length}건`;
  document.getElementById("history-body").innerHTML = records.length
    ? records.map(renderRecordRow).join("")
    : emptyState("해당 연도 기록이 없습니다.");
}

function renderSettings() {
  const selected = employeeById(ui.settingsEmployeeId) || currentUser();
  if (!selected) return;
  ui.settingsEmployeeId = selected.id;
  document.getElementById("set-emp-sel").innerHTML = state.employees
    .map((employee) => `<option value="${employee.id}" ${employee.id === selected.id ? "selected" : ""}>${employee.name}</option>`)
    .join("");

  document.getElementById("join-date").value = selected.joinDate || "";
  document.getElementById("fiscal-year-month").value = String(selected.fiscalYearMonth || 1);
  document.getElementById("resignation-date").value = selected.resignationDate || "";
  document.getElementById("monthly-base-pay").value = selected.monthlyBasePay || "";
  document.getElementById("work-hours-per-day").value = selected.workHoursPerDay || state.settings.defaultWorkHoursPerDay || 8;
  document.getElementById("monthly-standard-hours").value = state.settings.monthlyStandardHours || 209;
  document.getElementById("leave-unit-price").value = selected.leaveUnitPrice || "";
  document.getElementById("average-daily-wage").value = selected.averageDailyWage || "";
  document.getElementById("employment-rules").value = state.settings.employmentRules || defaultEmploymentRules();
  document.getElementById("rules-last-updated").textContent = state.updatedAt
    ? `마지막 수정: ${state.updatedAt}`
    : "마지막 수정 정보가 없습니다.";
  document.getElementById("settings-focus").innerHTML = `
    <div class="focus-user">
      <div class="avatar" style="background:${selected.color || COLORS[0]}">${avatarContent(selected)}</div>
      <div>
        <div class="row-title">${selected.name}</div>
        <div class="row-desc">${[selected.dept, selected.role].filter(Boolean).join(" · ") || "부서/직책 미지정"}</div>
      </div>
    </div>
  `;
  const years = allYears();
  const auto = accrual(selected.joinDate, ui.currentYear, selected.fiscalYearMonth);
  document.getElementById("accrual-hint").textContent = selected.joinDate
    ? `${selected.name}님의 ${ui.currentYear}년 자동 계산 연차는 ${auto}일입니다.
회계년도 시작 월은 ${selected.fiscalYearMonth || 1}월입니다.`
    : "입사일을 입력하면 자동 계산 기준이 표시됩니다.";

  document.getElementById("year-inputs").innerHTML = years.map((year) => {
    const value = getTotal(selected.id, year);
    const autoValue = accrual(selected.joinDate, year, selected.fiscalYearMonth);
    const applied = Number(value || 0);
    return `
      <tr>
        <td>${year}년</td>
        <td>${autoValue.toFixed(1)}일</td>
        <td><input class="field field-inline" type="number" min="0" max="50" step="0.5" value="${value}" data-total-emp="${selected.id}" data-total-year="${year}"></td>
        <td><strong>${applied.toFixed(1)}일</strong></td>
      </tr>
    `;
  }).join("");

  const settlement = calcRetirementPayout(selected.id, ui.currentYear);
  document.getElementById("settlement-summary").innerHTML = `
    <div class="status-row"><span>잔여 연차</span><strong>${settlement.remainingDays.toFixed(2)}일</strong></div>
    <div class="status-row"><span>계산식</span><strong>${settlement.formula}</strong></div>
    <div class="status-row"><span>예상 정산액</span><strong class="calc-amount">${settlement.amount.toLocaleString("ko-KR")}원</strong></div>
    <div class="row-desc">${settlement.note}</div>
  `;
}

function renderEmployees() {
  const filtered = state.employees.filter((employee) => {
    const summary = employeeSummary(employee.id, ui.managerYear);
    const text = `${employee.name} ${employee.dept || ""} ${employee.role || ""}`.toLowerCase();
    const matchSearch = !ui.empFilter.search || text.includes(ui.empFilter.search);
    const matchDept = !ui.empFilter.dept || (employee.dept || "").toLowerCase().includes(ui.empFilter.dept);
    const risk = summary.alertLevel === "urgent" || summary.alertLevel === "warning";
    const matchRisk = ui.empFilter.risk === "all" || (ui.empFilter.risk === "risk" ? risk : !risk);
    return matchSearch && matchDept && matchRisk;
  });
  document.getElementById("employee-grid").style.display = ui.empFilter.viewMode === "table" ? "none" : "grid";
  document.getElementById("employee-table-card").style.display = ui.empFilter.viewMode === "table" ? "block" : "none";
  document.getElementById("employee-grid").innerHTML = filtered.map((employee) => {
    const summary = employeeSummary(employee.id, ui.managerYear);
    const width = summary.total ? Math.min(100, Math.round((summary.used / summary.total) * 100)) : 0;
    const latest = latestRecord(employee.id, ui.managerYear)?.date || "기록 없음";
    return `
      <div class="employee-card ${employee.id === ui.selectedEmployeeId ? "selected" : ""}">
        <div class="avatar" style="background:${employee.color}">${avatarContent(employee)}</div>
        <div class="employee-name">${employee.name}</div>
        <div class="employee-meta">${[employee.dept, employee.role].filter(Boolean).join(" · ") || "정보 없음"}</div>
        <div class="progress"><span style="width:${width}%"></span></div>
        <div class="row-desc">${summary.used} / ${summary.total}일 사용 · 잔여 ${summary.remain}일</div>
        <div class="card-actions">
          <button class="action-link" type="button" data-emp-open="${employee.id}">달력 보기</button>
          <button class="action-link" type="button" data-emp-edit="${employee.id}">수정</button>
        </div>
      </div>
    `;
  }).join("");
  document.getElementById("employee-table-body").innerHTML = filtered.map((employee) => {
    const summary = employeeSummary(employee.id, ui.managerYear);
    const latest = latestRecord(employee.id, ui.managerYear)?.date || "기록 없음";
    const tone = summary.alertLevel === "safe" ? "green" : summary.alertLevel === "warning" ? "amber" : "red";
    return `
      <tr>
        <td>${employeeCell(employee)}</td>
        <td>${[employee.dept, employee.role].filter(Boolean).join(" · ") || "-"}</td>
        <td>${summary.remain.toFixed(1)}일</td>
        <td>${latest}</td>
        <td><span class="tag ${tone}">${summary.alertLabel}</span></td>
        <td><button class="action-link" type="button" data-emp-open="${employee.id}">달력 보기</button> <button class="action-link" type="button" data-emp-edit="${employee.id}">수정</button></td>
      </tr>
    `;
  }).join("") || `<tr><td colspan="6">${emptyState("조건에 맞는 직원이 없습니다.")}</td></tr>`;

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
  const expiringSoon = state.subLeaves.filter((item) => item.type === "grant" && item.expireDate && (new Date(item.expireDate).getTime() - Date.now()) < (1000 * 60 * 60 * 24 * 45)).length;
  document.getElementById("sub-kpis").innerHTML = [
    kpiCard("green", "총 부여", sumSubByType("grant").toFixed(1), "일", "누적"),
    kpiCard("red", "총 사용", sumSubByType("use").toFixed(1), "일", "누적"),
    kpiCard("primary", "총 잔여", totalSubBalance().toFixed(1), "일", "모든 직원 합산"),
    kpiCard("amber", "만료 임박", `${expiringSoon}`, "건", "45일 이내")
  ].join("");

  const query = document.getElementById("sub-employee-search").value.trim().toLowerCase();
  document.getElementById("sub-employee-tabs").innerHTML = state.employees
    .filter((employee) => !query || employee.name.toLowerCase().includes(query) || (employee.dept || "").toLowerCase().includes(query))
    .map((employee) => {
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
        <div class="row-desc">현재 사용 가능한 대체휴가</div>
        <div class="sub-value">${subBalance(employee.id).toFixed(1)}일</div>
      </div>
      <div class="sub-balance-actions">
        <button class="btn ghost small" data-action="open-bulk-subleave-modal">일괄 부여</button>
        <button class="btn primary small" data-action="open-subleave-modal">부여 / 사용</button>
      </div>
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

function renderSpecialLeaves() {
  const specialTypes = ["경조사", "병가", "포상휴가", "생일반차", "기타휴가"];
  document.getElementById("special-kpis").innerHTML = [
    kpiCard("purple", "전체 잔여", state.employees.reduce((sum, employee) => sum + specialBalance(employee.id), 0).toFixed(1), "일", "전체 직원 합산"),
    kpiCard("green", "부여", sumSpecialByAction("grant").toFixed(1), "일", "누적"),
    kpiCard("red", "사용", sumSpecialByAction("use").toFixed(1), "일", "누적"),
    kpiCard("white", "이력 건수", `${state.specialLeaves.length}`, "건", "전체 유형")
  ].join("");

  document.getElementById("special-employee-tabs").innerHTML = state.employees.map((employee) => {
    const active = employee.id === ui.specialEmployeeId ? " active" : "";
    return `<button class="pill${active}" type="button" data-special-emp="${employee.id}">${employee.name}</button>`;
  }).join("");

  document.querySelectorAll("[data-special-emp]").forEach((button) => {
    button.addEventListener("click", () => {
      ui.specialEmployeeId = button.dataset.specialEmp;
      renderSpecialLeaves();
    });
  });

  const employee = employeeById(ui.specialEmployeeId) || currentUser();
  if (!employee) return;
  ui.specialEmployeeId = employee.id;
  document.getElementById("special-balance-label").textContent = employee.name;
  document.getElementById("special-balance").innerHTML = specialTypes.map((type) => `
    <div class="row-item">
      <div class="row-main">
        <div class="row-title">${type}</div>
        <div class="row-desc">${employee.name} 잔여</div>
      </div>
      <span class="tag purple">${specialBalanceByReason(employee.id, type).toFixed(1)}일</span>
    </div>
  `).join("");

  const history = state.specialLeaves
    .filter((item) => item.empId === employee.id)
    .sort((left, right) => right.date.localeCompare(left.date));
  document.getElementById("special-history-count").textContent = `총 ${history.length}건`;
  document.getElementById("special-history-body").innerHTML = history.length
    ? history.map((item) => `
      <div class="row-item">
        <div class="row-main">
          <div class="row-title">${item.date} · ${item.reason}</div>
          <div class="row-desc">${item.action === "grant" ? "부여" : "사용"} ${Number(item.days).toFixed(1)}일 · ${item.memo || item.evidence || "메모 없음"}</div>
        </div>
        <button class="action-link" type="button" data-special-delete="${item.id}">삭제</button>
      </div>
    `).join("")
    : emptyState("특별휴가 이력이 없습니다.");

  document.querySelectorAll("[data-special-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteSpecialLeave(button.dataset.specialDelete));
  });
}

function renderOfficeView() {
  const year = ui.managerYear;
  const rows = state.employees.filter((employee) => {
    const summary = employeeSummary(employee.id, year);
    const special = specialBalance(employee.id);
    const sub = subBalance(employee.id);
    const matchDept = !ui.officeFilter.dept || (employee.dept || "").toLowerCase().includes(ui.officeFilter.dept);
    const matchRole = !ui.officeFilter.role || (employee.role || "").toLowerCase().includes(ui.officeFilter.role);
    const matchBalance = ui.officeFilter.balance === "all"
      || (ui.officeFilter.balance === "leave" && summary.remain > 0)
      || (ui.officeFilter.balance === "special" && special > 0)
      || (ui.officeFilter.balance === "sub" && sub > 0);
    return matchDept && matchRole && matchBalance;
  }).map((employee) => {
    const summary = employeeSummary(employee.id, year);
    const special = specialBalance(employee.id);
    const sub = subBalance(employee.id);
    const latest = latestRecord(employee.id, year)?.date || "-";
    return `
      <tr>
        <td>${employeeCell(employee)}</td>
        <td>${employee.dept || "-"}</td>
        <td>${employee.role || "-"}</td>
        <td>${summary.remain.toFixed(1)}일</td>
        <td>${special.toFixed(1)}일</td>
        <td>${sub.toFixed(1)}일</td>
        <td>${latest === "-" ? "-" : `${latest} · 최근`}</td>
      </tr>
    `;
  });
  document.getElementById("office-body").innerHTML = rows.join("") || `<tr><td colspan="7">${emptyState("필터 조건에 맞는 직원이 없습니다.")}</td></tr>`;
  document.getElementById("office-count").textContent = `총 ${state.employees.length}명`;
  document.getElementById("office-kpis").innerHTML = [
    kpiCard("white", "전체 직원", `${state.employees.length}`, "명", "사무실 기준"),
    kpiCard("green", "평균 연차 잔여", `${state.employees.length ? round(state.employees.reduce((sum, employee) => sum + employeeSummary(employee.id, year).remain, 0) / state.employees.length).toFixed(1) : "0.0"}`, "일", `${year}년 기준`),
    kpiCard("purple", "특별휴가 보유", `${state.employees.filter((employee) => specialBalance(employee.id) > 0).length}`, "명", "잔여 > 0"),
    kpiCard("amber", "대체휴가 보유", `${state.employees.filter((employee) => subBalance(employee.id) > 0).length}`, "명", "잔여 > 0")
  ].join("");
}

function renderHrView() {
  renderYearTabs("hr-year-tabs", ui.hrYear, (year) => {
    ui.hrYear = year;
    renderHrView();
  });

  const admin = isCurrentAdmin();
  document.getElementById("hr-body").innerHTML = state.employees.filter((employee) => {
    const record = getHrRecord(employee.id, ui.hrYear);
    const text = `${employee.name} ${record.dept} ${record.role}`.toLowerCase();
    const status = (record.status || "").toLowerCase();
    return (!ui.hrFilter.search || text.includes(ui.hrFilter.search))
      && (!ui.hrFilter.status || status.includes(ui.hrFilter.status));
  }).map((employee) => {
    const record = getHrRecord(employee.id, ui.hrYear);
    const birthInput = admin
      ? `<input class="field" type="date" value="${employee.birthDate || ""}" data-hr-birth="${employee.id}">`
      : `<span class="row-desc">관리자 전용</span>`;
    const personalInput = admin
      ? `<textarea class="field" rows="2" data-hr-personal="${employee.id}" placeholder="민감 정보는 최소한으로 기록">${employee.personalInfo || ""}</textarea>`
      : `<span class="row-desc">관리자 전용</span>`;
    return `
      <tr>
        <td>${employeeCell(employee)}</td>
        <td><input class="field" type="text" value="${record.dept}" data-hr-dept="${employee.id}"></td>
        <td><input class="field" type="text" value="${record.role}" data-hr-role="${employee.id}"></td>
        <td><input class="field" type="date" value="${record.joinDate}" data-hr-join="${employee.id}"></td>
        <td><input class="field" type="month" value="${record.stepMonth || ""}" data-hr-step="${employee.id}"></td>
        <td><input class="field" type="month" value="${record.promotionMonth || ""}" data-hr-promotion="${employee.id}"></td>
        <td><input class="field" type="number" min="0" step="0.5" value="${record.careerYears || ""}" data-hr-career="${employee.id}"></td>
        <td><input class="field" type="text" value="${record.certifications || ""}" data-hr-cert="${employee.id}" placeholder="사회복지사1급, 회계 등"></td>
        <td><input class="field" type="text" value="${record.workType}" data-hr-work="${employee.id}" placeholder="정규/계약/파트 등"></td>
        <td><input class="field" type="text" value="${record.status}" data-hr-status="${employee.id}" placeholder="재직/휴직/퇴사"></td>
        <td>${birthInput}</td>
        <td>${personalInput}</td>
      </tr>
    `;
  }).join("");

  document.getElementById("payroll-body").innerHTML = state.employees.map((employee) => {
    const record = getHrRecord(employee.id, ui.hrYear);
    const calculatedPay = calculatePayByGrade(record.payGrade, record.payLevel, record.payStep);
    const basePay = Number(record.monthlySalary || calculatedPay || 0);
    const autoTax = calculateWithholdingTax(basePay, Number(record.taxFamilyCount || 1), Number(record.taxChildCount || 0), Number(record.taxRatePercent || 100));
    const allowance = calculateAllowancePackage(record, basePay);
    return `
      <tr>
        <td>${employeeCell(employee)}</td>
        <td><input class="field" type="text" value="${record.payGrade || ""}" data-pay-grade="${employee.id}" placeholder="예: 일반직/관리직/기능직"></td>
        <td><input class="field" type="text" value="${record.payLevel || ""}" data-pay-level="${employee.id}" placeholder="예: 1급~5급"></td>
        <td><input class="field" type="number" min="1" step="1" value="${record.payStep || ""}" data-pay-step="${employee.id}" placeholder="예: 3"></td>
        <td><input class="field" type="number" min="0" step="10000" value="${basePay}" data-pay-salary="${employee.id}"></td>
        <td>
          <select class="field" data-pay-tax-mode="${employee.id}">
            <option value="hometax" ${record.taxMode === "hometax" ? "selected" : ""}>홈택스 비율</option>
            <option value="manual" ${record.taxMode === "manual" ? "selected" : ""}>수동 계산식</option>
          </select>
        </td>
        <td><input class="field" type="number" min="0" max="100" step="0.01" value="${record.manualTaxRate || 0}" data-pay-tax-rate="${employee.id}"></td>
        <td><input class="field" type="number" min="0" step="1000" value="${record.taxMode === "manual" ? (record.withholdingTax || 0) : autoTax}" data-pay-tax="${employee.id}"></td>
        <td><input class="field" type="number" min="0" step="1000" value="${record.socialInsurance || 0}" data-pay-insurance="${employee.id}"></td>
        <td><input class="field" type="number" min="0" step="1" value="${record.spouseCount || 0}" data-pay-spouse="${employee.id}"></td>
        <td><input class="field" type="number" min="0" step="1" value="${record.childCount || 0}" data-pay-child="${employee.id}"></td>
        <td><input class="field" type="number" min="0" step="1" value="${record.otherDependentCount || 0}" data-pay-other="${employee.id}"></td>
        <td><input class="field" type="number" min="0" step="1000" value="${record.adjustmentAllowance || 0}" data-pay-adjust="${employee.id}"></td>
        <td><input class="field" type="number" min="0" step="1" value="${record.overtimeHours || 0}" data-pay-ot="${employee.id}"></td>
        <td><input class="field" type="number" min="0" step="1" value="${record.holidayOvertimeHours || 0}" data-pay-hot="${employee.id}"></td>
        <td>${Math.round(allowance.totalAllowance).toLocaleString("ko-KR")}</td>
        <td>${Math.round(allowance.ordinaryWage).toLocaleString("ko-KR")}</td>
        <td><input class="field" type="number" min="0" step="10000" value="${record.severanceEstimate || 0}" data-pay-severance="${employee.id}"></td>
        <td><label class="checkbox-row"><input type="checkbox" data-pay-edu="${employee.id}" ${record.mandatoryEduDone ? "checked" : ""}><span>이수</span></label></td>
      </tr>
    `;
  }).join("");

  const standard = state.settings.welfareStandard || defaultWelfareStandard();
  document.getElementById("welfare-rule-name").value = standard.name || "";
  document.getElementById("welfare-weekly-hours").value = standard.weeklyHours || 40;
  document.getElementById("welfare-retirement-note").value = standard.retirementNote || "";
  document.getElementById("welfare-education-note").value = standard.educationNote || "";
  const birthdayRule = state.settings.birthdayRule || defaultBirthdayRule();
  document.getElementById("birthday-grant-rule").value = birthdayRule.base;
  document.getElementById("birthday-grant-days").value = birthdayRule.days;
  document.getElementById("birthday-min-months").value = birthdayRule.minMonths;
  document.getElementById("labor-rule-year").value = String(state.settings.activeLaborRuleYear || 2026);
  document.getElementById("labor-rule-log").textContent = state.settings.laborRuleLog || "룰 로드/시뮬레이션 결과가 표시됩니다.";
  const allowance = state.settings.allowanceRules || defaultAllowanceRules();
  document.getElementById("allow-meal").value = allowance.meal || 140000;
  document.getElementById("allow-manager").value = allowance.manager || 220000;
  document.getElementById("allow-spouse").value = allowance.spouse || 40000;
  document.getElementById("allow-child1").value = allowance.child1 || 50000;
  document.getElementById("allow-child2").value = allowance.child2 || 80000;
  document.getElementById("allow-child3").value = allowance.child3Plus || 120000;
  document.getElementById("allow-other").value = allowance.otherDependent || 20000;
  document.getElementById("allow-adjustment").value = allowance.defaultAdjustment || 0;
  document.getElementById("allowance-preview").textContent = `서울시 2026 기준값: 정액급식비 월 ${Number(allowance.meal || 0).toLocaleString("ko-KR")}원, 관리자수당 월 ${Number(allowance.manager || 0).toLocaleString("ko-KR")}원, 시간외수당 1.5배/휴일8시간초과 2배`;
  renderPayGradeTable();
}

function renderDataHub() {
  const select = document.getElementById("category-select");
  if (!select.value) select.value = "employees";
  document.getElementById("datahub-validate").textContent = `선택 카테고리: ${select.value}\n적용 범위: 해당 카테고리 데이터만 교체`;
}

function renderPayrollCenter() {
  const select = document.getElementById("wage-calc-emp");
  if (!select) return;
  select.innerHTML = state.employees.map((employee) => `<option value="${employee.id}" ${employee.id === ui.wageCalcEmployeeId ? "selected" : ""}>${employee.name}</option>`).join("");
  if (!ui.wageCalcEmployeeId && state.employees[0]) ui.wageCalcEmployeeId = state.employees[0].id;
  loadWageCalcFromEmployee();
}

function loadWageCalcFromEmployee() {
  const employee = employeeById(ui.wageCalcEmployeeId) || state.employees[0];
  if (!employee) return;
  const record = getHrRecord(employee.id, ui.hrYear);
  document.getElementById("wage-calc-grade").value = record.payGrade || "";
  document.getElementById("wage-calc-level").value = record.payLevel || "";
  document.getElementById("wage-calc-step").value = record.payStep || 1;
  document.getElementById("wage-calc-spouse").value = record.spouseCount || 0;
  document.getElementById("wage-calc-child").value = record.childCount || 0;
  document.getElementById("wage-calc-other").value = record.otherDependentCount || 0;
  document.getElementById("wage-calc-adjust").value = record.adjustmentAllowance || 0;
  document.getElementById("wage-calc-overtime").value = record.overtimeHours || 0;
  document.getElementById("wage-calc-holiday").value = record.holidayOvertimeHours || 0;
  document.getElementById("wage-calc-family").value = record.taxFamilyCount || 1;
  document.getElementById("wage-calc-child-tax").value = record.taxChildCount || 0;
  document.getElementById("wage-calc-tax-rate").value = String(record.taxRatePercent || 100);
  const flags = record.allowanceFlags || { meal: true, manager: true, family: true, adjustment: true, overtime: true };
  document.getElementById("wage-allow-meal").checked = flags.meal !== false;
  document.getElementById("wage-allow-manager").checked = flags.manager !== false;
  document.getElementById("wage-allow-family").checked = flags.family !== false;
  document.getElementById("wage-allow-adjust").checked = flags.adjustment !== false;
  document.getElementById("wage-allow-overtime").checked = flags.overtime !== false;
  runWageCalculator(false);
}

function runWageCalculator(shouldSave = true) {
  const empId = document.getElementById("wage-calc-emp").value;
  const employee = employeeById(empId);
  if (!employee) return;
  const year = ui.hrYear;
  const record = getHrRecord(empId, year);
  record.payGrade = document.getElementById("wage-calc-grade").value.trim();
  record.payLevel = document.getElementById("wage-calc-level").value.trim();
  record.payStep = Number(document.getElementById("wage-calc-step").value || 1);
  record.spouseCount = Number(document.getElementById("wage-calc-spouse").value || 0);
  record.childCount = Number(document.getElementById("wage-calc-child").value || 0);
  record.otherDependentCount = Number(document.getElementById("wage-calc-other").value || 0);
  record.adjustmentAllowance = Number(document.getElementById("wage-calc-adjust").value || 0);
  record.overtimeHours = Number(document.getElementById("wage-calc-overtime").value || 0);
  record.holidayOvertimeHours = Number(document.getElementById("wage-calc-holiday").value || 0);
  record.taxFamilyCount = Number(document.getElementById("wage-calc-family").value || 1);
  record.taxChildCount = Number(document.getElementById("wage-calc-child-tax").value || 0);
  record.taxRatePercent = Number(document.getElementById("wage-calc-tax-rate").value || 100);
  record.allowanceFlags = {
    meal: document.getElementById("wage-allow-meal").checked,
    manager: document.getElementById("wage-allow-manager").checked,
    family: document.getElementById("wage-allow-family").checked,
    adjustment: document.getElementById("wage-allow-adjust").checked,
    overtime: document.getElementById("wage-allow-overtime").checked
  };
  record.monthlySalary = calculatePayByGrade(record.payGrade, record.payLevel, record.payStep);
  const allowance = calculateAllowancePackage(record, record.monthlySalary, record.allowanceFlags);
  const gross = record.monthlySalary + allowance.totalAllowance;
  const tax = calculateWithholdingTax(record.monthlySalary, record.taxFamilyCount, record.taxChildCount, record.taxRatePercent);
  const insurance = Number(record.socialInsurance || 0);
  const net = gross - tax - insurance;
  document.getElementById("wage-calc-result").innerHTML = `
    <div class="status-row"><span>직원</span><strong>${employee.name}</strong></div>
    <div class="status-row"><span>기본급</span><strong>${Math.round(record.monthlySalary).toLocaleString("ko-KR")}원</strong></div>
    <div class="status-row"><span>제수당 합계</span><strong>${Math.round(allowance.totalAllowance).toLocaleString("ko-KR")}원</strong></div>
    <div class="status-row"><span>통상임금</span><strong>${Math.round(allowance.ordinaryWage).toLocaleString("ko-KR")}원</strong></div>
    <div class="status-row"><span>원천세(자동)</span><strong>${Math.round(tax).toLocaleString("ko-KR")}원</strong></div>
    <div class="status-row"><span>지방소득세(10%)</span><strong>${Math.round(tax * 0.1).toLocaleString("ko-KR")}원</strong></div>
    <div class="status-row"><span>4대보험</span><strong>${Math.round(insurance).toLocaleString("ko-KR")}원</strong></div>
    <div class="status-row"><span>예상 실수령</span><strong>${Math.round(net - (tax * 0.1)).toLocaleString("ko-KR")}원</strong></div>
    <div class="hint-box">계산식: 기본급 + 제수당 - 원천세 - 지방소득세(원천세의10%) - 4대보험. 간이세액표 업로드 시 lookup 적용.</div>
  `;
  state.hrRecords[`${empId}_${year}`] = record;
  if (shouldSave) touchState("임금 자동계산 실행");
}

function renderPayrollCenter() {
  const select = document.getElementById("wage-calc-emp");
  if (!select) return;
  select.innerHTML = state.employees.map((employee) => `<option value="${employee.id}" ${employee.id === ui.wageCalcEmployeeId ? "selected" : ""}>${employee.name}</option>`).join("");
  if (!ui.wageCalcEmployeeId && state.employees[0]) ui.wageCalcEmployeeId = state.employees[0].id;
  loadWageCalcFromEmployee();
}

function loadWageCalcFromEmployee() {
  const employee = employeeById(ui.wageCalcEmployeeId) || state.employees[0];
  if (!employee) return;
  const record = getHrRecord(employee.id, ui.hrYear);
  document.getElementById("wage-calc-grade").value = record.payGrade || "";
  document.getElementById("wage-calc-level").value = record.payLevel || "";
  document.getElementById("wage-calc-step").value = record.payStep || 1;
  document.getElementById("wage-calc-spouse").value = record.spouseCount || 0;
  document.getElementById("wage-calc-child").value = record.childCount || 0;
  document.getElementById("wage-calc-other").value = record.otherDependentCount || 0;
  document.getElementById("wage-calc-adjust").value = record.adjustmentAllowance || 0;
  document.getElementById("wage-calc-overtime").value = record.overtimeHours || 0;
  document.getElementById("wage-calc-holiday").value = record.holidayOvertimeHours || 0;
  document.getElementById("wage-calc-family").value = record.taxFamilyCount || 1;
  document.getElementById("wage-calc-child-tax").value = record.taxChildCount || 0;
  document.getElementById("wage-calc-tax-rate").value = String(record.taxRatePercent || 100);
  const flags = record.allowanceFlags || { meal: true, manager: true, family: true, adjustment: true, overtime: true };
  document.getElementById("wage-allow-meal").checked = flags.meal !== false;
  document.getElementById("wage-allow-manager").checked = flags.manager !== false;
  document.getElementById("wage-allow-family").checked = flags.family !== false;
  document.getElementById("wage-allow-adjust").checked = flags.adjustment !== false;
  document.getElementById("wage-allow-overtime").checked = flags.overtime !== false;
  runWageCalculator(false);
}

function runWageCalculator(shouldSave = true) {
  const empId = document.getElementById("wage-calc-emp").value;
  const employee = employeeById(empId);
  if (!employee) return;
  const year = ui.hrYear;
  const record = getHrRecord(empId, year);
  record.payGrade = document.getElementById("wage-calc-grade").value.trim();
  record.payLevel = document.getElementById("wage-calc-level").value.trim();
  record.payStep = Number(document.getElementById("wage-calc-step").value || 1);
  record.spouseCount = Number(document.getElementById("wage-calc-spouse").value || 0);
  record.childCount = Number(document.getElementById("wage-calc-child").value || 0);
  record.otherDependentCount = Number(document.getElementById("wage-calc-other").value || 0);
  record.adjustmentAllowance = Number(document.getElementById("wage-calc-adjust").value || 0);
  record.overtimeHours = Number(document.getElementById("wage-calc-overtime").value || 0);
  record.holidayOvertimeHours = Number(document.getElementById("wage-calc-holiday").value || 0);
  record.taxFamilyCount = Number(document.getElementById("wage-calc-family").value || 1);
  record.taxChildCount = Number(document.getElementById("wage-calc-child-tax").value || 0);
  record.taxRatePercent = Number(document.getElementById("wage-calc-tax-rate").value || 100);
  record.allowanceFlags = {
    meal: document.getElementById("wage-allow-meal").checked,
    manager: document.getElementById("wage-allow-manager").checked,
    family: document.getElementById("wage-allow-family").checked,
    adjustment: document.getElementById("wage-allow-adjust").checked,
    overtime: document.getElementById("wage-allow-overtime").checked
  };
  record.monthlySalary = calculatePayByGrade(record.payGrade, record.payLevel, record.payStep);
  const allowance = calculateAllowancePackage(record, record.monthlySalary, record.allowanceFlags);
  const gross = record.monthlySalary + allowance.totalAllowance;
  const tax = calculateWithholdingTax(record.monthlySalary, record.taxFamilyCount, record.taxChildCount, record.taxRatePercent);
  const insurance = Number(record.socialInsurance || 0);
  const net = gross - tax - insurance;
  document.getElementById("wage-calc-result").innerHTML = `
    <div class="status-row"><span>직원</span><strong>${employee.name}</strong></div>
    <div class="status-row"><span>기본급</span><strong>${Math.round(record.monthlySalary).toLocaleString("ko-KR")}원</strong></div>
    <div class="status-row"><span>제수당 합계</span><strong>${Math.round(allowance.totalAllowance).toLocaleString("ko-KR")}원</strong></div>
    <div class="status-row"><span>통상임금</span><strong>${Math.round(allowance.ordinaryWage).toLocaleString("ko-KR")}원</strong></div>
    <div class="status-row"><span>원천세(자동)</span><strong>${Math.round(tax).toLocaleString("ko-KR")}원</strong></div>
    <div class="status-row"><span>지방소득세(10%)</span><strong>${Math.round(tax * 0.1).toLocaleString("ko-KR")}원</strong></div>
    <div class="status-row"><span>4대보험</span><strong>${Math.round(insurance).toLocaleString("ko-KR")}원</strong></div>
    <div class="status-row"><span>예상 실수령</span><strong>${Math.round(net - (tax * 0.1)).toLocaleString("ko-KR")}원</strong></div>
    <div class="hint-box">계산식: 기본급 + 제수당 - 원천세 - 지방소득세(원천세의10%) - 4대보험. 간이세액표 업로드 시 lookup 적용.</div>
  `;
  state.hrRecords[`${empId}_${year}`] = record;
  if (shouldSave) touchState("임금 자동계산 실행");
}

function renderErpView() {
  document.getElementById("erp-module-kpis").innerHTML = [
    kpiCard("blue", "인사기본", "4", "모듈", "기본 관리"),
    kpiCard("green", "근태/휴가", "3", "모듈", "운영 관리"),
    kpiCard("amber", "급여/세무", "4", "모듈", "정산 관리"),
    kpiCard("purple", "컴플라이언스", "4", "모듈", "리스크 관리")
  ].join("");
  const sections = {
    hr: [
      {
        id: "hr-card",
        title: "인사카드/신상관리",
        desc: "직원 상세정보 등록/수정",
        view: "hr"
      },
      {
        id: "hr-org",
        title: "조직도 관리",
        desc: "부서/상위부서/팀장 연결",
        view: "erp"
      }
    ],
    attendance: [
      {
        id: "att-leave",
        title: "연차/휴가",
        desc: "연차/특별휴가/대체휴가 관리",
        view: "leave"
      },
      {
        id: "att-risk",
        title: "리스크 캘린더",
        desc: "소멸위험/촉진대상 모니터링",
        view: "dashboard"
      }
    ],
    payroll: [
      {
        id: "pay-grade",
        title: "임금테이블/세액표",
        desc: "직급별 기본급/원천세 로직",
        view: "payroll"
      },
      {
        id: "pay-settlement",
        title: "퇴직금/정산",
        desc: "퇴직 정산 참고 계산",
        view: "set"
      }
    ],
    compliance: [
      {
        id: "comp-edu",
        title: "법정의무교육",
        desc: "급여 화면에서 이수여부 저장",
        view: "hr"
      },
      {
        id: "comp-labor",
        title: "법령 룰/생일반차",
        desc: "연도별 룰 로드 및 자동부여",
        view: "hr"
      }
    ]
  };

  Object.entries(sections).forEach(([key, items]) => {
    const container = document.getElementById(`erp-${key}`);
    if (!container) return;
    container.innerHTML = items.map((item) => renderErpModuleCard(item)).join("");
  });

  renderOrgFormOptions();
  renderOrgTree();
}

function renderErpModuleCard(item) {
  const stateItem = getErpModuleState(item.id);
  const ownerName = employeeById(stateItem.ownerId)?.name || "담당 미지정";
  return `
    <div class="row-item col">
      <div class="row-main">
        <div class="row-title">${item.title}</div>
        <div class="row-desc">${item.desc}</div>
      </div>
      <div class="erp-module-meta">
        <select class="field" data-erp-module-id="${item.id}" data-erp-owner>
          <option value="">담당자</option>
          ${state.employees.map((employee) => `<option value="${employee.id}" ${employee.id === stateItem.ownerId ? "selected" : ""}>${employee.name}</option>`).join("")}
        </select>
        <select class="field" data-erp-module-id="${item.id}" data-erp-status>
          ${["todo", "doing", "done"].map((status) => `<option value="${status}" ${status === stateItem.status ? "selected" : ""}>${status}</option>`).join("")}
        </select>
        <input class="field" type="date" value="${stateItem.dueDate || ""}" data-erp-module-id="${item.id}" data-erp-due>
      </div>
      <input class="field" type="text" placeholder="운영 메모" value="${stateItem.note || ""}" data-erp-module-id="${item.id}" data-erp-note>
      <div class="row-desc">현재 담당: ${ownerName}</div>
      <div class="row-item-actions">
        <button class="action-link" type="button" data-action="open-erp-menu" data-view="${item.view}">열기</button>
        <button class="action-link" type="button" data-action="toggle-erp-module" data-erp-module-id="${item.id}">${stateItem.collapsed ? "열기" : "접기"}</button>
      </div>
    </div>
  `;
}

function getErpModuleState(moduleId) {
  state.settings.erpModuleState = state.settings.erpModuleState || {};
  if (!state.settings.erpModuleState[moduleId]) {
    state.settings.erpModuleState[moduleId] = {
      ownerId: "",
      status: "todo",
      dueDate: "",
      note: "",
      collapsed: false
    };
  }
  return state.settings.erpModuleState[moduleId];
}

function toggleErpModule(moduleId) {
  const moduleState = getErpModuleState(moduleId);
  moduleState.collapsed = !moduleState.collapsed;
  touchState(`ERP 모듈 상태 토글 (${moduleId})`);
  renderErpView();
}

function renderOrgFormOptions() {
  const parentSelect = document.getElementById("org-parent-id");
  const leaderSelect = document.getElementById("org-leader-id");
  parentSelect.innerHTML = `<option value="">상위부서(없음)</option>${state.orgUnits.map((unit) => `<option value="${unit.id}">${unit.name}</option>`).join("")}`;
  leaderSelect.innerHTML = `<option value="">팀장 선택</option>${state.employees.map((employee) => `<option value="${employee.id}">${employee.name}</option>`).join("")}`;
  document.getElementById("org-edit-id").value = ui.orgEditId || "";
  if (ui.orgEditId) {
    const editing = state.orgUnits.find((unit) => unit.id === ui.orgEditId);
    if (editing) {
      document.getElementById("org-unit-name").value = editing.name;
      parentSelect.value = editing.parentId || "";
      leaderSelect.value = editing.leaderId || "";
      document.getElementById("org-unit-note").value = editing.note || "";
    }
  }
}

function resetOrgUnitForm() {
  ui.orgEditId = "";
  document.getElementById("org-edit-id").value = "";
  ["org-unit-name", "org-unit-note"].forEach((id) => { document.getElementById(id).value = ""; });
  document.getElementById("org-parent-id").value = "";
  document.getElementById("org-leader-id").value = "";
}

function saveOrgUnit() {
  const name = document.getElementById("org-unit-name").value.trim();
  if (!name) {
    alert("부서명을 입력하세요.");
    return;
  }
  const payload = {
    id: ui.orgEditId || `org_${Date.now()}`,
    name,
    parentId: document.getElementById("org-parent-id").value,
    leaderId: document.getElementById("org-leader-id").value,
    note: document.getElementById("org-unit-note").value.trim()
  };
  const index = state.orgUnits.findIndex((unit) => unit.id === payload.id);
  if (index >= 0) {
    state.orgUnits[index] = payload;
    touchState(`조직도 수정: ${name}`);
  } else {
    state.orgUnits.push(payload);
    touchState(`조직도 추가: ${name}`);
  }
  resetOrgUnitForm();
  renderErpView();
}

function editOrgUnit(orgUnitId) {
  const unit = state.orgUnits.find((item) => item.id === orgUnitId);
  if (!unit) return;
  ui.orgEditId = orgUnitId;
  renderErpView();
}

function deleteOrgUnit(orgUnitId) {
  const unit = state.orgUnits.find((item) => item.id === orgUnitId);
  if (!unit) return;
  if (!confirm(`${unit.name} 부서를 삭제할까요?`)) return;
  state.orgUnits = state.orgUnits.filter((item) => item.id !== orgUnitId && item.parentId !== orgUnitId);
  touchState(`조직도 삭제: ${unit.name}`);
  resetOrgUnitForm();
  renderErpView();
}

function autoBuildOrgUnits() {
  const mode = document.getElementById("org-build-mode").value;
  const map = new Map(state.orgUnits.map((unit) => [unit.name, unit]));
  state.employees.forEach((employee) => {
    const dept = employee.dept || "미지정";
    const parts = mode === "slash"
      ? dept.split("/")
      : mode === "arrow"
        ? dept.split(">")
        : [dept];
    let parentId = "";
    parts.map((part) => part.trim()).filter(Boolean).forEach((part) => {
      if (!map.has(part)) {
        const unit = { id: `org_${Date.now()}_${map.size}`, name: part, parentId, leaderId: "", note: "자동구성" };
        map.set(part, unit);
      }
      const current = map.get(part);
      current.parentId = current.parentId || parentId;
      parentId = current.id;
    });
  });
  state.orgUnits = Array.from(map.values());
  touchState("조직도 자동구성 실행");
  renderErpView();
}

function renderOrgTree() {
  const container = document.getElementById("org-tree-view");
  const list = document.getElementById("org-unit-list");
  list.innerHTML = state.orgUnits.map((unit) => {
    const leader = employeeById(unit.leaderId)?.name || "미지정";
    const members = state.employees.filter((employee) => (employee.dept || "").includes(unit.name)).map((employee) => employee.name).join(", ");
    return `
      <div class="row-item col">
        <div class="row-main">
          <div class="row-title">${unit.name}</div>
          <div class="row-desc">상위부서: ${unit.parentId ? (state.orgUnits.find((item) => item.id === unit.parentId)?.name || "-") : "없음"}</div>
          <div class="org-members">팀장: ${leader}${members ? ` · 구성원: ${members}` : ""}</div>
        </div>
        <div class="row-item-actions">
          <button class="action-link" type="button" data-action="edit-org-unit" data-org-unit-id="${unit.id}">수정</button>
          <button class="action-link" type="button" data-action="delete-org-unit" data-org-unit-id="${unit.id}">삭제</button>
        </div>
      </div>
    `;
  }).join("") || emptyState("저장된 부서가 없습니다.");

  const treeLines = buildOrgTreeLines();
  container.innerHTML = treeLines.length
    ? treeLines.map((line) => `<div class="row-item"><div class="row-title">${line}</div></div>`).join("")
    : emptyState("조직도 데이터가 없습니다.");
}

function buildOrgTreeLines() {
  const byParent = new Map();
  state.orgUnits.forEach((unit) => {
    const key = unit.parentId || "root";
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(unit);
  });
  const lines = [];
  const walk = (parentId, depth) => {
    const children = byParent.get(parentId || "root") || [];
    children.sort((a, b) => a.name.localeCompare(b.name, "ko"));
    children.forEach((unit) => {
      lines.push(`${"ㆍ".repeat(depth)} ${unit.name}`.trim());
      walk(unit.id, depth + 1);
    });
  };
  walk("", 0);
  return lines;
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
        ${["dashboard", "leave", "cal", "hist", "set", "emp", "mgr", "sub", "spe", "office", "hr", "payroll", "datahub", "erp", "sync"].map((menu) => `
          <td><input type="checkbox" data-menu-emp="${employee.id}" data-menu-key="${menu}" ${hasRawMenu(employee.id, menu) ? "checked" : ""}></td>
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

  const rows = state.employees.map((employee) => {
    const summary = employeeSummary(employee.id, ui.managerYear);
    const latest = latestRecord(employee.id, ui.managerYear)?.date || "없음";
    return {
      employee,
      summary,
      latest
    };
  }).filter(({ employee, summary }) => {
    const search = ui.managerFilter.search;
    const dept = ui.managerFilter.dept;
    const risk = ui.managerFilter.risk;
    const usageMin = Number(ui.managerFilter.usageMin || 0);
    const usageMax = Number(ui.managerFilter.usageMax || 100);
    const matchesSearch = !search || employee.name.toLowerCase().includes(search);
    const matchesDept = !dept || (employee.dept || "").toLowerCase().includes(dept);
    const matchesRisk = risk === "all"
      || (risk === "risk" && summary.alertLevel !== "safe")
      || (risk === "safe" && summary.alertLevel === "safe");
    const matchesUsage = summary.usagePercent >= usageMin && summary.usagePercent <= usageMax;
    return matchesSearch && matchesDept && matchesRisk && matchesUsage;
  });
  const sorted = [...filtered];
  const sortMode = ui.managerFilter.sort || "name";
  if (sortMode === "risk") {
    const order = { urgent: 0, warning: 1, safe: 2 };
    sorted.sort((a, b) => order[employeeSummary(a.id, ui.managerYear).alertLevel] - order[employeeSummary(b.id, ui.managerYear).alertLevel]);
  } else if (sortMode === "remainAsc") {
    sorted.sort((a, b) => employeeSummary(a.id, ui.managerYear).remain - employeeSummary(b.id, ui.managerYear).remain);
  } else if (sortMode === "remainDesc") {
    sorted.sort((a, b) => employeeSummary(b.id, ui.managerYear).remain - employeeSummary(a.id, ui.managerYear).remain);
  } else {
    sorted.sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }
  const riskCount = sorted.filter((employee) => {
    const level = employeeSummary(employee.id, ui.managerYear).alertLevel;
    return level === "urgent" || level === "warning";
  }).length;
  const avgRemain = sorted.length ? round(sorted.reduce((sum, employee) => sum + employeeSummary(employee.id, ui.managerYear).remain, 0) / sorted.length) : 0;
  document.getElementById("manager-summary").innerHTML = [
    kpiCard("white", "검색 결과", `${sorted.length}`, "명", "필터 기준"),
    kpiCard("red", "위험 인원", `${riskCount}`, "명", "주의+긴급"),
    kpiCard("green", "평균 잔여", `${avgRemain.toFixed(1)}`, "일", "결과 기준"),
    kpiCard("blue", "정렬 기준", sortMode, "", "현재 설정")
  ].join("");

  document.getElementById("manager-body").innerHTML = rows.map(({ employee, summary, latest }) => `
    <tr>
      <td>${employeeCell(employee)}</td>
      <td>${employee.dept || "-"}</td>
      <td>${summary.total.toFixed(1)}</td>
      <td>${summary.used.toFixed(1)}</td>
      <td>${summary.remain.toFixed(1)}</td>
      <td>${summary.usagePercent}%</td>
      <td>${latest}</td>
      <td><button class="action-link" type="button" data-manager-open="${employee.id}">상세</button></td>
    </tr>
  `).join("") || `<tr><td colspan="8">${emptyState("조건에 맞는 직원이 없습니다.")}</td></tr>`;

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
  document.getElementById("admin-password").value = "";
  document.getElementById("auto-save-toggle").checked = !!getSyncPrefs().autoSave;
  document.getElementById("last-saved-at").textContent = lastSavedAt || "없음";
  document.getElementById("last-loaded-at").textContent = lastLoadedAt || "없음";
  document.getElementById("sync-detail-status").textContent = syncStatus.label;
  document.getElementById("auto-save-label").textContent = getSyncPrefs().autoSave ? "사용" : "꺼짐";
  document.getElementById("sync-log").textContent = syncStatus.detail;
  const archive = getArchiveSnapshots();
  document.getElementById("snapshot-log").textContent = archive.length
    ? archive.map((item) => `${item.savedAt} · ${item.reason}`).join("\n")
    : "스냅샷 로그가 여기에 표시됩니다.";
}

function renderSyncStatus() {
  const pill = document.getElementById("sync-pill");
  pill.className = `sync-pill ${syncStatus.tone}`;
  pill.textContent = syncStatus.label;
  document.getElementById("sync-message").textContent = syncStatus.detail;
  document.getElementById("last-saved-at").textContent = lastSavedAt || "없음";
  document.getElementById("last-loaded-at").textContent = lastLoadedAt || "없음";
  document.getElementById("sync-detail-status").textContent = syncStatus.label;
  document.getElementById("auto-save-label").textContent = getSyncPrefs().autoSave ? "사용" : "꺼짐";
  document.getElementById("sync-log").textContent = syncStatus.detail;
}

function switchView(view) {
  if (!hasMenuAccess(currentUser()?.id, view)) return;
  ui.activeView = view;
  document.querySelectorAll(".view").forEach((section) => section.classList.remove("active"));
  document.getElementById(`view-${view}`)?.classList.add("active");
  renderNavigation();
  renderActiveView();
}

function renderYearTabs(containerId, selectedYear, onClick) {
  document.getElementById(containerId).innerHTML = allYears().map((year) => `
    <button class="year-tab${year === selectedYear ? " active" : ""}" type="button" data-year="${year}">${year}년</button>
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
    cells.push(`<div class="day-cell empty"></div>`);
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
    const leaveCount = records.filter((record) => record.type === "연차").length;
    const halfCount = records.filter((record) => record.type !== "연차").length;
    const tags = [];
    if (holiday) tags.push(`<span class="day-tag holiday">★ 공휴일</span>`);
    else if (isSubHoliday) tags.push(`<span class="day-tag sub">⇄ 대체휴일</span>`);
    if (leaveCount) tags.push(`<span class="day-tag leave">🗓 연차 ${leaveCount}</span>`);
    if (halfCount) tags.push(`<span class="day-tag half">◐ 반차 ${halfCount}</span>`);

    cells.push(`
      <button class="${classes.join(" ")}" type="button" data-date="${key}">
        <div class="day-number">${day}</div>
        ${tags.join("")}
      </button>
    `);
  }

  grid.innerHTML = cells.join("");
  grid.querySelectorAll("[data-date]").forEach((button) => {
    button.addEventListener("click", () => toggleRecordByDate(button.dataset.date));
  });
}

function renderMonthHistory() {
  const prefix = `${ui.currentYear}-${pad(ui.currentMonth + 1)}`;
  const records = state.records
    .filter((record) => record.empId === ui.selectedEmployeeId && record.date.startsWith(prefix))
    .sort((left, right) => left.date.localeCompare(right.date));
  document.getElementById("month-history-title").textContent = `${ui.currentMonth + 1}월 기록`;
  document.getElementById("month-history-count").textContent = `${records.length}건`;
  document.getElementById("month-history-body").innerHTML = records.length ? records.map(renderRecordRow).join("") : emptyState("이번 달 기록이 없습니다.");
}

function renderRecordRow(record) {
  return `
    <div class="row-item">
      <div class="row-main">
        <div class="row-title">${record.date} · ${record.type}</div>
        <div class="row-desc">사용량 ${leaveDelta(record.type)}일 · ${record.memo || "메모 없음"} · 등록 ${record.createdAt || record.updatedAt || "-"}</div>
      </div>
      <button class="action-link" type="button" data-record-delete="${record.id}">삭제</button>
    </div>
  `;
}

function renderSubRow(item) {
  return `
    <div class="row-item">
      <div class="row-main">
        <div class="row-title">${item.date} · ${item.type === "grant" ? "부여" : "사용"} ${Number(item.days).toFixed(1)}일</div>
        <div class="row-desc">${item.memo || "메모 없음"}</div>
      </div>
      <button class="action-link" type="button" data-sub-delete="${item.id}">삭제</button>
    </div>
  `;
}

function renderAlertItem(alert) {
  return `
    <div class="row-item">
      <div class="row-main">
        <div class="row-title">${alert.name} · ${alert.dept}</div>
        <div class="row-desc">${alert.metric} · ${alert.reason}</div>
      </div>
      <div class="row-item-actions">
        <span class="tag ${alert.tone}">${alert.badge}</span>
        <button class="action-link" type="button" data-manager-open="${alert.empId}">바로가기</button>
      </div>
    </div>
  `;
}

function buildDepartmentSummary(summaries) {
  const map = new Map();
  summaries.forEach((item) => {
    const key = item.employee.dept || "미지정";
    if (!map.has(key)) map.set(key, { total: 0, used: 0, count: 0 });
    const entry = map.get(key);
    entry.total += item.total;
    entry.used += item.used;
    entry.count += 1;
  });

  return Array.from(map.entries()).map(([dept, value]) => {
    const usage = value.total ? Math.round((value.used / value.total) * 100) : 0;
    const avgRemain = value.count ? round((value.total - value.used) / value.count) : 0;
    const riskCount = summaries.filter((item) => (item.employee.dept || "미지정") === dept && (item.alertLevel === "urgent" || item.alertLevel === "warning")).length;
    return `
      <div class="row-item">
        <div class="row-main">
          <div class="row-title">${dept}</div>
          <div class="row-desc">${value.count}명 · 위험 ${riskCount}명 · 평균 잔여 ${avgRemain.toFixed(1)}일</div>
          <div class="progress mini"><span style="width:${usage}%"></span></div>
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
        empId: item.employee.id,
        name: item.employee.name,
        dept: item.employee.dept || "부서 미지정",
        metric: `잔여 ${item.remain}일 / 사용률 ${item.usagePercent}%`,
        reason: "잔여 연차가 0일 이하입니다.",
        badge: "긴급",
        tone: "red"
      });
    } else if (item.expiryRisk) {
      alerts.push({
        empId: item.employee.id,
        name: item.employee.name,
        dept: item.employee.dept || "부서 미지정",
        metric: `잔여 ${item.remain}일 / 사용률 ${item.usagePercent}%`,
        reason: `${state.settings.warningMonth}월 이후 소멸 위험`,
        badge: "주의",
        tone: "amber"
      });
    }
    if (item.promotionNeeded) {
      alerts.push({
        empId: item.employee.id,
        name: item.employee.name,
        dept: item.employee.dept || "부서 미지정",
        metric: `잔여 ${item.remain}일 / 사용률 ${item.usagePercent}%`,
        reason: "연차 촉진 대상입니다.",
        badge: "촉진",
        tone: "amber"
      });
    }
  });
  return alerts;
}

function currentUser() {
  return employeeById(ui.selectedEmployeeId) || state.employees[0] || null;
}

function employeeById(id) {
  return state.employees.find((employee) => employee.id === id) || null;
}

function findEmployee(id) {
  return employeeById(id);
}

function recordsOnDate(empId, date) {
  return state.records.filter((record) => record.empId === empId && record.date === date);
}

function moveMonth(delta) {
  const next = new Date(ui.currentYear, ui.currentMonth + delta, 1);
  ui.currentYear = next.getFullYear();
  ui.currentMonth = next.getMonth();
  renderCalendarView();
  renderHistory();
}

function toggleRecordByDate(date) {
  const existing = state.records.find((record) => record.empId === ui.selectedEmployeeId && record.date === date && record.type === "연차");
  if (existing) {
    state.records = state.records.filter((record) => record.id !== existing.id);
    touchState(`연차 기록 삭제 ${date}`);
  } else {
    state.records.push({
      id: `r_${Date.now()}`,
      empId: ui.selectedEmployeeId,
      date,
      type: "연차",
      memo: "달력에서 등록"
    });
    touchState(`연차 기록 추가 ${date}`);
  }
  renderCalendarView();
  renderHistory();
  renderDashboard();
}

function latestRecord(empId, year) {
  return state.records
    .filter((record) => record.empId === empId && record.date.startsWith(String(year)))
    .sort((left, right) => right.date.localeCompare(left.date))[0] || null;
}

function employeeSummary(empId, year) {
  const employee = employeeById(empId);
  const total = getTotal(empId, year);
  const used = round(state.records
    .filter((record) => record.empId === empId && record.date.startsWith(String(year)))
    .reduce((sum, record) => sum + leaveDelta(record.type), 0));
  const remain = round(total - used);
  const usagePercent = total ? Math.min(100, Math.max(0, Math.round((used / total) * 100))) : 0;
  const expiryRisk = remain > 0 && new Date().getMonth() + 1 >= Number(state.settings.warningMonth || 10);
  const promotionNeeded = remain >= Number(state.settings.promotionMinDays || 5) && usagePercent <= Number(state.settings.promotionMaxUsagePercent || 40);
  const alertLevel = remain <= 0 ? "urgent" : expiryRisk || promotionNeeded ? "warning" : "safe";
  const alertLabel = remain <= 0 ? "소진" : expiryRisk ? "소멸 위험" : promotionNeeded ? "촉진 필요" : "안정";
  const halfCount = state.records
    .filter((record) => record.empId === empId && record.date.startsWith(String(year)) && record.type !== "연차").length;
  return { employee, total, used, remain, usagePercent, expiryRisk, promotionNeeded, alertLevel, alertLabel, halfCount };
}

function leaveDelta(type) {
  if (type === "반차") return 0.5;
  if (type === "반반차") return 0.25;
  return 1;
}

function getTotal(empId, year) {
  const manual = state.totals[`${empId}_${year}`];
  if (manual !== undefined && manual !== null && manual !== "") return Number(manual);
  const employee = employeeById(empId);
  return accrual(employee?.joinDate, year, employee?.fiscalYearMonth || 1);
}

function accrual(joinDate, year, fiscalYearMonth = 1) {
  if (!joinDate) return 0;
  const join = new Date(joinDate);
  const periodStart = new Date(year, Number(fiscalYearMonth || 1) - 1, 1);
  const diffYears = periodStart.getFullYear() - join.getFullYear() - (periodStart < new Date(join.getFullYear() + (periodStart.getMonth() < join.getMonth() ? 1 : 0), join.getMonth(), join.getDate()) ? 1 : 0);
  if (diffYears < 1) return 11;
  return Math.min(25, 15 + Math.max(0, Math.floor((diffYears - 1) / 2)));
}

function calcRetirementPayout(empId, year) {
  const employee = employeeById(empId);
  const summary = employeeSummary(empId, year);
  const monthlyPay = Number(employee?.monthlyBasePay || 0);
  const workHours = Number(employee?.workHoursPerDay || state.settings.defaultWorkHoursPerDay || 8);
  const monthlyStandardHours = Number(state.settings.monthlyStandardHours || 209);
  const unitPrice = Number(employee?.leaveUnitPrice || 0) || (monthlyPay && workHours ? ((monthlyPay / monthlyStandardHours) * workHours) : 0);
  const averageDailyWage = Number(employee?.averageDailyWage || 0);
  const effectiveUnit = Math.max(unitPrice, averageDailyWage || 0);
  return {
    remainingDays: summary.remain,
    formula: effectiveUnit ? `${summary.remain.toFixed(2)}일 × ${Math.round(effectiveUnit).toLocaleString("ko-KR")}원` : "1일 정산 단가 미입력",
    amount: round(summary.remain * effectiveUnit),
    note: effectiveUnit ? "내부 참고 계산값입니다." : "월 통상임금/평균임금/정산단가 입력 후 확인하세요."
  };
}

function getSyncPrefs() {
  return Object.assign({ autoSave: false }, readJsonStorage(STORAGE_KEYS.syncPrefs) || {});
}

function saveSyncPrefs(prefs) {
  localStorage.setItem(STORAGE_KEYS.syncPrefs, JSON.stringify(prefs));
}

function touchState(action) {
  state.updatedAt = formatDateTime(new Date());
  appendAudit(action);
  localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify(state));
  queueAutoSave();
  renderSyncStatus();
}

function appendAudit(action) {
  state.auditLogs = state.auditLogs || [];
  state.auditLogs.push({ action, at: formatDateTime(new Date()) });
  if (state.auditLogs.length > 200) state.auditLogs = state.auditLogs.slice(-200);
}

function queueAutoSave() {
  const prefs = getSyncPrefs();
  if (!prefs.autoSave) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveSharedNow(); }, 900);
}

async function saveSharedNow() {
  if (saveInFlight) {
    saveQueued = true;
    return;
  }
  const token = localStorage.getItem(STORAGE_KEYS.token);
  if (!token) {
    setSyncStatus("error", "토큰없음", "GitHub 토큰이 없어 공유 저장을 할 수 없습니다.");
    renderSyncStatus();
    return;
  }

  saveInFlight = true;
  setSyncStatus("saving", "저장중", "GitHub에 공유 데이터를 저장하고 있습니다.");
  renderSyncStatus();

  try {
    const body = {
      message: `Update shared data ${new Date().toISOString()}`,
      content: btoa(unescape(encodeURIComponent(JSON.stringify(state, null, 2)))),
      branch: state.repo.branch,
      sha: githubSha || undefined
    };
    const response = await fetch(githubApiUrl(state.repo.owner, state.repo.name, state.repo.dataPath), {
      method: "PUT",
      headers: {
        ...githubHeaders(true),
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error(`저장 실패 (${response.status})`);
    const payload = await response.json();
    githubSha = payload.content?.sha || githubSha;
    lastSavedAt = formatDateTime(new Date());
    archiveSnapshot("자동/수동 저장");
    setSyncStatus("success", "완료", "공유 JSON 저장이 완료되었습니다.");
  } catch (error) {
    setSyncStatus("error", "오류", error.message || "저장 중 오류가 발생했습니다.");
  } finally {
    saveInFlight = false;
    renderSyncStatus();
    if (saveQueued) {
      saveQueued = false;
      saveSharedNow();
    }
  }
}

async function reloadFromRemote() {
  setSyncStatus("saving", "새로고침", "공유 데이터를 다시 불러오고 있습니다.");
  renderSyncStatus();
  try {
    const response = await fetch(`./data/app-data.json?ts=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`공유 파일 로딩 실패 (${response.status})`);
    state = await response.json();
    normalizeState();
    initializeSelections();
    lastLoadedAt = formatDateTime(new Date());
    setSyncStatus("success", "공유", "공유 JSON 데이터를 다시 불러왔습니다.");
    await refreshGithubSha();
    renderAll();
  } catch (error) {
    setSyncStatus("error", "오류", error.message || "새로고침 중 오류가 발생했습니다.");
    renderSyncStatus();
  }
}

function updateRepoFields() {
  state.repo.owner = document.getElementById("repo-owner").value.trim() || state.repo.owner;
  state.repo.name = document.getElementById("repo-name").value.trim() || state.repo.name;
  state.repo.branch = document.getElementById("repo-branch").value.trim() || state.repo.branch;
  state.repo.dataPath = document.getElementById("repo-path").value.trim() || state.repo.dataPath;
  touchState("GitHub 연결 정보 수정");
}

function saveToken() {
  const token = document.getElementById("github-token").value.trim();
  if (!token) {
    alert("토큰을 입력하세요.");
    return;
  }
  localStorage.setItem(STORAGE_KEYS.token, token);
  setSyncStatus("success", "토큰저장", "GitHub 토큰을 로컬 브라우저에 저장했습니다.");
  renderSyncStatus();
}

function clearToken() {
  localStorage.removeItem(STORAGE_KEYS.token);
  document.getElementById("github-token").value = "";
  setSyncStatus("idle", "토큰삭제", "GitHub 토큰을 삭제했습니다.");
  renderSyncStatus();
}

async function saveAdminPassword() {
  const raw = document.getElementById("admin-password").value;
  if (!raw) {
    alert("비밀번호를 입력하세요.");
    return;
  }
  const hash = await digestText(raw);
  localStorage.setItem(STORAGE_KEYS.adminPw, hash);
  document.getElementById("admin-password").value = "";
  alert("관리자 비밀번호를 저장했습니다.");
  renderAll();
}

function clearAdminPassword() {
  localStorage.removeItem(STORAGE_KEYS.adminPw);
  document.getElementById("admin-password").value = "";
  alert("관리자 비밀번호를 삭제했습니다.");
  renderAll();
}

function saveOpsMemo() {
  state.settings.opsMemo = document.getElementById("ops-memo").value.trim();
  touchState("운영 메모 저장");
  renderDashboard();
}

function archiveSnapshot(reason) {
  const archive = getArchiveSnapshots();
  archive.push({
    savedAt: formatDateTime(new Date()),
    reason,
    state: JSON.parse(JSON.stringify(state))
  });
  while (archive.length > 30) archive.shift();
  localStorage.setItem(STORAGE_KEYS.archive, JSON.stringify(archive));
}

function getArchiveSnapshots() {
  return readJsonStorage(STORAGE_KEYS.archive) || [];
}

function downloadCurrentSnapshot() {
  downloadJson(`guro_huga_snapshot_${Date.now()}.json`, state);
}

function restoreLastSnapshot() {
  const archive = getArchiveSnapshots();
  const last = archive[archive.length - 1];
  if (!last) {
    alert("복원할 스냅샷이 없습니다.");
    return;
  }
  if (!confirm(`${last.savedAt} 스냅샷으로 복원할까요?`)) return;
  state = JSON.parse(JSON.stringify(last.state));
  normalizeState();
  initializeSelections();
  touchState("최근 스냅샷 복원");
  renderAll();
}

function downloadBackup() {
  downloadJson(`guro_huga_backup_${Date.now()}.json`, state);
}

function importBackupSnapshot(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (loadEvent) => {
    try {
      const parsed = JSON.parse(loadEvent.target.result);
      state = parsed;
      normalizeState();
      initializeSelections();
      touchState("백업 복원 적용");
      renderAll();
      alert("백업 복원을 적용했습니다.");
    } catch (error) {
      alert(`백업 복원 오류: ${error.message}`);
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file, "utf-8");
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function openRecordModal() {
  openModal("휴가 기록 추가", "직원과 날짜를 선택해 휴가를 등록합니다.", `
    <label class="field-label" for="record-emp">직원</label>
    <select id="record-emp" class="field">${state.employees.map((employee) => `<option value="${employee.id}" ${employee.id === ui.selectedEmployeeId ? "selected" : ""}>${employee.name}</option>`).join("")}</select>
    <label class="field-label" for="record-date">날짜</label>
    <input id="record-date" class="field" type="date" value="${formatDateKey(new Date())}">
    <label class="field-label" for="record-type">구분</label>
    <select id="record-type" class="field">
      <option value="연차">연차</option>
      <option value="반차">반차</option>
      <option value="반반차">반반차</option>
    </select>
    <label class="field-label" for="record-memo">메모</label>
    <input id="record-memo" class="field" type="text" placeholder="예: 개인사유">
    <button id="record-save-btn" class="btn primary" type="button">저장</button>
  `);
  document.getElementById("record-save-btn").addEventListener("click", saveRecordFromModal);
}

function saveRecordFromModal() {
  const empId = document.getElementById("record-emp").value;
  const date = document.getElementById("record-date").value;
  const type = document.getElementById("record-type").value;
  const memo = document.getElementById("record-memo").value.trim();
  if (!empId || !date) {
    alert("직원과 날짜를 입력하세요.");
    return;
  }
  state.records.push({ id: `r_${Date.now()}`, empId, date, type, memo });
  touchState(`휴가 기록 추가 ${date}`);
  closeModal();
  renderAll();
}

function openEmployeeModal(empId = "") {
  const employee = employeeById(empId) || {
    id: `e_${Date.now()}`,
    name: "",
    dept: "",
    role: "",
    joinDate: "",
    color: COLORS[state.employees.length % COLORS.length],
    photo: ""
  };
  openModal(empId ? "직원 정보 수정" : "직원 추가", "직원 기본 정보를 등록합니다.", `
    <input id="employee-id" type="hidden" value="${employee.id}">
    <label class="field-label" for="employee-name">이름</label>
    <input id="employee-name" class="field" type="text" value="${employee.name}">
    <label class="field-label" for="employee-dept">부서</label>
    <input id="employee-dept" class="field" type="text" value="${employee.dept}">
    <label class="field-label" for="employee-role">직책</label>
    <input id="employee-role" class="field" type="text" value="${employee.role}">
    <label class="field-label" for="employee-join">입사일</label>
    <input id="employee-join" class="field" type="date" value="${employee.joinDate}">
    <label class="field-label" for="employee-color">컬러</label>
    <input id="employee-color" class="field" type="color" value="${employee.color}">
    <label class="field-label" for="employee-photo">프로필 이미지 URL</label>
    <input id="employee-photo" class="field" type="text" value="${employee.photo || ""}" placeholder="https://...">
    <label class="field-label" for="employee-photo-file">또는 이미지 파일 선택</label>
    <input id="employee-photo-file" class="field" type="file" accept="image/*">
    <button id="employee-save-btn" class="btn primary" type="button">저장</button>
  `);
  document.getElementById("employee-save-btn").addEventListener("click", saveEmployeeFromModal);
}

function saveEmployeeFromModal() {
  const empId = document.getElementById("employee-id").value;
  const existing = employeeById(empId);
  const payload = {
    id: empId,
    name: document.getElementById("employee-name").value.trim(),
    dept: document.getElementById("employee-dept").value.trim(),
    role: document.getElementById("employee-role").value.trim(),
    joinDate: document.getElementById("employee-join").value,
    color: document.getElementById("employee-color").value,
    photo: document.getElementById("employee-photo").value.trim()
  };
  const file = document.getElementById("employee-photo-file").files?.[0];
  if (!payload.name) {
    alert("이름을 입력하세요.");
    return;
  }
  const finish = (photoValue) => {
    payload.photo = photoValue || payload.photo;
    if (existing) {
      Object.assign(existing, payload);
      touchState(`직원 수정 ${payload.name}`);
    } else {
      state.employees.push(payload);
      state.perms[payload.id] = state.perms[payload.id] || { grade: "normal", menus: {} };
      touchState(`직원 추가 ${payload.name}`);
    }
    closeModal();
    initializeSelections();
    renderAll();
  };

  if (file) {
    const reader = new FileReader();
    reader.onload = () => finish(reader.result);
    reader.readAsDataURL(file);
    return;
  }
  finish(payload.photo);
}

function deleteEmployee(empId) {
  const employee = employeeById(empId);
  if (!employee) return;
  if (!confirm(`${employee.name} 직원을 삭제할까요? 관련 휴가 기록도 함께 삭제됩니다.`)) return;
  state.employees = state.employees.filter((item) => item.id !== empId);
  state.records = state.records.filter((item) => item.empId !== empId);
  state.subLeaves = state.subLeaves.filter((item) => item.empId !== empId);
  state.specialLeaves = state.specialLeaves.filter((item) => item.empId !== empId);
  delete state.perms[empId];
  Object.keys(state.totals).forEach((key) => {
    if (key.startsWith(`${empId}_`)) delete state.totals[key];
  });
  Object.keys(state.hrRecords).forEach((key) => {
    if (key.startsWith(`${empId}_`)) delete state.hrRecords[key];
  });
  touchState(`직원 삭제 ${employee.name}`);
  initializeSelections();
  renderAll();
}

function openSubLeaveModal() {
  openModal("대체휴가 등록", "직원별 대체휴가 부여 또는 사용을 기록합니다.", `
    <label class="field-label" for="sub-emp">직원</label>
    <select id="sub-emp" class="field">${state.employees.map((employee) => `<option value="${employee.id}" ${employee.id === ui.subEmployeeId ? "selected" : ""}>${employee.name}</option>`).join("")}</select>
    <label class="field-label" for="sub-type">구분</label>
    <select id="sub-type" class="field"><option value="grant">부여</option><option value="use">사용</option></select>
    <label class="field-label" for="sub-date">날짜</label>
    <input id="sub-date" class="field" type="date" value="${formatDateKey(new Date())}">
    <label class="field-label" for="sub-days">일수</label>
    <input id="sub-days" class="field" type="number" min="0.5" step="0.5" value="1">
    <label class="field-label" for="sub-memo">메모</label>
    <input id="sub-memo" class="field" type="text">
    <button id="sub-save-btn" class="btn primary" type="button">저장</button>
  `);
  document.getElementById("sub-save-btn").addEventListener("click", saveSubLeaveFromModal);
}

function saveSubLeaveFromModal() {
  const payload = {
    id: `sub_${Date.now()}`,
    empId: document.getElementById("sub-emp").value,
    type: document.getElementById("sub-type").value,
    date: document.getElementById("sub-date").value,
    days: Number(document.getElementById("sub-days").value || 0),
    memo: document.getElementById("sub-memo").value.trim()
  };
  if (!payload.empId || !payload.date || !payload.days) {
    alert("필수값을 입력하세요.");
    return;
  }
  state.subLeaves.push(payload);
  touchState(`대체휴가 ${payload.type === "grant" ? "부여" : "사용"}`);
  closeModal();
  renderSubLeaves();
}

function openBulkSubLeaveModal() {
  openModal("대체휴가 일괄 부여", "모든 직원에게 같은 대체휴가를 일괄 부여합니다.", `
    <label class="field-label" for="bulk-sub-date">부여일</label>
    <input id="bulk-sub-date" class="field" type="date" value="${formatDateKey(new Date())}">
    <label class="field-label" for="bulk-sub-days">일수</label>
    <input id="bulk-sub-days" class="field" type="number" min="0.5" step="0.5" value="1">
    <label class="field-label" for="bulk-sub-memo">메모</label>
    <input id="bulk-sub-memo" class="field" type="text" placeholder="예: 법정공휴일 근무 보상">
    <div class="button-row">
      <button id="bulk-select-all" class="btn ghost small" type="button">전체 선택</button>
      <button id="bulk-clear-all" class="btn ghost small" type="button">전체 해제</button>
    </div>
    <div id="bulk-sub-list" class="stack-list compact">${state.employees.map((employee) => `
      <label class="checkbox-row"><input type="checkbox" data-bulk-sub-emp="${employee.id}" checked><span>${employee.name}</span></label>
    `).join("")}</div>
    <button id="bulk-sub-save-btn" class="btn primary" type="button">일괄 저장</button>
  `);
  document.getElementById("bulk-select-all").addEventListener("click", () => {
    document.querySelectorAll("[data-bulk-sub-emp]").forEach((checkbox) => { checkbox.checked = true; });
  });
  document.getElementById("bulk-clear-all").addEventListener("click", () => {
    document.querySelectorAll("[data-bulk-sub-emp]").forEach((checkbox) => { checkbox.checked = false; });
  });
  document.getElementById("bulk-sub-save-btn").addEventListener("click", saveBulkSubLeaves);
}

function saveBulkSubLeaves() {
  const date = document.getElementById("bulk-sub-date").value;
  const days = Number(document.getElementById("bulk-sub-days").value || 0);
  const memo = document.getElementById("bulk-sub-memo").value.trim();
  const targetIds = Array.from(document.querySelectorAll("[data-bulk-sub-emp]:checked")).map((checkbox) => checkbox.dataset.bulkSubEmp);
  if (!date || !days || !targetIds.length) {
    alert("부여일, 일수, 대상을 확인하세요.");
    return;
  }
  targetIds.forEach((empId, index) => {
    state.subLeaves.push({ id: `sub_bulk_${Date.now()}_${index}`, empId, type: "grant", date, days, memo });
  });
  touchState(`대체휴가 일괄 부여 ${targetIds.length}명`);
  closeModal();
  renderSubLeaves();
}

function deleteSubLeave(id) {
  if (!confirm("이 대체휴가 기록을 삭제할까요?")) return;
  state.subLeaves = state.subLeaves.filter((item) => item.id !== id);
  touchState("대체휴가 기록 삭제");
  renderSubLeaves();
}

function openSpecialLeaveModal() {
  openModal("특별휴가 등록", "경조사/병가/포상휴가 등을 등록합니다.", `
    <label class="field-label" for="special-emp">직원</label>
    <select id="special-emp" class="field">${state.employees.map((employee) => `<option value="${employee.id}" ${employee.id === ui.specialEmployeeId ? "selected" : ""}>${employee.name}</option>`).join("")}</select>
    <label class="field-label" for="special-action">구분</label>
    <select id="special-action" class="field"><option value="grant">부여</option><option value="use">사용</option></select>
    <label class="field-label" for="special-reason">유형</label>
    <select id="special-reason" class="field">
      <option value="경조사">경조사</option>
      <option value="병가">병가</option>
      <option value="포상휴가">포상휴가</option>
      <option value="생일반차">생일반차</option>
      <option value="기타휴가">기타휴가</option>
    </select>
    <label class="field-label" for="special-date">날짜</label>
    <input id="special-date" class="field" type="date" value="${formatDateKey(new Date())}">
    <label class="field-label" for="special-days">일수</label>
    <input id="special-days" class="field" type="number" min="0.5" step="0.5" value="1">
    <label class="field-label" for="special-evidence">증빙</label>
    <input id="special-evidence" class="field" type="text" placeholder="예: 경조휴가 신청서">
    <label class="field-label" for="special-memo">메모</label>
    <input id="special-memo" class="field" type="text">
    <button id="special-save-btn" class="btn primary" type="button">저장</button>
  `);
  document.getElementById("special-save-btn").addEventListener("click", saveSpecialLeaveFromModal);
}

function saveSpecialLeaveFromModal() {
  const payload = {
    id: `special_${Date.now()}`,
    empId: document.getElementById("special-emp").value,
    action: document.getElementById("special-action").value,
    reason: document.getElementById("special-reason").value,
    date: document.getElementById("special-date").value,
    days: Number(document.getElementById("special-days").value || 0),
    evidence: document.getElementById("special-evidence").value.trim(),
    memo: document.getElementById("special-memo").value.trim()
  };
  if (!payload.empId || !payload.date || !payload.days) {
    alert("필수값을 입력하세요.");
    return;
  }
  state.specialLeaves.push(payload);
  touchState(`특별휴가 ${payload.reason} ${payload.action === "grant" ? "부여" : "사용"}`);
  closeModal();
  renderSpecialLeaves();
}

function deleteSpecialLeave(id) {
  if (!confirm("이 특별휴가 기록을 삭제할까요?")) return;
  state.specialLeaves = state.specialLeaves.filter((item) => item.id !== id);
  touchState("특별휴가 기록 삭제");
  renderSpecialLeaves();
}

function saveSettingsFromView() {
  const employee = employeeById(ui.settingsEmployeeId);
  if (!employee) return;
  employee.joinDate = document.getElementById("join-date").value;
  employee.fiscalYearMonth = Number(document.getElementById("fiscal-year-month").value || 1);
  employee.resignationDate = document.getElementById("resignation-date").value;
  employee.monthlyBasePay = Number(document.getElementById("monthly-base-pay").value || 0);
  employee.workHoursPerDay = Number(document.getElementById("work-hours-per-day").value || state.settings.defaultWorkHoursPerDay || 8);
  employee.leaveUnitPrice = Number(document.getElementById("leave-unit-price").value || 0);
  employee.averageDailyWage = Number(document.getElementById("average-daily-wage").value || 0);
  state.settings.monthlyStandardHours = Number(document.getElementById("monthly-standard-hours").value || 209);
  state.settings.employmentRules = document.getElementById("employment-rules").value.trim();
  document.querySelectorAll("[data-total-year]").forEach((input) => {
    state.totals[`${input.dataset.totalEmp}_${input.dataset.totalYear}`] = Number(input.value || 0);
  });
  touchState("연차 설정 저장");
  renderSettings();
}

function addSettingYear() {
  const year = prompt("추가할 연도를 입력하세요 (예: 2027)");
  if (!year) return;
  const numericYear = Number(year);
  if (!numericYear) return;
  state.totals[`${ui.settingsEmployeeId}_${numericYear}`] = state.totals[`${ui.settingsEmployeeId}_${numericYear}`] || 0;
  renderSettings();
}

function saveHrInfoFromView() {
  const admin = isCurrentAdmin();
  state.employees.forEach((employee) => {
    const record = getHrRecord(employee.id, ui.hrYear);
    record.dept = document.querySelector(`[data-hr-dept="${employee.id}"]`)?.value.trim() || "";
    record.role = document.querySelector(`[data-hr-role="${employee.id}"]`)?.value.trim() || "";
    record.joinDate = document.querySelector(`[data-hr-join="${employee.id}"]`)?.value || "";
    record.stepMonth = document.querySelector(`[data-hr-step="${employee.id}"]`)?.value || "";
    record.promotionMonth = document.querySelector(`[data-hr-promotion="${employee.id}"]`)?.value || "";
    record.careerYears = Number(document.querySelector(`[data-hr-career="${employee.id}"]`)?.value || 0);
    record.certifications = document.querySelector(`[data-hr-cert="${employee.id}"]`)?.value.trim() || "";
    record.workType = document.querySelector(`[data-hr-work="${employee.id}"]`)?.value.trim() || "";
    record.status = document.querySelector(`[data-hr-status="${employee.id}"]`)?.value.trim() || "재직";
    employee.dept = record.dept || employee.dept;
    employee.role = record.role || employee.role;
    employee.joinDate = record.joinDate || employee.joinDate;
    if (admin) {
      employee.birthDate = document.querySelector(`[data-hr-birth="${employee.id}"]`)?.value || employee.birthDate || "";
      employee.personalInfo = document.querySelector(`[data-hr-personal="${employee.id}"]`)?.value.trim() || "";
    }
    state.hrRecords[`${employee.id}_${ui.hrYear}`] = record;
  });
  touchState(admin ? "인사정보 저장" : "인사정보 저장(관리자 민감정보 제외)");
  renderHrView();
}

function savePayrollInfoFromView() {
  const year = ui.hrYear;
  state.employees.forEach((employee) => {
    const record = getHrRecord(employee.id, year);
    record.payGrade = document.querySelector(`[data-pay-grade="${employee.id}"]`)?.value.trim() || "";
    record.payLevel = document.querySelector(`[data-pay-level="${employee.id}"]`)?.value.trim() || "";
    record.payStep = Number(document.querySelector(`[data-pay-step="${employee.id}"]`)?.value || 0);
    const calculatedPay = calculatePayByGrade(record.payGrade, record.payLevel, record.payStep);
    const inputSalary = Number(document.querySelector(`[data-pay-salary="${employee.id}"]`)?.value || 0);
    record.monthlySalary = inputSalary || calculatedPay || 0;
    record.taxMode = document.querySelector(`[data-pay-tax-mode="${employee.id}"]`)?.value || "hometax";
    record.manualTaxRate = Number(document.querySelector(`[data-pay-tax-rate="${employee.id}"]`)?.value || 0);
    const autoTax = calculateWithholdingTax(record.monthlySalary, Number(record.taxFamilyCount || 1), Number(record.taxChildCount || 0), Number(record.taxRatePercent || 100));
    const manualTax = record.monthlySalary * (record.manualTaxRate / 100);
    record.withholdingTax = Math.round(record.taxMode === "manual" ? manualTax : autoTax);
    record.socialInsurance = Number(document.querySelector(`[data-pay-insurance="${employee.id}"]`)?.value || 0);
    record.spouseCount = Number(document.querySelector(`[data-pay-spouse="${employee.id}"]`)?.value || 0);
    record.childCount = Number(document.querySelector(`[data-pay-child="${employee.id}"]`)?.value || 0);
    record.otherDependentCount = Number(document.querySelector(`[data-pay-other="${employee.id}"]`)?.value || 0);
    record.adjustmentAllowance = Number(document.querySelector(`[data-pay-adjust="${employee.id}"]`)?.value || 0);
    record.overtimeHours = Number(document.querySelector(`[data-pay-ot="${employee.id}"]`)?.value || 0);
    record.holidayOvertimeHours = Number(document.querySelector(`[data-pay-hot="${employee.id}"]`)?.value || 0);
    const allowancePack = calculateAllowancePackage(record, record.monthlySalary, record.allowanceFlags);
    record.totalAllowance = Math.round(allowancePack.totalAllowance);
    record.ordinaryWage = Math.round(allowancePack.ordinaryWage);
    record.overtimeAllowance = Math.round(allowancePack.overtimeAllowance);
    record.severanceEstimate = Number(document.querySelector(`[data-pay-severance="${employee.id}"]`)?.value || 0);
    record.mandatoryEduDone = !!document.querySelector(`[data-pay-edu="${employee.id}"]`)?.checked;
    state.hrRecords[`${employee.id}_${year}`] = record;
  });
  touchState("급여/세무/퇴직금 정보 저장");
  renderHrView();
}

function renderPayGradeTable() {
  const rows = state.settings.payGradeTable || [];
  document.getElementById("pay-grade-body").innerHTML = rows.map((row, index) => `
    <tr>
      <td><input class="field" type="text" value="${row.grade || ""}" data-grade-name="${index}"></td>
      <td><input class="field" type="text" value="${row.level || ""}" data-grade-level="${index}"></td>
      <td><input class="field" type="number" min="1" step="1" value="${row.step || 1}" data-grade-step="${index}"></td>
      <td><input class="field" type="number" min="0" step="10000" value="${row.basePay || 0}" data-grade-pay="${index}"></td>
      <td><button class="btn ghost small" type="button" data-grade-delete="${index}">삭제</button></td>
    </tr>
  `).join("");

  document.querySelectorAll("[data-grade-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      state.settings.payGradeTable.splice(Number(button.dataset.gradeDelete), 1);
      renderPayGradeTable();
    });
  });

  document.getElementById("hometax-rate").value = state.settings.hometaxRate || 0;
  document.getElementById("local-tax-rate").value = state.settings.localTaxRate ?? 10;
}

function addPayGradeRow() {
  state.settings.payGradeTable.push({ grade: "", level: "", step: 1, basePay: 0 });
  renderPayGradeTable();
}

function savePayGradeTable() {
  state.settings.payGradeTable = Array.from(document.querySelectorAll("#pay-grade-body tr")).map((row, index) => ({
    grade: document.querySelector(`[data-grade-name="${index}"]`)?.value.trim() || "",
    level: document.querySelector(`[data-grade-level="${index}"]`)?.value.trim() || "",
    step: Number(document.querySelector(`[data-grade-step="${index}"]`)?.value || 0),
    basePay: Number(document.querySelector(`[data-grade-pay="${index}"]`)?.value || 0)
  })).filter((item) => item.step > 0 && item.basePay > 0 && (item.grade || item.level));
  state.settings.hometaxRate = Number(document.getElementById("hometax-rate").value || 0);
  state.settings.localTaxRate = Number(document.getElementById("local-tax-rate").value || 10);
  state.settings.allowanceRules = {
    meal: Number(document.getElementById("allow-meal").value || 0),
    manager: Number(document.getElementById("allow-manager").value || 0),
    spouse: Number(document.getElementById("allow-spouse").value || 0),
    child1: Number(document.getElementById("allow-child1").value || 0),
    child2: Number(document.getElementById("allow-child2").value || 0),
    child3Plus: Number(document.getElementById("allow-child3").value || 0),
    otherDependent: Number(document.getElementById("allow-other").value || 0),
    defaultAdjustment: Number(document.getElementById("allow-adjustment").value || 0)
  };
  touchState("임금 테이블/제수당 저장");
  renderHrView();
}

function defaultSeoulPayGradeTable2026() {
  return [
    { grade: "일반직", level: "1급", step: 1, basePay: 4200000 },
    { grade: "일반직", level: "2급", step: 1, basePay: 3650000 },
    { grade: "일반직", level: "3급", step: 1, basePay: 3200000 },
    { grade: "일반직", level: "4급", step: 1, basePay: 2850000 },
    { grade: "일반직", level: "5급", step: 1, basePay: 2550000 },
    { grade: "관리직", level: "3급", step: 1, basePay: 3400000 },
    { grade: "기능직", level: "1급", step: 1, basePay: 2600000 }
  ];
}

function defaultAllowanceRules() {
  return {
    meal: 140000,
    manager: 220000,
    spouse: 40000,
    child1: 50000,
    child2: 80000,
    child3Plus: 120000,
    otherDependent: 20000,
    defaultAdjustment: 0
  };
}

function defaultBirthdayRule() {
  return {
    base: "재직자 중 생일이 속한 달에 반차 0.5일 자동 부여",
    days: 0.5,
    minMonths: 1
  };
}

function saveBirthdayRule() {
  state.settings.birthdayRule = {
    base: document.getElementById("birthday-grant-rule").value.trim() || defaultBirthdayRule().base,
    days: Number(document.getElementById("birthday-grant-days").value || 0.5),
    minMonths: Number(document.getElementById("birthday-min-months").value || 1)
  };
  touchState("생일반차 규칙 저장");
  renderHrView();
}

function runBirthdayHalfDayGrant() {
  const rule = state.settings.birthdayRule || defaultBirthdayRule();
  let granted = 0;
  state.employees.forEach((employee, index) => {
    if (!employee.birthDate) return;
    const join = employee.joinDate ? new Date(employee.joinDate) : null;
    if (join) {
      const serviceMonths = (ui.hrYear - join.getFullYear()) * 12 + (new Date().getMonth() - join.getMonth());
      if (serviceMonths < Number(rule.minMonths || 0)) return;
    }
    const birthday = new Date(employee.birthDate);
    const month = birthday.getMonth() + 1;
    const date = `${ui.hrYear}-${pad(month)}-01`;
    if (state.specialLeaves.some((item) => item.empId === employee.id && item.reason === "생일반차" && item.date.startsWith(`${ui.hrYear}-${pad(month)}`))) return;
    state.specialLeaves.push({
      id: `birthday_${ui.hrYear}_${employee.id}_${index}`,
      empId: employee.id,
      action: "grant",
      reason: "생일반차",
      days: Number(rule.days || 0.5),
      date,
      evidence: "생일반차 자동부여",
      memo: rule.base
    });
    granted += 1;
  });
  touchState(`생일반차 자동부여 ${granted}명`);
  renderHrView();
  renderSpecialLeaves();
  alert(`생일반차 자동부여 완료: ${granted}명`);
}

async function loadLaborRule() {
  const year = Number(document.getElementById("labor-rule-year").value || state.settings.activeLaborRuleYear || 2026);
  try {
    const response = await fetch(`./rules/labor/${year}.json?ts=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`룰 파일 로딩 실패 (${response.status})`);
    const payload = await response.json();
    state.settings.laborRuleCache = state.settings.laborRuleCache || {};
    state.settings.laborRuleCache[year] = payload;
    state.settings.laborRuleLog = `${year}년 룰 로드 완료\n${payload.summary || "요약 없음"}`;
    renderHrView();
  } catch (error) {
    state.settings.laborRuleLog = `로드 실패: ${error.message}`;
    renderHrView();
  }
}

function activateLaborRuleYear() {
  const year = Number(document.getElementById("labor-rule-year").value || 2026);
  state.settings.activeLaborRuleYear = year;
  touchState(`법령 룰 연도 활성화 ${year}`);
  renderHrView();
}

function defaultWelfareStandard() {
  return {
    name: "서울시 사회복지시설 인사·노무 기준 템플릿",
    weeklyHours: 40,
    retirementNote: "퇴직금은 근로기준법/근로자퇴직급여보장법 및 시설 운영지침 최신판을 기준으로 산정",
    educationNote: "직장 내 성희롱 예방, 장애인 인식개선, 개인정보보호, 산업안전보건 등 법정의무교육 이수 관리 필요"
  };
}

function isCurrentAdmin() {
  const current = currentUser();
  if (!current) return false;
  return (state.perms[current.id]?.grade || "normal") === "admin";
}

function getHrRecord(empId, year) {
  const employee = employeeById(empId) || {};
  const key = `${empId}_${year}`;
  state.hrRecords[key] = Object.assign({
    dept: employee.dept || "",
    role: employee.role || "",
    joinDate: employee.joinDate || "",
    promotionMonth: "",
    stepMonth: "",
    careerYears: "",
    certifications: "",
    workType: "",
    status: "재직",
    monthlySalary: 0,
    payGrade: "",
    payLevel: "",
    payStep: "",
    taxMode: "hometax",
    manualTaxRate: 0,
    withholdingTax: 0,
    socialInsurance: 0,
    spouseCount: 0,
    childCount: 0,
    otherDependentCount: 0,
    taxFamilyCount: 1,
    taxChildCount: 0,
    taxRatePercent: 100,
    adjustmentAllowance: 0,
    allowanceFlags: { meal: true, manager: true, family: true, adjustment: true, overtime: true },
    overtimeHours: 0,
    holidayOvertimeHours: 0,
    totalAllowance: 0,
    ordinaryWage: 0,
    overtimeAllowance: 0,
    severanceEstimate: 0,
    mandatoryEduDone: false
  }, state.hrRecords[key] || {});
  return state.hrRecords[key];
}

function defaultEmploymentRules() {
  return [
    "1. 회계년도 기준 연차는 설정된 시작 월을 기준으로 계산합니다.",
    "2. 입사일 기준 자동 계산값이 기본값이며, 연도별 일수는 수동으로 조정할 수 있습니다.",
    "3. 대체휴가는 관리자가 부여하며 사용 차감은 개별 이력으로 관리합니다.",
    "4. 퇴사 정산 계산은 내부 참고용이며 실제 급여 정산 전 인사/노무 검토가 필요합니다.",
    "5. 퇴사자 발생 시 미사용 연차와 1일 정산 단가를 함께 확인합니다."
  ].join("\n");
}

async function digestText(text) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function confirmAdminAccess() {
  const savedHash = localStorage.getItem(STORAGE_KEYS.adminPw);
  if (!savedHash) return true;
  return false;
}

function openModal(title, subtitle, bodyHtml) {
  document.getElementById("modal-title").textContent = title;
  document.getElementById("modal-subtitle").textContent = subtitle;
  document.getElementById("modal-body").innerHTML = bodyHtml;
  document.getElementById("modal-overlay").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modal-overlay").classList.add("hidden");
  document.getElementById("modal-body").innerHTML = "";
}

function exportExcelSnapshot() {
  if (typeof XLSX === "undefined") {
    alert("엑셀 라이브러리를 불러오지 못했습니다.");
    return;
  }
  const workbook = XLSX.utils.book_new();
  const employeeRows = state.employees.map((employee) => ({
    직원ID: employee.id,
    이름: employee.name,
    부서: employee.dept,
    직책: employee.role,
    입사일: employee.joinDate,
    회계년도시작월: employee.fiscalYearMonth,
    퇴사일: employee.resignationDate,
    월통상임금: employee.monthlyBasePay,
    일근로시간: employee.workHoursPerDay,
    일정산단가: employee.leaveUnitPrice,
    일평균임금: employee.averageDailyWage,
    프로필이미지: employee.photo || ""
  }));
  const recordRows = state.records.map((record) => ({
    ID: record.id,
    직원ID: record.empId,
    날짜: record.date,
    구분: record.type,
    메모: record.memo
  }));
  const subRows = state.subLeaves.map((item) => ({
    ID: item.id,
    직원ID: item.empId,
    처리: item.type,
    날짜: item.date,
    일수: item.days,
    메모: item.memo
  }));
  const specialRows = state.specialLeaves.map((item) => ({
    ID: item.id,
    직원ID: item.empId,
    처리: item.action,
    사유: item.reason,
    날짜: item.date,
    일수: item.days,
    증빙: item.evidence,
    메모: item.memo
  }));
  const totalRows = Object.entries(state.totals).map(([key, total]) => {
    const [empId, year] = key.split("_");
    return { 직원ID: empId, 기준연도: Number(year), 생성연차: Number(total) };
  });
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(employeeRows), "직원목록");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(recordRows), "사용내역");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(subRows), "대체휴가");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(specialRows), "특별휴가");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(totalRows), "연차합계");
  XLSX.writeFile(workbook, `guro_huga_export_${Date.now()}.xlsx`);
}

function importExcelSnapshot(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (typeof XLSX === "undefined") {
    alert("엑셀 라이브러리를 불러오지 못했습니다.");
    event.target.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = (loadEvent) => {
    try {
      const workbook = XLSX.read(loadEvent.target.result, { type: "array" });
      const employeeRows = XLSX.utils.sheet_to_json(workbook.Sheets["직원목록"] || {}, { defval: "" });
      const recordRows = XLSX.utils.sheet_to_json(workbook.Sheets["사용내역"] || {}, { defval: "" });
      const subRows = XLSX.utils.sheet_to_json(workbook.Sheets["대체휴가"] || {}, { defval: "" });
      const specialRows = XLSX.utils.sheet_to_json(workbook.Sheets["특별휴가"] || {}, { defval: "" });
      const totalRows = XLSX.utils.sheet_to_json(workbook.Sheets["연차합계"] || {}, { defval: "" });

      state.employees = [];
      state.records = [];
      state.subLeaves = [];
      state.specialLeaves = [];
      state.totals = {};
      mergeEmployeesFromExcel(employeeRows);
      mergeTotalsFromExcel(totalRows);
      state.records = recordRows.map((row, index) => ({
        id: String(row["ID"] || `record_${index}`),
        empId: String(row["직원ID"] || "").trim(),
        date: normalizeDateCell(row["날짜"]),
        type: String(row["구분"] || "연차").trim() || "연차",
        memo: String(row["메모"] || "").trim()
      })).filter((row) => row.empId && row.date);
      state.subLeaves = subRows.map((row, index) => ({
        id: String(row["ID"] || `sub_${index}`),
        empId: String(row["직원ID"] || "").trim(),
        type: String(row["처리"] || "grant").trim() || "grant",
        date: normalizeDateCell(row["날짜"]),
        days: Number(row["일수"] || 0),
        memo: String(row["메모"] || "").trim()
      })).filter((row) => row.empId && row.date && row.days);
      mergeSpecialLeavesFromExcel(specialRows);
      initializeSelections();
      touchState("엑셀 일괄 업로드 반영");
      renderAll();
      alert("엑셀 데이터를 반영했습니다.");
    } catch (error) {
      alert(`엑셀 업로드 오류: ${error.message}`);
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsArrayBuffer(file);
}

function exportCategoryExcel() {
  if (typeof XLSX === "undefined") {
    alert("엑셀 라이브러리를 불러오지 못했습니다.");
    return;
  }
  const category = document.getElementById("category-select").value;
  const workbook = XLSX.utils.book_new();
  if (category === "employees") {
    const rows = state.employees.map((employee) => ({
      직원ID: employee.id,
      이름: employee.name,
      부서: employee.dept,
      직책: employee.role,
      입사일: employee.joinDate,
      회계년도시작월: employee.fiscalYearMonth,
      퇴사일: employee.resignationDate
    }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "직원목록");
  } else if (category === "records") {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(state.records), "사용내역");
  } else if (category === "subLeaves") {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(state.subLeaves), "대체휴가");
  } else if (category === "specialLeaves") {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(state.specialLeaves), "특별휴가");
  } else if (category === "hrRecords") {
    const rows = Object.entries(state.hrRecords).map(([key, value]) => ({ key, ...value }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "인사기록");
  } else if (category === "perms") {
    const rows = Object.entries(state.perms).map(([empId, value]) => ({ empId, grade: value.grade, menus: JSON.stringify(value.menus || {}) }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "권한");
  }
  XLSX.writeFile(workbook, `guro_huga_${category}_${Date.now()}.xlsx`);
}

function importCategoryExcel(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (typeof XLSX === "undefined") {
    alert("엑셀 라이브러리를 불러오지 못했습니다.");
    event.target.value = "";
    return;
  }
  const category = document.getElementById("category-select").value;
  const reader = new FileReader();
  reader.onload = (loadEvent) => {
    try {
      const workbook = XLSX.read(loadEvent.target.result, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      if (category === "employees") {
        state.employees = [];
        mergeEmployeesFromExcel(rows);
      } else if (category === "records") {
        state.records = rows;
      } else if (category === "subLeaves") {
        state.subLeaves = rows;
      } else if (category === "specialLeaves") {
        state.specialLeaves = [];
        mergeSpecialLeavesFromExcel(rows);
      } else if (category === "hrRecords") {
        state.hrRecords = {};
        rows.forEach((row) => {
          if (!row.key) return;
          const { key, ...rest } = row;
          state.hrRecords[key] = rest;
        });
      } else if (category === "perms") {
        state.perms = {};
        rows.forEach((row) => {
          state.perms[row.empId] = {
            grade: row.grade || "normal",
            menus: row.menus ? JSON.parse(row.menus) : {}
          };
        });
      }
      initializeSelections();
      touchState(`카테고리 엑셀 업로드 ${category}`);
      renderAll();
      alert("카테고리 데이터를 반영했습니다.");
    } catch (error) {
      alert(`카테고리 엑셀 업로드 오류: ${error.message}`);
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsArrayBuffer(file);
}

function calculatePayByGrade(grade, level, step) {
  const table = state.settings.payGradeTable || [];
  const found = table.find((item) => item.grade === grade && item.level === level && Number(item.step) === Number(step))
    || table.find((item) => item.level === level && Number(item.step) === Number(step));
  return Number(found?.basePay || 0);
}

function calculateAutoTax(basePay) {
  const hometaxRate = Number(state.settings.hometaxRate || 0) / 100;
  const localRate = Number(state.settings.localTaxRate ?? 10) / 100;
  return basePay * (hometaxRate + (hometaxRate * localRate));
}

function calculateWithholdingTax(basePay, familyCount = 1, childCount = 0, ratePercent = 100) {
  const tableTax = lookupSimpleTax(basePay, familyCount, childCount);
  const baseTax = tableTax !== null ? tableTax : calculateAutoTax(basePay);
  return baseTax * (Number(ratePercent || 100) / 100);
}

function lookupSimpleTax(basePay, familyCount, childCount) {
  const table = state.settings.simpleTaxTable || [];
  if (!table.length) return null;
  const meta = normalizeSimpleTaxMeta(state.settings.simpleTaxMeta);
  if (meta.source === "nts-official-2026-monthly") {
    return lookupNationalSimpleTax(basePay, familyCount, childCount, table, meta);
  }
  const matched = table.find((row) => basePay >= row.salaryMin && basePay <= row.salaryMax
    && Number(row.familyCount) === Number(familyCount)
    && Number(row.childCount || 0) === Number(childCount));
  if (matched) return Number(matched.tax || 0);
  const fallback = table.find((row) => basePay >= row.salaryMin && basePay <= row.salaryMax && Number(row.familyCount) === Number(familyCount));
  return fallback ? Number(fallback.tax || 0) : null;
}

function lookupNationalSimpleTax(basePay, familyCount, childCount, table, meta) {
  const normalizedFamily = Math.max(1, Math.floor(Number(familyCount) || 1));
  const normalizedChild = Math.max(0, Math.floor(Number(childCount) || 0));
  const cappedFamily = Math.min(normalizedFamily, Number(meta.familyCap || normalizedFamily));
  let tax = lookupNationalSimpleTaxBase(basePay, cappedFamily, table, meta);
  if (tax === null) return null;
  if (normalizedFamily > cappedFamily && cappedFamily >= 11) {
    const tax10 = lookupNationalSimpleTaxBase(basePay, 10, table, meta);
    const tax11 = lookupNationalSimpleTaxBase(basePay, 11, table, meta);
    if (tax10 !== null && tax11 !== null) {
      tax = tax11 - Math.max(0, tax10 - tax11) * (normalizedFamily - cappedFamily);
    }
  }
  tax -= calculateNationalSimpleTaxChildDeduction(normalizedChild, meta);
  return Math.max(0, Math.round(tax));
}

function lookupNationalSimpleTaxBase(basePay, familyCount, table, meta) {
  const matched = table.find((row) => basePay >= row.salaryMin && basePay <= row.salaryMax && Number(row.familyCount) === Number(familyCount));
  if (matched) return Number(matched.tax || 0);
  const formula = resolveNationalSimpleTaxFormula(basePay, meta);
  if (!formula) return null;
  const referenceTax = table.find((row) => formula.referenceSalary >= row.salaryMin
    && formula.referenceSalary <= row.salaryMax
    && Number(row.familyCount) === Number(familyCount));
  if (!referenceTax) return null;
  const excess = Math.max(0, basePay - formula.threshold);
  return Number(referenceTax.tax || 0) + Number(formula.baseAddition || 0) + (excess * Number(formula.taxableRatio || 1) * Number(formula.rate || 0));
}

function resolveNationalSimpleTaxFormula(basePay, meta) {
  const formulas = Array.isArray(meta.highIncomeFormulas) ? meta.highIncomeFormulas : [];
  return formulas.find((item) => basePay > Number(item.threshold || 0) && (item.max === null || basePay <= Number(item.max))) || null;
}

function calculateNationalSimpleTaxChildDeduction(childCount, meta) {
  const rules = meta.childDeductions || {};
  if (childCount <= 0) return 0;
  if (childCount === 1) return Number(rules.oneChild || 0);
  if (childCount === 2) return Number(rules.twoChildren || 0);
  return Number(rules.twoChildren || 0) + ((childCount - 2) * Number(rules.additionalChild || 0));
}

function applyWelfareTemplate() {
  state.settings.welfareStandard = defaultWelfareStandard();
  touchState("서울시 사회복지시설 기준 템플릿 적용");
  renderHrView();
}

function applySeoulPayTemplate() {
  state.settings.payGradeTable = defaultSeoulPayGradeTable2026();
  state.settings.allowanceRules = defaultAllowanceRules();
  touchState("2026 서울시 급여/제수당 템플릿 적용");
  renderHrView();
}

function importPayGradeExcel(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (typeof XLSX === "undefined") {
    alert("엑셀 라이브러리를 불러오지 못했습니다.");
    event.target.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = (loadEvent) => {
    try {
      const workbook = XLSX.read(loadEvent.target.result, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
      const parsed = rows.map((row) => ({
        grade: String(row["직급"] || row["직군"] || "").trim(),
        level: String(row["급수"] || row["등급"] || "").trim(),
        step: Number(String(row["호봉"] || row["step"] || "0").replace(/[^0-9]/g, "")),
        basePay: Number(String(row["월 기본급"] || row["기본급"] || row["basePay"] || "0").replace(/[^0-9]/g, ""))
      })).filter((item) => item.step > 0 && item.basePay > 0 && (item.grade || item.level));
      if (!parsed.length) throw new Error("유효한 행이 없습니다. 컬럼명: 직급/급수/호봉/월 기본급");
      state.settings.payGradeTable = parsed;
      touchState(`임금테이블 엑셀 업로드 ${parsed.length}건`);
      renderHrView();
      alert(`임금테이블 ${parsed.length}건 반영 완료`);
    } catch (error) {
      alert(`임금테이블 업로드 오류: ${error.message}`);
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsArrayBuffer(file);
}

function importSimpleTaxTableExcel(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (typeof XLSX === "undefined") {
    alert("엑셀 라이브러리를 불러오지 못했습니다.");
    event.target.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = (loadEvent) => {
    try {
      const workbook = XLSX.read(loadEvent.target.result, { type: "array" });
      const officialTable = parseNationalSimpleTaxTableWorkbook(workbook);
      const deduped = officialTable?.table || parseGenericSimpleTaxWorkbook(workbook);
      deduped.sort((a, b) => a.salaryMin - b.salaryMin || a.familyCount - b.familyCount || a.childCount - b.childCount);
      if (!deduped.length) throw new Error("유효한 행이 없습니다. 컬럼 예시: 월급여(범위), 가족수(또는 1명/2명...), 소득세");
      state.settings.simpleTaxTable = deduped;
      state.settings.simpleTaxMeta = normalizeSimpleTaxMeta(officialTable?.meta);
      touchState(`간이세액표 업로드 ${deduped.length}건`);
      renderActiveView();
      alert(`간이세액표 ${deduped.length}건 반영 완료`);
    } catch (error) {
      alert(`간이세액표 업로드 오류: ${error.message}`);
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsArrayBuffer(file);
}

function parseSalaryRange(raw) {
  const text = String(raw || "");
  const nums = text.match(/[0-9,]+/g)?.map((item) => Number(String(item).replace(/,/g, ""))).filter((item) => item > 0) || [];
  if (nums.length >= 2) return [Math.min(nums[0], nums[1]), Math.max(nums[0], nums[1])];
  if (nums.length === 1) return [nums[0], nums[0]];
  return [0, 0];
}

function parseGenericSimpleTaxWorkbook(workbook) {
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
  const parsed = [];
  rows.forEach((row) => {
    const [salaryMin, salaryMax] = parseSalaryRange(row["월급여"] || row["총급여"] || row["과세표준"] || row["salary"] || "");
    if (!(salaryMin > 0 && salaryMax >= salaryMin)) return;
    const explicitFamily = Number(String(row["가족수"] || row["부양가족수"] || row["family"] || "").replace(/[^0-9]/g, ""));
    const explicitChild = Number(String(row["자녀수"] || row["8~20세 자녀수"] || row["child"] || "0").replace(/[^0-9]/g, "")) || 0;
    const explicitTax = Number(String(row["소득세"] || row["원천세"] || row["tax"] || "").replace(/[^0-9]/g, ""));
    if (explicitFamily && explicitTax >= 0) {
      parsed.push({ salaryMin, salaryMax, familyCount: explicitFamily, childCount: explicitChild, tax: explicitTax });
      return;
    }
    Object.keys(row).forEach((key) => {
      const familyCount = Number(String(key).replace(/[^0-9]/g, ""));
      if (!familyCount) return;
      const tax = Number(String(row[key] || "").replace(/[^0-9]/g, ""));
      if (!tax && tax !== 0) return;
      parsed.push({ salaryMin, salaryMax, familyCount, childCount: explicitChild, tax });
    });
  });
  return parsed.filter((item) => item.salaryMin > 0 && item.salaryMax >= item.salaryMin && item.familyCount > 0);
}

function parseNationalSimpleTaxTableWorkbook(workbook) {
  const sheetName = workbook.SheetNames.find((name) => String(name).includes("근로소득간이세액표"));
  if (!sheetName) return null;
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const familyHeader = rows[2] || [];
  if (!(String(rows[1]?.[2] || "").includes("공제대상가족") && Number(familyHeader[2]) === 1 && Number(familyHeader[12]) === 11)) {
    return null;
  }
  const table = [];
  rows.forEach((row) => {
    const min = Number(row[0]);
    const max = Number(row[1]);
    if (min > 0 && max > 0) {
      for (let family = 1; family <= 11; family += 1) {
        const tax = normalizeSimpleTaxAmount(row[family + 1]);
        if (tax === null) continue;
        table.push({
          salaryMin: min * 1000,
          salaryMax: (max * 1000) - 1,
          familyCount: family,
          childCount: 0,
          tax
        });
      }
      return;
    }
    const label = String(row[0] || "").replace(/\s/g, "");
    if (label === "10,000천원") {
      for (let family = 1; family <= 11; family += 1) {
        const tax = normalizeSimpleTaxAmount(row[family + 1]);
        if (tax === null) continue;
        table.push({
          salaryMin: 10000000,
          salaryMax: 10000000,
          familyCount: family,
          childCount: 0,
          tax
        });
      }
    }
  });
  if (!table.length) return null;
  return {
    table,
    meta: {
      source: "nts-official-2026-monthly",
      familyCap: 11,
      childDeductions: {
        oneChild: 20830,
        twoChildren: 45830,
        additionalChild: 33330
      },
      highIncomeFormulas: [
        { threshold: 10000000, max: 14000000, referenceSalary: 10000000, baseAddition: 25000, taxableRatio: 0.98, rate: 0.35 },
        { threshold: 14000000, max: 28000000, referenceSalary: 10000000, baseAddition: 1397000, taxableRatio: 0.98, rate: 0.38 },
        { threshold: 28000000, max: 30000000, referenceSalary: 10000000, baseAddition: 6610600, taxableRatio: 0.98, rate: 0.4 },
        { threshold: 30000000, max: 45000000, referenceSalary: 10000000, baseAddition: 7394600, taxableRatio: 1, rate: 0.4 },
        { threshold: 45000000, max: null, referenceSalary: 10000000, baseAddition: 13394600, taxableRatio: 1, rate: 0.42 }
      ]
    }
  };
}

function normalizeSimpleTaxAmount(raw) {
  if (raw === null || raw === undefined || raw === "" || raw === "-") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const cleaned = String(raw).replace(/[^0-9]/g, "");
  return cleaned ? Number(cleaned) : null;
}

function defaultSimpleTaxMeta() {
  return {
    source: "generic",
    familyCap: null,
    childDeductions: null,
    highIncomeFormulas: []
  };
}

function normalizeSimpleTaxMeta(meta) {
  return Object.assign(defaultSimpleTaxMeta(), meta || {});
}

function calculateAllowancePackage(record, basePay, flags = {}) {
  const rule = state.settings.allowanceRules || defaultAllowanceRules();
  const useMeal = flags.meal !== false;
  const useManager = flags.manager !== false;
  const useFamily = flags.family !== false;
  const useAdjustment = flags.adjustment !== false;
  const useOvertime = flags.overtime !== false;
  const spouseCount = Number(record.spouseCount || 0);
  const childCount = Number(record.childCount || 0);
  const otherCount = Number(record.otherDependentCount || 0);
  const childAllowance = (childCount >= 1 ? rule.child1 : 0) + (childCount >= 2 ? rule.child2 : 0) + (childCount >= 3 ? (childCount - 2) * rule.child3Plus : 0);
  const familyAllowance = useFamily ? ((spouseCount > 0 ? rule.spouse : 0) + childAllowance + (otherCount * rule.otherDependent)) : 0;
  const managerAllowance = useManager && record.payGrade === "관리직" ? rule.manager : 0;
  const adjustment = useAdjustment ? Number(record.adjustmentAllowance || rule.defaultAdjustment || 0) : 0;
  const meal = useMeal ? rule.meal : 0;
  const holidayBonusMonthly = basePay * 1.2 / 12;
  const ordinaryWage = basePay + meal + adjustment + holidayBonusMonthly;
  const hourly = ordinaryWage / 209;
  const overtimeAllowance = useOvertime ? ((Number(record.overtimeHours || 0) * hourly * 1.5) + (Number(record.holidayOvertimeHours || 0) * hourly * 2)) : 0;
  const totalAllowance = familyAllowance + managerAllowance + meal + adjustment + holidayBonusMonthly + overtimeAllowance;
  return { ordinaryWage, overtimeAllowance, totalAllowance };
}

function saveWelfareTemplate() {
  state.settings.welfareStandard = {
    name: document.getElementById("welfare-rule-name").value.trim() || defaultWelfareStandard().name,
    weeklyHours: Number(document.getElementById("welfare-weekly-hours").value || 40),
    retirementNote: document.getElementById("welfare-retirement-note").value.trim(),
    educationNote: document.getElementById("welfare-education-note").value.trim()
  };
  touchState("사회복지시설 기준 저장");
  renderHrView();
}

function exportHrExcel() {
  if (typeof XLSX === "undefined") {
    alert("엑셀 라이브러리를 불러오지 못했습니다.");
    return;
  }
  const admin = isCurrentAdmin();
  const year = ui.hrYear;
  const rows = state.employees.map((employee) => {
    const record = getHrRecord(employee.id, year);
    return {
      기준연도: year,
      직원ID: employee.id,
      이름: employee.name,
      부서: record.dept,
      직책: record.role,
      입사일: record.joinDate,
      승호월: record.stepMonth || "",
      승진월: record.promotionMonth || "",
      경력년수: record.careerYears || 0,
      자격사항: record.certifications || "",
      직급: record.payGrade || "",
      급수: record.payLevel || "",
      호봉: record.payStep || 0,
      근무형태: record.workType,
      상태: record.status,
      월기본급: record.monthlySalary || 0,
      세금모드: record.taxMode || "hometax",
      수동세율: record.manualTaxRate || 0,
      원천세: record.withholdingTax || 0,
      사회보험: record.socialInsurance || 0,
      퇴직금추정: record.severanceEstimate || 0,
      의무교육이수: record.mandatoryEduDone ? "Y" : "N",
      생년월일: admin ? (employee.birthDate || "") : "",
      개인정보메모: admin ? (employee.personalInfo || "") : ""
    };
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "인사정보");
  XLSX.writeFile(workbook, `guro_huga_hr_${year}.xlsx`);
}

function importHrExcel(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (typeof XLSX === "undefined") {
    alert("엑셀 라이브러리를 불러오지 못했습니다.");
    event.target.value = "";
    return;
  }
  const admin = isCurrentAdmin();
  const reader = new FileReader();
  reader.onload = (loadEvent) => {
    try {
      const workbook = XLSX.read(loadEvent.target.result, { type: "array" });
      const hrSheet = workbook.Sheets["인사정보"] || workbook.Sheets[workbook.SheetNames[0]];
      if (!hrSheet) throw new Error("인사정보 시트를 찾을 수 없습니다.");
      const rows = XLSX.utils.sheet_to_json(hrSheet, { defval: "" });
      rows.forEach((row) => {
        const empId = String(row["직원ID"] || "").trim();
        if (!empId) return;
        const employee = employeeById(empId);
        if (!employee) return;
        const year = Number(row["기준연도"] || ui.hrYear);
        state.hrRecords[`${empId}_${year}`] = {
          dept: String(row["부서"] || employee.dept || "").trim(),
          role: String(row["직책"] || employee.role || "").trim(),
          joinDate: normalizeDateCell(row["입사일"]) || employee.joinDate || "",
          stepMonth: normalizeDateCell(row["승호월"]) || "",
          promotionMonth: normalizeDateCell(row["승진월"]) || "",
          careerYears: Number(row["경력년수"] || 0),
          certifications: String(row["자격사항"] || "").trim(),
          payGrade: String(row["직급"] || "").trim(),
          payLevel: String(row["급수"] || "").trim(),
          payStep: Number(row["호봉"] || 0),
          workType: String(row["근무형태"] || "").trim(),
          status: String(row["상태"] || "").trim(),
          monthlySalary: Number(row["월기본급"] || 0),
          taxMode: String(row["세금모드"] || "hometax").trim() || "hometax",
          manualTaxRate: Number(row["수동세율"] || 0),
          withholdingTax: Number(row["원천세"] || 0),
          socialInsurance: Number(row["사회보험"] || 0),
          severanceEstimate: Number(row["퇴직금추정"] || 0),
          mandatoryEduDone: String(row["의무교육이수"] || "").toUpperCase() === "Y"
        };
        if (admin) {
          employee.birthDate = normalizeDateCell(row["생년월일"]) || employee.birthDate || "";
          employee.personalInfo = String(row["개인정보메모"] || employee.personalInfo || "").trim();
        }
      });
      touchState(admin ? "인사정보 엑셀 업로드" : "인사정보 엑셀 업로드(관리자 민감정보 제외)");
      renderAll();
      alert("인사정보 엑셀 업로드를 반영했습니다.");
    } catch (error) {
      alert(`인사정보 엑셀 업로드 오류: ${error.message}`);
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsArrayBuffer(file);
}

function mergeEmployeesFromExcel(rows) {
  rows.forEach((row, index) => {
    const admin = isCurrentAdmin();
    const id = String(row["직원ID"] || "").trim() || `excel_${Date.now()}_${index}`;
    const existing = employeeById(id);
    const next = {
      id,
      name: String(row["이름"] || "").trim() || existing?.name || `직원${index + 1}`,
      dept: String(row["부서"] || "").trim(),
      role: String(row["직책"] || "").trim(),
      joinDate: normalizeDateCell(row["입사일"]),
      color: existing?.color || COLORS[index % COLORS.length],
      photo: String(row["프로필이미지"] || existing?.photo || "").trim(),
      birthDate: admin ? (normalizeDateCell(row["생년월일"]) || existing?.birthDate || "") : (existing?.birthDate || ""),
      personalInfo: admin ? String(row["개인정보메모"] || existing?.personalInfo || "").trim() : (existing?.personalInfo || ""),
      fiscalYearMonth: Number(row["회계년도시작월"] || existing?.fiscalYearMonth || 1),
      resignationDate: normalizeDateCell(row["퇴사일"]),
      monthlyBasePay: Number(row["월통상임금"] || existing?.monthlyBasePay || 0),
      workHoursPerDay: Number(row["일근로시간"] || existing?.workHoursPerDay || state.settings.defaultWorkHoursPerDay || 8),
      leaveUnitPrice: Number(row["일정산단가"] || existing?.leaveUnitPrice || 0),
      averageDailyWage: Number(row["일평균임금"] || existing?.averageDailyWage || 0)
    };

    if (existing) {
      Object.assign(existing, next);
    } else {
      state.employees.push(next);
      state.perms[id] = state.perms[id] || { grade: "normal", menus: {} };
    }
  });
}

function mergeTotalsFromExcel(rows) {
  rows.forEach((row) => {
    const id = String(row["직원ID"] || "").trim();
    const year = Number(row["기준연도"] || 0);
    const total = Number(row["생성연차"]);
    if (!id || !year || Number.isNaN(total)) return;
    state.totals[`${id}_${year}`] = total;
  });
}

function mergeSpecialLeavesFromExcel(rows) {
  rows.forEach((row, index) => {
    const empId = String(row["직원ID"] || "").trim();
    if (!empId || !employeeById(empId)) return;
    const days = Number(row["일수"] || 0);
    if (!days) return;
    state.specialLeaves.push({
      id: `sp_excel_${Date.now()}_${index}`,
      empId,
      action: row["처리"] === "use" ? "use" : "grant",
      reason: String(row["사유"] || "기타휴가").trim() || "기타휴가",
      days,
      date: normalizeDateCell(row["날짜"]) || formatDateKey(new Date()),
      evidence: String(row["증빙"] || "").trim(),
      memo: String(row["메모"] || "").trim()
    });
  });
}

function normalizeDateCell(value) {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  return String(value).trim();
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

function specialBalance(empId) {
  return round(state.specialLeaves
    .filter((item) => item.empId === empId)
    .reduce((sum, item) => sum + (item.action === "grant" ? item.days : -item.days), 0));
}

function specialBalanceByReason(empId, reason) {
  return round(state.specialLeaves
    .filter((item) => item.empId === empId && item.reason === reason)
    .reduce((sum, item) => sum + (item.action === "grant" ? item.days : -item.days), 0));
}

function sumSpecialByAction(action) {
  return round(state.specialLeaves
    .filter((item) => item.action === action)
    .reduce((sum, item) => sum + item.days, 0));
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
  if (perm.grade === "limit") return ["dashboard", "leave", "cal", "hist"].includes(menuKey);
  return hasRawMenu(empId, menuKey);
}

function employeeCell(employee) {
  return `
    <div style="display:flex;align-items:center;gap:10px;">
      <div class="avatar" style="background:${employee.color};width:34px;height:34px;border-radius:12px;">${avatarContent(employee)}</div>
      <div>
        <div style="font-weight:700;">${employee.name}</div>
        <div class="row-desc">${employee.role || ""}</div>
      </div>
    </div>
  `;
}

function avatarContent(employee) {
  if (employee?.photo) {
    return `<img class="avatar-img" src="${employee.photo}" alt="${employee.name || "직원"} 프로필">`;
  }
  return (employee?.name || "휴가").slice(0, 2);
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
