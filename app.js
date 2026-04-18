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
  leaveTab: "overview",
  orgEditId: "",
  managerFilter: { search: "", dept: "", risk: "all", usageMin: "", usageMax: "" },
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
  document.getElementById("backup-import-hidden").addEventListener("change", importBackupSnapshot);
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
    allowanceRules: defaultAllowanceRules(),
    birthdayRule: defaultBirthdayRule(),
    activeLaborRuleYear: 2026,
    laborRuleCache: {},
    erpModuleState: {},
    monthlyStandardHours: 209,
    defaultWorkHoursPerDay: 8,
    employmentRules: defaultEmploymentRules()
  }, state.settings || {});
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
    datahub: renderDataHub,
    erp: renderErpView,
    perm: renderPermissions,
    sync: renderSyncPage
  };
  const renderer = viewRenderers[ui.activeView] || renderDashboard;
  renderer();
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

  const avatar = document.getElementById("sb-avatar");
  avatar.style.background = selected?.color || COLORS[0];
  avatar.innerHTML = avatarContent(selected);
  document.getElementById("sb-name").textContent = selected?.name || "";
  document.getElementById("sb-meta").textContent = [selected?.dept, selected?.role].filter(Boolean).join(" · ");
}

function renderDashboard() {
  const year = ui.managerYear;
  const todayKey = formatDateKey(new Date());
  document.getElementById("dashboard-year-label").textContent = `${year}년 기준`;

  const summaries = state.employees.map((employee) => employeeSummary(employee.id, year));
  const totalGrant = summaries.reduce((sum, item) => sum + item.total, 0);
  const totalUsed = summaries.reduce((sum, item) => sum + item.used, 0);
  const totalRemain = summaries.reduce((sum, item) => sum + item.remain, 0);
  const peopleAtRisk = summaries.filter((item) => item.alertLevel === "urgent" || item.alertLevel === "warning").length;
  const promotionTargets = summaries.filter((item) => item.promotionNeeded).length;
  const todayLeaveCount = state.records.filter((record) => record.date === todayKey).length;
  const unsavedChanges = state.updatedAt && lastSavedAt ? 0 : (state.updatedAt ? 1 : 0);

  document.getElementById("today-summary").innerHTML = [
    kpiCard("white", "오늘 휴가/반차", `${todayLeaveCount}`, "건", todayKey),
    kpiCard("amber", "소멸 위험", `${peopleAtRisk}`, "명", "조치 필요"),
    kpiCard("primary", "미저장 변경", `${unsavedChanges}`, "건", "공유 저장 확인"),
    kpiCard("green", "최근 동기화", lastSavedAt || "없음", "", "GitHub 저장 기준")
  ].join("");

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
  document.getElementById("ops-memo").value = state.settings.opsMemo || "";
  document.getElementById("audit-log-list").innerHTML = state.auditLogs.length
    ? state.auditLogs.slice(0, 20).map((item) => `
      <div class="row-item">
        <div class="row-main">
          <div class="row-title">${item.message}</div>
          <div class="row-desc">${item.at}</div>
        </div>
      </div>
    `).join("")
    : emptyState("아직 기록된 변경 로그가 없습니다.");
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
  document.getElementById("fiscal-year-month").value = String(selected.fiscalYearMonth || 1);
  document.getElementById("resignation-date").value = selected.resignationDate || "";
  document.getElementById("monthly-base-pay").value = selected.monthlyBasePay || "";
  document.getElementById("work-hours-per-day").value = selected.workHoursPerDay || state.settings.defaultWorkHoursPerDay || 8;
  document.getElementById("monthly-standard-hours").value = state.settings.monthlyStandardHours || 209;
  document.getElementById("leave-unit-price").value = selected.leaveUnitPrice || "";
  document.getElementById("employment-rules").value = state.settings.employmentRules || defaultEmploymentRules();
  const years = allYears();
  const auto = accrual(selected.joinDate, ui.currentYear, selected.fiscalYearMonth);
  document.getElementById("accrual-hint").textContent = selected.joinDate
    ? `${selected.name}님의 ${ui.currentYear}년 자동 계산 연차는 ${auto}일입니다. 회계년도 시작 월은 ${selected.fiscalYearMonth || 1}월입니다.`
    : "입사일을 입력하면 자동 계산 기준이 표시됩니다.";

  document.getElementById("year-inputs").innerHTML = years.map((year) => {
    const value = getTotal(selected.id, year);
    const autoValue = accrual(selected.joinDate, year, selected.fiscalYearMonth);
    return `
      <div>
        <label class="field-label">${year}년</label>
        <input class="field" type="number" min="0" max="50" step="0.5" value="${value}" data-total-emp="${selected.id}" data-total-year="${year}">
        <div class="row-desc">자동 계산 ${autoValue}일</div>
      </div>
    `;
  }).join("");

  const settlement = calcRetirementPayout(selected.id, ui.currentYear);
  document.getElementById("settlement-summary").innerHTML = `
    <div class="calc-result">
      <div>잔여 연차: <strong>${settlement.remainingDays.toFixed(2)}일</strong></div>
      <div>계산식: ${settlement.formula}</div>
      <div class="calc-amount">${settlement.amount.toLocaleString("ko-KR")}원</div>
      <div class="row-desc">${settlement.note}</div>
    </div>
  `;
}

function renderEmployees() {
  document.getElementById("employee-grid").innerHTML = state.employees.map((employee) => {
    const summary = employeeSummary(employee.id, ui.managerYear);
    const width = summary.total ? Math.min(100, Math.round((summary.used / summary.total) * 100)) : 0;
    return `
      <div class="employee-card ${employee.id === ui.selectedEmployeeId ? "selected" : ""}">
        <div class="avatar" style="background:${employee.color}">${avatarContent(employee)}</div>
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
      <div class="sub-balance-actions">
        <button class="btn ghost small" type="button" data-action="open-bulk-subleave-modal">일괄 부여</button>
        <button class="btn primary small" type="button" data-action="open-subleave-modal">부여 / 사용</button>
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
  const employee = employeeById(ui.specialEmployeeId) || currentUser();
  if (!employee) return;
  ui.specialEmployeeId = employee.id;

  document.getElementById("special-kpis").innerHTML = [
    kpiCard("white", "특별휴가 기록", `${state.specialLeaves.length}`, "건", "전체 직원"),
    kpiCard("green", "총 부여", `${sumSpecialByAction("grant").toFixed(1)}`, "일", "독립 잔여"),
    kpiCard("red", "총 사용", `${sumSpecialByAction("use").toFixed(1)}`, "일", "연차 미차감"),
    kpiCard("primary", "현재 직원 잔여", `${specialBalance(employee.id).toFixed(1)}`, "일", employee.name)
  ].join("");

  document.getElementById("special-employee-tabs").innerHTML = state.employees.map((item) => {
    return `<button class="pill ${item.id === ui.specialEmployeeId ? "active" : ""}" type="button" data-special-emp="${item.id}">${item.name} (${specialBalance(item.id).toFixed(1)}일)</button>`;
  }).join("");

  document.querySelectorAll("[data-special-emp]").forEach((button) => {
    button.addEventListener("click", () => {
      ui.specialEmployeeId = button.dataset.specialEmp;
      renderSpecialLeaves();
    });
  });

  document.getElementById("special-balance-label").textContent = employee.name;
  document.getElementById("special-balance").innerHTML = specialTypes.map((type) => {
    return `
      <div class="row-item">
        <div class="row-main">
          <div class="row-title">${type}</div>
          <div class="row-desc">유형별 독립 잔여 일수</div>
        </div>
        <span class="tag blue">${specialBalanceByReason(employee.id, type).toFixed(1)}일</span>
      </div>
    `;
  }).join("");

  const history = state.specialLeaves
    .filter((item) => item.empId === employee.id)
    .sort((left, right) => right.date.localeCompare(left.date));
  document.getElementById("special-history-count").textContent = `총 ${history.length}건`;
  document.getElementById("special-history-body").innerHTML = history.length ? history.map(renderSpecialRow).join("") : emptyState("특별휴가 이력이 없습니다.");

  document.querySelectorAll("[data-special-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteSpecialLeave(button.dataset.specialDelete));
  });
}

function renderOfficeView() {
  const year = ui.managerYear;
  const rows = state.employees.map((employee) => {
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
        <td>${latest}</td>
      </tr>
    `;
  });
  document.getElementById("office-body").innerHTML = rows.join("") || `<tr><td colspan="7">${emptyState("직원 데이터가 없습니다.")}</td></tr>`;
  document.getElementById("office-count").textContent = `총 ${state.employees.length}명`;
  document.getElementById("office-kpis").innerHTML = [
    kpiCard("white", "전체 직원", `${state.employees.length}`, "명", "사무실 기준"),
    kpiCard("green", "연차 총 잔여", `${round(state.employees.reduce((sum, employee) => sum + employeeSummary(employee.id, year).remain, 0)).toFixed(1)}`, "일", `${year}년 기준`),
    kpiCard("purple", "특별휴가 총 잔여", `${round(state.employees.reduce((sum, employee) => sum + specialBalance(employee.id), 0)).toFixed(1)}`, "일", "누적"),
    kpiCard("amber", "대체휴가 총 잔여", `${totalSubBalance().toFixed(1)}`, "일", "누적")
  ].join("");
}

function renderHrView() {
  renderYearTabs("hr-year-tabs", ui.hrYear, (year) => {
    ui.hrYear = year;
    renderHrView();
  });

  const admin = isCurrentAdmin();
  document.getElementById("hr-body").innerHTML = state.employees.map((employee) => {
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
    const autoTax = calculateAutoTax(basePay);
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
}

function renderErpView() {
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
        title: "조직도/직무배치",
        desc: "부서 체계·팀장·구성원 운영",
        view: "erp"
      },
      {
        id: "hr-appointment",
        title: "인사발령",
        desc: "입사/전보/휴직/복직/퇴사 기록",
        view: "hr"
      },
      {
        id: "hr-promotion",
        title: "승호/승진/승급 월 관리",
        desc: "호봉/승진 시점 추적",
        view: "hr"
      }
    ],
    attendance: [
      {
        id: "att-leave",
        title: "연차/특별휴가 자동부여",
        desc: "생일반차, 대체휴가 포함",
        view: "spe"
      },
      {
        id: "att-close",
        title: "근태 월 마감",
        desc: "월별 사용현황/잔여점검",
        view: "mgr"
      },
      {
        id: "att-overtime",
        title: "출퇴근/초과근무 연동",
        desc: "초과근무 기록 통합",
        view: "office"
      }
    ],
    payroll: [
      {
        id: "pay-template",
        title: "급여항목 템플릿",
        desc: "기본급/수당/공제 테이블",
        view: "hr"
      },
      {
        id: "pay-tax",
        title: "4대보험/원천세 계산",
        desc: "자동/수동 세율 계산",
        view: "hr"
      },
      {
        id: "pay-export",
        title: "지급명세서 데이터 출력",
        desc: "엑셀 내보내기",
        view: "datahub"
      },
      {
        id: "pay-retire",
        title: "퇴직금 시뮬레이션",
        desc: "평균임금/통상임금 비교",
        view: "hr"
      }
    ],
    compliance: [
      {
        id: "comp-edu",
        title: "법정의무교육 이수현황",
        desc: "직원별 완료체크/누락점검",
        view: "hr"
      },
      {
        id: "comp-alert",
        title: "미이수 알림/이력",
        desc: "위험 인원 필터링",
        view: "mgr"
      },
      {
        id: "comp-doc",
        title: "노사 문서 관리",
        desc: "규정/문서 백업",
        view: "sync"
      },
      {
        id: "comp-perm",
        title: "개인정보 접근권한",
        desc: "권한표/접근범위 관리",
        view: "perm"
      },
      {
        id: "comp-audit",
        title: "감사로그 + 버전 롤백",
        desc: "변경이력, 스냅샷 복구",
        view: "sync"
      }
    ]
  };
  renderOrgUnitForm();
  document.getElementById("org-unit-list").innerHTML = renderOrgUnitRows();
  document.getElementById("org-tree-view").innerHTML = renderOrgTree();
  document.getElementById("erp-hr-core").innerHTML = sections.hr.map((item) => renderErpModuleRow(item)).join("");
  document.getElementById("erp-attendance").innerHTML = sections.attendance.map((item) => renderErpModuleRow(item)).join("");
  document.getElementById("erp-payroll").innerHTML = sections.payroll.map((item) => renderErpModuleRow(item)).join("");
  document.getElementById("erp-compliance").innerHTML = sections.compliance.map((item) => renderErpModuleRow(item)).join("");
}

function renderErpModuleRow(module) {
  const moduleState = getErpModuleState(module.id);
  const ownerName = moduleState.ownerId ? (findEmployee(moduleState.ownerId)?.name || "미지정") : "담당자 미지정";
  return `
    <div class="row-item col">
      <div class="row-main">
        <div class="row-title">${module.title}</div>
        <div class="row-desc">${module.desc}</div>
      </div>
      <div class="erp-module-meta">
        <select class="field" data-erp-module-id="${module.id}" data-erp-owner>
          <option value="">담당자</option>
          ${state.employees.map((employee) => `<option value="${employee.id}" ${moduleState.ownerId === employee.id ? "selected" : ""}>${employee.name}</option>`).join("")}
        </select>
        <select class="field" data-erp-module-id="${module.id}" data-erp-status>
          ${["plan", "doing", "done", "hold"].map((status) => `<option value="${status}" ${moduleState.status === status ? "selected" : ""}>${erpStatusLabel(status)}</option>`).join("")}
        </select>
        <input class="field" type="date" data-erp-module-id="${module.id}" data-erp-due value="${moduleState.dueDate || ""}">
        <input class="field" type="text" placeholder="메모" data-erp-module-id="${module.id}" data-erp-note value="${moduleState.note || ""}">
      </div>
      <div class="row-item-actions">
        <span class="tag ${erpStatusTag(moduleState.status)}">${erpStatusLabel(moduleState.status)} · ${ownerName}</span>
        <button class="btn ghost small" data-action="open-erp-menu" data-view="${module.view}">메뉴 열기</button>
        <button class="btn primary small" data-action="toggle-erp-module" data-erp-module-id="${module.id}">${moduleState.enabled ? "사용중" : "비활성"}</button>
      </div>
    </div>
  `;
}

function getErpModuleState(moduleId) {
  state.settings.erpModuleState = state.settings.erpModuleState || {};
  if (!state.settings.erpModuleState[moduleId]) {
    state.settings.erpModuleState[moduleId] = {
      enabled: true,
      ownerId: "",
      dueDate: "",
      status: "plan",
      note: ""
    };
  }
  return state.settings.erpModuleState[moduleId];
}

function toggleErpModule(moduleId) {
  if (!moduleId) return;
  const moduleState = getErpModuleState(moduleId);
  moduleState.enabled = !moduleState.enabled;
  touchState(`ERP 모듈 ${moduleId} ${moduleState.enabled ? "활성화" : "비활성화"}`);
  renderErpView();
}

function erpStatusLabel(status) {
  if (status === "doing") return "진행중";
  if (status === "done") return "완료";
  if (status === "hold") return "보류";
  return "계획";
}

function erpStatusTag(status) {
  if (status === "doing") return "blue";
  if (status === "done") return "green";
  if (status === "hold") return "amber";
  return "purple";
}

function renderOrgUnitForm() {
  const parentSelect = document.getElementById("org-parent-id");
  const leaderSelect = document.getElementById("org-leader-id");
  parentSelect.innerHTML = `<option value="">상위부서(없음)</option>${state.orgUnits.map((unit) => `<option value="${unit.id}">${unit.name}</option>`).join("")}`;
  leaderSelect.innerHTML = `<option value="">팀장 선택</option>${state.employees.map((employee) => `<option value="${employee.id}">${employee.name}</option>`).join("")}`;
  document.getElementById("org-edit-id").value = ui.orgEditId || "";
}

function renderOrgUnitRows() {
  if (!state.orgUnits.length) return emptyState("등록된 부서가 없습니다. 자동구성 또는 신규 등록을 해주세요.");
  return state.orgUnits.map((unit) => {
    const members = state.employees.filter((employee) => employee.dept === unit.name);
    const leaderName = unit.leaderId ? (findEmployee(unit.leaderId)?.name || "미지정") : "미지정";
    const parent = unit.parentId ? state.orgUnits.find((item) => item.id === unit.parentId)?.name || "-" : "최상위";
    return `
      <div class="row-item col">
        <div class="row-main">
          <div class="row-title">${unit.name} <span class="tag blue">${members.length}명</span></div>
          <div class="row-desc">상위부서: ${parent} · 팀장: ${leaderName}</div>
          <div class="org-members">구성원: ${members.length ? members.map((member) => member.name).join(", ") : "없음"}${unit.note ? ` · 메모: ${unit.note}` : ""}</div>
        </div>
        <div class="row-item-actions">
          <button class="btn ghost small" data-action="edit-org-unit" data-org-unit-id="${unit.id}">수정</button>
          <button class="btn ghost small" data-action="delete-org-unit" data-org-unit-id="${unit.id}">삭제</button>
          <button class="btn primary small" data-action="open-erp-menu" data-view="emp">직원목록 열기</button>
        </div>
      </div>
    `;
  }).join("");
}

function renderOrgTree() {
  if (!state.orgUnits.length) return emptyState("부서를 먼저 등록해주세요.");
  const childrenMap = new Map();
  state.orgUnits.forEach((unit) => {
    const key = unit.parentId || "root";
    if (!childrenMap.has(key)) childrenMap.set(key, []);
    childrenMap.get(key).push(unit);
  });
  const renderNode = (unit, depth = 0) => {
    const members = state.employees.filter((employee) => employee.dept === unit.name);
    const indent = depth * 18;
    const self = `
      <div class="row-item col" style="margin-left:${indent}px">
        <div class="row-title">${"└ ".repeat(depth)}${unit.name}</div>
        <div class="row-desc">팀장: ${unit.leaderId ? (findEmployee(unit.leaderId)?.name || "미지정") : "미지정"} · 인원 ${members.length}명</div>
      </div>
    `;
    const children = (childrenMap.get(unit.id) || []).map((child) => renderNode(child, depth + 1)).join("");
    return self + children;
  };
  return (childrenMap.get("root") || []).map((unit) => renderNode(unit, 0)).join("");
}

function saveOrgUnit() {
  const editId = document.getElementById("org-edit-id").value;
  const name = document.getElementById("org-unit-name").value.trim();
  const parentId = document.getElementById("org-parent-id").value;
  const leaderId = document.getElementById("org-leader-id").value;
  const note = document.getElementById("org-unit-note").value.trim();
  if (!name) {
    alert("부서명을 입력해주세요.");
    return;
  }
  const duplicate = state.orgUnits.some((unit) => unit.name === name && unit.id !== editId);
  if (duplicate) {
    alert("같은 부서명이 이미 있습니다.");
    return;
  }
  if (editId) {
    const target = state.orgUnits.find((unit) => unit.id === editId);
    if (!target) return;
    target.name = name;
    target.parentId = parentId && parentId !== editId ? parentId : "";
    target.leaderId = leaderId;
    target.note = note;
  } else {
    state.orgUnits.push({
      id: `org_${Date.now()}`,
      name,
      parentId,
      leaderId,
      note
    });
  }
  touchState(`조직도 부서 저장 (${name})`);
  resetOrgUnitForm(false);
  renderErpView();
}

function resetOrgUnitForm(shouldRender = true) {
  ui.orgEditId = "";
  document.getElementById("org-edit-id").value = "";
  document.getElementById("org-unit-name").value = "";
  document.getElementById("org-parent-id").value = "";
  document.getElementById("org-leader-id").value = "";
  document.getElementById("org-unit-note").value = "";
  if (shouldRender) renderErpView();
}

function editOrgUnit(unitId) {
  const unit = state.orgUnits.find((item) => item.id === unitId);
  if (!unit) return;
  ui.orgEditId = unit.id;
  renderOrgUnitForm();
  document.getElementById("org-unit-name").value = unit.name || "";
  document.getElementById("org-parent-id").value = unit.parentId || "";
  document.getElementById("org-leader-id").value = unit.leaderId || "";
  document.getElementById("org-unit-note").value = unit.note || "";
}

function deleteOrgUnit(unitId) {
  const unit = state.orgUnits.find((item) => item.id === unitId);
  if (!unit) return;
  const usedByEmployees = state.employees.filter((employee) => employee.dept === unit.name);
  if (usedByEmployees.length) {
    alert(`해당 부서 소속 직원(${usedByEmployees.length}명)이 있어 삭제할 수 없습니다.`);
    return;
  }
  state.orgUnits = state.orgUnits.filter((item) => item.id !== unitId).map((item) => {
    if (item.parentId === unitId) item.parentId = "";
    return item;
  });
  touchState(`조직도 부서 삭제 (${unit.name})`);
  if (ui.orgEditId === unitId) ui.orgEditId = "";
  renderErpView();
}

function autoBuildOrgUnits() {
  const depts = [...new Set(state.employees.map((employee) => employee.dept).filter(Boolean))];
  state.orgUnits = depts.map((dept) => {
    const existing = state.orgUnits.find((unit) => unit.name === dept);
    return {
      id: existing?.id || `org_${Date.now()}_${dept}`,
      name: dept,
      parentId: existing?.parentId || "",
      leaderId: existing?.leaderId || "",
      note: existing?.note || "직원 목록 기준 자동동기화"
    };
  });
  touchState("직원 목록 기준 조직도 자동구성");
  renderErpView();
}

function saveBirthdayRule() {
  state.settings.birthdayRule = {
    base: document.getElementById("birthday-grant-rule").value,
    days: Number(document.getElementById("birthday-grant-days").value || 0.5),
    minMonths: Number(document.getElementById("birthday-min-months").value || 3)
  };
  touchState("생일반차 규칙 저장");
  renderHrView();
}

function runBirthdayHalfDayGrant() {
  const rule = state.settings.birthdayRule || defaultBirthdayRule();
  const year = ui.hrYear;
  const grants = [];
  state.employees.forEach((employee) => {
    if (!employee.birthDate || !employee.joinDate) return;
    const join = new Date(employee.joinDate);
    const 기준일 = new Date(year, 0, 1);
    const workedMonths = (기준일.getFullYear() - join.getFullYear()) * 12 + (기준일.getMonth() - join.getMonth());
    if (workedMonths < rule.minMonths) return;
    const month = Number(employee.birthDate.slice(5, 7));
    const day = Number(employee.birthDate.slice(8, 10));
    const date = rule.base === "birthday"
      ? `${year}-${pad(month)}-${pad(day)}`
      : `${year}-${pad(month)}-01`;
    const exists = state.specialLeaves.some((item) => item.empId === employee.id && item.reason === "생일반차" && item.date.startsWith(String(year)));
    if (exists) return;
    state.specialLeaves.push({
      id: `sp_birth_${employee.id}_${year}`,
      empId: employee.id,
      action: "grant",
      reason: "생일반차",
      days: rule.days,
      date,
      evidence: "자동부여",
      memo: `${year}년 생일반차 자동부여`
    });
    grants.push(`${employee.name} ${date}`);
  });
  state.settings.laborRuleLog = grants.length
    ? `생일반차 자동부여 ${grants.length}건\n${grants.join("\n")}`
    : "생일반차 자동부여 대상이 없거나 이미 부여되었습니다.";
  touchState("생일반차 자동부여 실행");
  renderAll();
}

async function loadLaborRule() {
  const year = document.getElementById("labor-rule-year").value;
  try {
    const response = await fetch(`./rules/labor/${year}.json?ts=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`룰파일 로드 실패 (${response.status})`);
    const rule = await response.json();
    state.settings.laborRuleCache[year] = rule;
    state.settings.laborRuleLog = `${year} 룰파일 로드 완료\n시행일: ${rule.effectiveFrom} ~ ${rule.effectiveTo}\n핵심: ${rule.summary || "-"}`;
    renderHrView();
  } catch (error) {
    state.settings.laborRuleLog = `룰파일 로드 실패: ${error.message}`;
    renderHrView();
  }
}

function activateLaborRuleYear() {
  const year = Number(document.getElementById("labor-rule-year").value || ui.hrYear);
  state.settings.activeLaborRuleYear = year;
  const rule = state.settings.laborRuleCache[String(year)];
  state.settings.laborRuleLog = rule
    ? `${year} 룰 활성화 완료\n요약: ${rule.summary || "-"}`
    : `${year} 룰 활성화 완료(캐시 없음, 먼저 룰파일 불러오기를 실행하세요).`;
  touchState(`${year} 법령 룰 활성화`);
  renderHrView();
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
        ${["dashboard", "leave", "cal", "hist", "set", "emp", "mgr", "sub", "spe", "office", "hr", "datahub", "erp", "sync"].map((menu) => `
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

  const filtered = state.employees.filter((employee) => {
    const summary = employeeSummary(employee.id, ui.managerYear);
    const matchName = !ui.managerFilter.search || employee.name.toLowerCase().includes(ui.managerFilter.search);
    const matchDept = !ui.managerFilter.dept || (employee.dept || "").toLowerCase().includes(ui.managerFilter.dept);
    const risk = summary.alertLevel === "urgent" || summary.alertLevel === "warning";
    const matchRisk = ui.managerFilter.risk === "all"
      || (ui.managerFilter.risk === "risk" && risk)
      || (ui.managerFilter.risk === "safe" && !risk);
    const min = Number(ui.managerFilter.usageMin || 0);
    const max = Number(ui.managerFilter.usageMax || 100);
    const matchUsage = summary.usagePercent >= min && summary.usagePercent <= max;
    return matchName && matchDept && matchRisk && matchUsage;
  });

  document.getElementById("manager-body").innerHTML = filtered.map((employee) => {
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
  document.getElementById("admin-password").value = "";
  document.getElementById("auto-save-toggle").checked = !!getSyncPrefs().autoSave;
  document.getElementById("last-saved-at").textContent = lastSavedAt || "없음";
  document.getElementById("last-loaded-at").textContent = lastLoadedAt || "없음";
  document.getElementById("sync-detail-status").textContent = syncStatus.label;
  document.getElementById("sync-log").textContent = syncStatus.detail;
  const archive = getArchiveSnapshots();
  document.getElementById("snapshot-log").textContent = archive.length
    ? archive.slice(0, 10).map((item, index) => `${index + 1}. ${item.at} · ${item.message}`).join("\n")
    : "아직 저장된 스냅샷이 없습니다.";
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
  if (view === "perm" && !confirmAdminAccess()) return;
  if (!hasMenuAccess(currentUser()?.id, view)) return;
  ui.activeView = view;
  document.querySelectorAll(".view").forEach((section) => section.classList.remove("active"));
  document.getElementById(`view-${view}`)?.classList.add("active");
  renderNavigation();
  renderActiveView();
}

function confirmAdminAccess() {
  const savedHash = localStorage.getItem(STORAGE_KEYS.adminPw);
  if (!savedHash) return true;
  const input = window.prompt("권한 관리 화면 비밀번호를 입력해 주세요.");
  if (!input) return false;
  return btoa(unescape(encodeURIComponent(input))) === savedHash;
}

function confirmAdminAccess() {
  const savedHash = localStorage.getItem(STORAGE_KEYS.adminPw);
  if (!savedHash) return true;
  const input = window.prompt("권한 관리 화면 비밀번호를 입력해 주세요.");
  if (!input) return false;
  return btoa(unescape(encodeURIComponent(input))) === savedHash;
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

function renderSpecialRow(item) {
  return `
    <div class="row-item">
      <div class="row-main">
        <div class="row-title">${item.date} · ${item.reason} · ${item.action === "grant" ? "부여" : "사용"} ${item.days}일</div>
        <div class="row-desc">증빙: ${item.evidence || "-"} / 메모: ${item.memo || "-"}</div>
      </div>
      <div class="button-row">
        <span class="tag ${item.action === "grant" ? "green" : "red"}">${item.action === "grant" ? "+" : "-"}${item.days}</span>
        <button class="action-link" type="button" data-special-delete="${item.id}">삭제</button>
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
    <label class="field-label">프로필 이미지 URL</label>
    <input id="employee-photo" class="field" type="text" value="${employee?.photo || ""}" placeholder="https://... 또는 아래 파일 업로드">
    <label class="field-label">프로필 이미지 파일 업로드</label>
    <input id="employee-photo-file" class="field" type="file" accept="image/*">
    <div class="hint-box">이미지는 URL 또는 파일 업로드(브라우저 내 Base64)로 등록할 수 있습니다.</div>
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
  document.getElementById("employee-photo-file").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      document.getElementById("employee-photo").value = String(reader.result || "");
    };
    reader.readAsDataURL(file);
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
  const photo = document.getElementById("employee-photo").value.trim();
  if (!name) {
    alert("이름을 입력해 주세요.");
    return;
  }

  if (empId) {
    const employee = employeeById(empId);
    Object.assign(employee, { name, dept, role, joinDate, color, photo });
  } else {
    const newId = `e${Date.now()}`;
    state.employees.push({ id: newId, name, dept, role, joinDate, color, photo });
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

function openBulkSubLeaveModal() {
  openModal("대체휴가 일괄 부여", "여러 직원을 체크해서 같은 일수와 날짜로 한 번에 부여합니다.", `
    <div class="hint-box">일괄 기능은 부여 전용입니다. 사용 차감은 기존 개별 입력으로 관리해 주세요.</div>
    <label class="field-label">부여할 직원</label>
    <div class="stacked-fields">
      ${state.employees.map((employee) => `
        <label class="checkbox-row">
          <input type="checkbox" data-bulk-emp="${employee.id}" ${employee.id === ui.subEmployeeId ? "checked" : ""}>
          <span>${employee.name} · ${employee.dept || "부서 미지정"}</span>
        </label>
      `).join("")}
    </div>
    <div class="button-row">
      <button class="btn ghost small" type="button" id="bulk-select-all">전체 선택</button>
      <button class="btn ghost small" type="button" id="bulk-clear-all">선택 해제</button>
    </div>
    <label class="field-label">일수</label>
    <input id="bulk-sub-days" class="field" type="number" min="0.5" step="0.5" value="1">
    <label class="field-label">날짜</label>
    <input id="bulk-sub-date" class="field" type="date" value="${formatDateKey(new Date())}">
    <label class="field-label">메모</label>
    <textarea id="bulk-sub-memo" class="field" rows="3" placeholder="예: 공휴일 근무 보상"></textarea>
    <div class="button-row">
      <button class="btn ghost" type="button" data-action="close-modal">취소</button>
      <button class="btn primary" type="button" id="bulk-sub-save-btn">일괄 부여 저장</button>
    </div>
  `);

  document.getElementById("bulk-select-all").addEventListener("click", () => {
    document.querySelectorAll("[data-bulk-emp]").forEach((input) => {
      input.checked = true;
    });
  });

  document.getElementById("bulk-clear-all").addEventListener("click", () => {
    document.querySelectorAll("[data-bulk-emp]").forEach((input) => {
      input.checked = false;
    });
  });

  document.getElementById("bulk-sub-save-btn").addEventListener("click", saveBulkSubLeaveFromModal);
}

function openSpecialLeaveModal() {
  const options = state.employees.map((employee) => `<option value="${employee.id}" ${employee.id === ui.specialEmployeeId ? "selected" : ""}>${employee.name}</option>`).join("");
  openModal("특별휴가 등록", "연차와 별개로 독립 잔여일수로 관리됩니다.", `
    <label class="field-label">직원</label>
    <select id="special-emp" class="field">${options}</select>
    <label class="field-label">처리</label>
    <select id="special-action" class="field">
      <option value="grant">부여</option>
      <option value="use">사용</option>
    </select>
    <label class="field-label">사유</label>
    <select id="special-reason" class="field">
      <option value="경조사">경조사</option>
      <option value="병가">병가</option>
      <option value="포상휴가">포상휴가</option>
      <option value="생일반차">생일반차</option>
      <option value="기타휴가">기타휴가</option>
    </select>
    <label class="field-label">일수</label>
    <input id="special-days" class="field" type="number" min="0.5" step="0.5" value="1">
    <label class="field-label">날짜</label>
    <input id="special-date" class="field" type="date" value="${formatDateKey(new Date())}">
    <label class="field-label">증빙 서류 (파일명/링크 메모)</label>
    <input id="special-evidence" class="field" type="text" placeholder="예: 병가진단서_홍길동_2026-04.pdf">
    <label class="field-label">메모</label>
    <textarea id="special-memo" class="field" rows="3"></textarea>
    <div class="button-row">
      <button class="btn ghost" type="button" data-action="close-modal">취소</button>
      <button class="btn primary" type="button" id="special-save-btn">저장</button>
    </div>
  `);
  document.getElementById("special-reason").addEventListener("change", (event) => {
    if (event.target.value === "생일반차") {
      document.getElementById("special-days").value = "0.5";
    }
  });
  document.getElementById("special-save-btn").addEventListener("click", saveSpecialLeaveFromModal);
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

function saveBulkSubLeaveFromModal() {
  const employeeIds = Array.from(document.querySelectorAll("[data-bulk-emp]:checked")).map((input) => input.dataset.bulkEmp);
  const days = Number(document.getElementById("bulk-sub-days").value);
  const date = document.getElementById("bulk-sub-date").value;
  const memo = document.getElementById("bulk-sub-memo").value.trim();
  if (!employeeIds.length) {
    alert("직원을 한 명 이상 선택해 주세요.");
    return;
  }
  if (!date || !days) {
    alert("날짜와 일수를 확인해 주세요.");
    return;
  }
  employeeIds.forEach((empId, index) => {
    state.subLeaves.push({
      id: `s${Date.now()}_${index}`,
      empId,
      type: "grant",
      days,
      date,
      memo
    });
  });
  ui.subEmployeeId = employeeIds[0];
  touchState("대체휴가 일괄 부여");
  closeModal();
  renderAll();
}

function saveSpecialLeaveFromModal() {
  const empId = document.getElementById("special-emp").value;
  const action = document.getElementById("special-action").value;
  const reason = document.getElementById("special-reason").value;
  const days = Number(document.getElementById("special-days").value);
  const date = document.getElementById("special-date").value;
  const evidence = document.getElementById("special-evidence").value.trim();
  const memo = document.getElementById("special-memo").value.trim();

  if (!date || !days || days <= 0) {
    alert("날짜와 일수를 확인해 주세요.");
    return;
  }
  if (action === "use" && specialBalanceByReason(empId, reason) < days) {
    alert(`해당 사유의 잔여 일수(${specialBalanceByReason(empId, reason)}일)보다 많이 사용할 수 없습니다.`);
    return;
  }

  state.specialLeaves.push({
    id: `sp${Date.now()}`,
    empId,
    action,
    reason,
    days,
    date,
    evidence,
    memo
  });
  ui.specialEmployeeId = empId;
  touchState("특별휴가 저장");
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
  state.specialLeaves = state.specialLeaves.filter((item) => item.empId !== empId);
  Object.keys(state.hrRecords).forEach((key) => {
    if (key.startsWith(`${empId}_`)) delete state.hrRecords[key];
  });
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

function deleteSpecialLeave(specialId) {
  if (!window.confirm("이 특별휴가 이력을 삭제할까요?")) return;
  state.specialLeaves = state.specialLeaves.filter((item) => item.id !== specialId);
  touchState("특별휴가 이력 삭제");
  renderAll();
}

document.body.addEventListener("click", (event) => {
  const recordDelete = event.target.closest("[data-record-delete]");
  if (recordDelete) deleteRecord(recordDelete.dataset.recordDelete);
});

function addSettingYear() {
  const nextYear = Math.max(...allYears()) + 1;
  const key = `${ui.settingsEmployeeId}_${nextYear}`;
  state.totals[key] = state.totals[key] ?? accrual(
    employeeById(ui.settingsEmployeeId)?.joinDate,
    nextYear,
    employeeById(ui.settingsEmployeeId)?.fiscalYearMonth
  );
  renderSettings();
}

function touchState(message) {
  state.updatedAt = new Date().toISOString();
  state.auditLogs.unshift({
    message,
    at: formatDateTime(new Date())
  });
  state.auditLogs = state.auditLogs.slice(0, 200);
  localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify(state));
  archiveSnapshot(`자동저장: ${message}`);
  const prefs = getSyncPrefs();
  if (prefs.autoSave) {
    scheduleSharedSave(message);
  } else {
    setSyncStatus("idle", "초안", `${message} 완료 · 자동저장이 꺼져 있습니다.`);
  }
}

function saveOpsMemo() {
  state.settings.opsMemo = document.getElementById("ops-memo").value.trim();
  touchState("운영 메모 저장");
  renderDashboard();
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
    archiveSnapshot(`배포 저장: ${message}`);
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

function saveAdminPassword() {
  const password = document.getElementById("admin-password").value.trim();
  if (!password || password.length < 4) {
    alert("관리자 비밀번호는 4자리 이상 입력해 주세요.");
    return;
  }
  localStorage.setItem(STORAGE_KEYS.adminPw, btoa(unescape(encodeURIComponent(password))));
  document.getElementById("admin-password").value = "";
  setSyncStatus("success", "보안저장", "관리자 화면 비밀번호를 저장했습니다.");
  renderSyncStatus();
}

function clearAdminPassword() {
  localStorage.removeItem(STORAGE_KEYS.adminPw);
  document.getElementById("admin-password").value = "";
  setSyncStatus("idle", "보안해제", "관리자 화면 비밀번호를 제거했습니다.");
  renderSyncStatus();
}

function downloadBackup() {
  const blob = new Blob([`${JSON.stringify(state, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `guro_huga_backup_${formatDateKey(new Date())}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importBackupSnapshot(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(String(reader.result || "{}"));
      state = imported;
      normalizeState();
      initializeSelections();
      touchState("백업 복원");
      renderAll();
      alert("백업 복원을 완료했습니다.");
    } catch (error) {
      alert(`백업 파일 오류: ${error.message}`);
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file, "utf-8");
}

function exportCategoryExcel() {
  if (typeof XLSX === "undefined") {
    alert("엑셀 라이브러리를 불러오지 못했습니다.");
    return;
  }
  const category = document.getElementById("category-select").value;
  const rows = categoryRows(category);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), category);
  XLSX.writeFile(workbook, `guro_huga_${category}_${formatDateKey(new Date())}.xlsx`);
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
      applyCategoryRows(category, rows);
      normalizeState();
      initializeSelections();
      touchState(`카테고리 업로드: ${category}`);
      renderAll();
      alert(`${category} 카테고리 업로드를 반영했습니다.`);
    } catch (error) {
      alert(`카테고리 업로드 오류: ${error.message}`);
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsArrayBuffer(file);
}

function categoryRows(category) {
  if (category === "employees") return state.employees;
  if (category === "records") return state.records;
  if (category === "subLeaves") return state.subLeaves;
  if (category === "specialLeaves") return state.specialLeaves;
  if (category === "hrRecords") {
    return Object.entries(state.hrRecords).map(([key, value]) => ({ key, ...value }));
  }
  if (category === "perms") {
    return Object.entries(state.perms).map(([empId, value]) => ({ empId, ...value }));
  }
  return [];
}

function applyCategoryRows(category, rows) {
  if (category === "employees") state.employees = rows;
  if (category === "records") state.records = rows;
  if (category === "subLeaves") state.subLeaves = rows;
  if (category === "specialLeaves") state.specialLeaves = rows;
  if (category === "hrRecords") {
    state.hrRecords = {};
    rows.forEach((row) => {
      const key = String(row.key || "").trim();
      if (!key) return;
      const next = { ...row };
      delete next.key;
      state.hrRecords[key] = next;
    });
  }
  if (category === "perms") {
    state.perms = {};
    rows.forEach((row) => {
      const empId = String(row.empId || "").trim();
      if (!empId) return;
      const next = { ...row };
      delete next.empId;
      state.perms[empId] = next;
    });
  }
}

function archiveSnapshot(message) {
  const archive = getArchiveSnapshots();
  archive.unshift({
    at: formatDateTime(new Date()),
    message,
    state: JSON.parse(JSON.stringify(state))
  });
  localStorage.setItem(STORAGE_KEYS.archive, JSON.stringify(archive.slice(0, 30)));
}

function getArchiveSnapshots() {
  return readJsonStorage(STORAGE_KEYS.archive) || [];
}

function downloadCurrentSnapshot() {
  const blob = new Blob([`${JSON.stringify(state, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `guro_huga_snapshot_${formatDateKey(new Date())}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function restoreLastSnapshot() {
  const archive = getArchiveSnapshots();
  if (!archive.length) {
    alert("복원할 스냅샷이 없습니다.");
    return;
  }
  state = archive[0].state;
  normalizeState();
  initializeSelections();
  touchState("최근 스냅샷 복원");
  renderAll();
}

function currentUser() {
  return employeeById(ui.selectedEmployeeId) || state.employees[0] || null;
}

function employeeById(empId) {
  return state.employees.find((employee) => employee.id === empId);
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
    adjustmentAllowance: 0,
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

function defaultWelfareStandard() {
  return {
    name: "서울시 사회복지시설 인사·노무 기준 템플릿",
    weeklyHours: 40,
    retirementNote: "퇴직금은 근로기준법/근로자퇴직급여보장법 및 시설 운영지침 최신판을 기준으로 산정",
    educationNote: "직장 내 성희롱 예방, 장애인 인식개선, 개인정보보호, 산업안전보건 등 법정의무교육 이수 관리 필요"
  };
}

function defaultBirthdayRule() {
  return {
    base: "month_start",
    days: 0.5,
    minMonths: 3
  };
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

function defaultSeoulPayGradeTable2026() {
  const level2 = [3169000, 3239000, 3312000, 3390000, 3470000, 3563000, 3663000, 3763000, 3863000, 3963000, 4063000, 4163000, 4263000, 4363000, 4444000, 4524000, 4602000, 4672000, 4738000, 4802000, 4862000, 4923000, 4985000, 5046000, 5107000, 5170000, 5233000, 5296000, 5360000, 5424000, 5484000];
  const level3 = [2703000, 2784000, 2872000, 2969000, 3068000, 3167000, 3266000, 3365000, 3475000, 3575000, 3675000, 3730000, 3785000, 3850000, 3915000, 4006000, 4073000, 4147000, 4212000, 4278000, 4339000, 4399000, 4454000, 4513000, 4568000, 4620000, 4681000, 4744000, 4807000, 4867000, 4917000];
  const level4 = [2550000, 2577000, 2604000, 2631000, 2712000, 2812000, 2912000, 3004000, 3102000, 3202000, 3298000, 3359000, 3426000, 3494000, 3566000, 3637000, 3708000, 3776000, 3841000, 3902000, 3966000, 4020000, 4073000, 4122000, 4176000, 4223000, 4270000, 4317000, 4364000, 4411000, 4461000];
  const level5 = [2518000, 2545000, 2572000, 2597000, 2618000, 2638000, 2659000, 2743000, 2842000, 2929000, 3008000, 3069000, 3148000, 3228000, 3281000, 3354000, 3401000, 3472000, 3530000, 3590000, 3644000, 3699000, 3748000, 3796000, 3843000, 3889000, 3935000, 3979000, 4023000, 4063000, 4113000];
  const manager = [2492000, 2519000, 2546000, 2571000, 2593000, 2616000, 2643000, 2664000, 2761000, 2844000, 2941000, 2996000, 3053000, 3104000, 3162000, 3218000, 3265000, 3330000, 3388000, 3448000, 3527000, 3585000, 3639000, 3701000, 3740000, 3789000, 3839000, 3898000, 3960000, 4018000, 4078000];
  const functional = [2466000, 2493000, 2520000, 2545000, 2567000, 2591000, 2618000, 2640000, 2661000, 2705000, 2780000, 2847000, 2893000, 2959000, 3010000, 3081000, 3157000, 3218000, 3272000, 3336000, 3410000, 3471000, 3530000, 3574000, 3629000, 3679000, 3729000, 3789000, 3849000, 3909000, 3969000];
  const level1 = { 16: 4912000, 17: 4969000, 18: 5022000, 19: 5096000, 20: 5173000, 21: 5271000, 22: 5336000, 23: 5395000, 24: 5451000, 25: 5506000, 26: 5577000, 27: 5622000, 28: 5661000, 29: 5729000, 30: 5788000 };

  const rows = [];
  Object.entries(level1).forEach(([step, basePay]) => rows.push({ grade: "일반직", level: "1급", step: Number(step), basePay }));
  level2.forEach((basePay, idx) => rows.push({ grade: "일반직", level: "2급", step: idx + 1, basePay }));
  level3.forEach((basePay, idx) => rows.push({ grade: "일반직", level: "3급", step: idx + 1, basePay }));
  level4.forEach((basePay, idx) => rows.push({ grade: "일반직", level: "4급", step: idx + 1, basePay }));
  level5.forEach((basePay, idx) => rows.push({ grade: "일반직", level: "5급", step: idx + 1, basePay }));
  manager.forEach((basePay, idx) => rows.push({ grade: "관리직", level: "관리직", step: idx + 1, basePay }));
  functional.forEach((basePay, idx) => rows.push({ grade: "기능직", level: "기능직", step: idx + 1, basePay }));
  return rows;
}

function recordsOnDate(empId, date) {
  return state.records.filter((record) => record.empId === empId && record.date === date);
}

function latestRecord(empId, year) {
  return state.records
    .filter((record) => record.empId === empId && record.date.startsWith(String(year)))
    .sort((left, right) => right.date.localeCompare(left.date))[0];
}

function accrual(joinDate, year, fiscalYearMonth = 1) {
  if (!joinDate) return 15;
  const join = new Date(joinDate);
  const ref = new Date(year, Math.max(0, Number(fiscalYearMonth || 1) - 1), 1);
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
  const employee = employeeById(empId);
  return accrual(employee?.joinDate, year, employee?.fiscalYearMonth);
}

function leaveDelta(type) {
  if (type === "연차") return 1;
  if (type.startsWith("반반차")) return 0.25;
  return 0.5;
}

function calcRetirementPayout(empId, year) {
  const employee = employeeById(empId);
  const summary = employeeSummary(empId, year);
  const monthlyBasePay = Number(employee?.monthlyBasePay || 0);
  const workHoursPerDay = Number(employee?.workHoursPerDay || state.settings.defaultWorkHoursPerDay || 8);
  const monthlyStandardHours = Number(state.settings.monthlyStandardHours || 209);
  const directUnitPrice = Number(employee?.leaveUnitPrice || 0);

  let unitPrice = 0;
  let formula = "1일 정산 단가를 직접 입력하거나 월 통상임금을 입력하면 계산됩니다.";
  let note = "퇴사 정산 참고용 계산입니다.";

  if (directUnitPrice > 0) {
    unitPrice = directUnitPrice;
    formula = "미사용 연차 × 직접 입력한 1일 연차 정산 단가";
    note = "직접 입력한 단가를 우선 사용했습니다.";
  } else if (monthlyBasePay > 0) {
    const hourlyPay = monthlyBasePay / monthlyStandardHours;
    unitPrice = hourlyPay * workHoursPerDay;
    formula = `미사용 연차 × (월 통상임금 ${monthlyBasePay.toLocaleString("ko-KR")}원 ÷ ${monthlyStandardHours}시간 × ${workHoursPerDay}시간)`;
    note = "월 통상임금 기준으로 1일 정산 단가를 계산했습니다.";
  }

  return {
    remainingDays: Math.max(0, summary.remain),
    unitPrice,
    amount: Math.round(Math.max(0, summary.remain) * unitPrice),
    formula,
    note
  };
}

function saveSettingsFromView() {
  const employee = employeeById(ui.settingsEmployeeId);
  if (!employee) return;

  const joinDate = document.getElementById("join-date").value;
  const fiscalYearMonth = Number(document.getElementById("fiscal-year-month").value || 1);
  const resignationDate = document.getElementById("resignation-date").value;
  const monthlyBasePay = Number(document.getElementById("monthly-base-pay").value || 0);
  const workHoursPerDay = Number(document.getElementById("work-hours-per-day").value || state.settings.defaultWorkHoursPerDay || 8);
  const monthlyStandardHours = Number(document.getElementById("monthly-standard-hours").value || 209);
  const leaveUnitPrice = Number(document.getElementById("leave-unit-price").value || 0);
  const employmentRules = document.getElementById("employment-rules").value.trim() || defaultEmploymentRules();

  employee.joinDate = joinDate;
  employee.fiscalYearMonth = fiscalYearMonth;
  employee.resignationDate = resignationDate;
  employee.monthlyBasePay = monthlyBasePay;
  employee.workHoursPerDay = workHoursPerDay;
  employee.leaveUnitPrice = leaveUnitPrice;
  state.settings.monthlyStandardHours = monthlyStandardHours;
  state.settings.employmentRules = employmentRules;

  document.querySelectorAll("[data-total-emp]").forEach((input) => {
    const empId = input.dataset.totalEmp;
    const year = input.dataset.totalYear;
    state.totals[`${empId}_${year}`] = Number(input.value || 0);
  });

  touchState("연차 설정 저장");
  renderAll();
}

function exportExcelSnapshot() {
  if (typeof XLSX === "undefined") {
    alert("엑셀 라이브러리를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
    return;
  }

  const year = ui.managerYear;
  const admin = isCurrentAdmin();
  const summaryRows = state.employees.map((employee) => {
    const summary = employeeSummary(employee.id, year);
    return {
      기준연도: year,
      직원ID: employee.id,
      이름: employee.name,
      부서: employee.dept || "",
      직책: employee.role || "",
      프로필이미지: employee.photo || "",
      생년월일: admin ? (employee.birthDate || "") : "",
      개인정보메모: admin ? (employee.personalInfo || "") : "",
      입사일: employee.joinDate || "",
      회계년도시작월: employee.fiscalYearMonth || 1,
      퇴사일: employee.resignationDate || "",
      생성연차: summary.total,
      사용연차: summary.used,
      잔여연차: summary.remain,
      사용률: `${summary.usagePercent}%`,
      월통상임금: employee.monthlyBasePay || 0,
      일근로시간: employee.workHoursPerDay || 0,
      일정산단가: employee.leaveUnitPrice || 0
    };
  });

  const employeeRows = state.employees.map((employee) => ({
    직원ID: employee.id,
    이름: employee.name,
    부서: employee.dept || "",
    직책: employee.role || "",
    프로필이미지: employee.photo || "",
    생년월일: admin ? (employee.birthDate || "") : "",
    개인정보메모: admin ? (employee.personalInfo || "") : "",
    입사일: employee.joinDate || "",
    회계년도시작월: employee.fiscalYearMonth || 1,
    퇴사일: employee.resignationDate || "",
    월통상임금: employee.monthlyBasePay || 0,
    일근로시간: employee.workHoursPerDay || 0,
    일정산단가: employee.leaveUnitPrice || 0
  }));

  const subLeaveRows = state.subLeaves.map((item) => ({
    직원ID: item.empId,
    이름: employeeById(item.empId)?.name || "",
    유형: item.type,
    일수: item.days,
    날짜: item.date,
    메모: item.memo || ""
  }));
  const specialLeaveRows = state.specialLeaves.map((item) => ({
    직원ID: item.empId,
    이름: employeeById(item.empId)?.name || "",
    처리: item.action,
    사유: item.reason,
    일수: item.days,
    날짜: item.date,
    증빙: item.evidence || "",
    메모: item.memo || ""
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), "연차현황");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(employeeRows), "직원기본정보");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(subLeaveRows), "대체휴가");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(specialLeaveRows), "특별휴가");

  const fileName = `guro_huga_summary_${year}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

function importExcelSnapshot(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (typeof XLSX === "undefined") {
    alert("엑셀 라이브러리를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
    event.target.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = (loadEvent) => {
    try {
      const workbook = XLSX.read(loadEvent.target.result, { type: "array" });
      const infoSheet = workbook.Sheets["직원기본정보"];
      const summarySheet = workbook.Sheets["연차현황"];
      const specialSheet = workbook.Sheets["특별휴가"];

      if (!infoSheet) {
        throw new Error("'직원기본정보' 시트를 찾을 수 없습니다.");
      }

      const employeeRows = XLSX.utils.sheet_to_json(infoSheet, { defval: "" });
      const summaryRows = summarySheet ? XLSX.utils.sheet_to_json(summarySheet, { defval: "" }) : [];

      mergeEmployeesFromExcel(employeeRows);
      mergeTotalsFromExcel(summaryRows);
      mergeSpecialLeavesFromExcel(specialSheet ? XLSX.utils.sheet_to_json(specialSheet, { defval: "" }) : []);
      normalizeState();
      initializeSelections();
      touchState("엑셀 업로드 반영");
      renderAll();
      alert("엑셀 업로드 내용을 반영했습니다.");
    } catch (error) {
      alert(`엑셀 업로드 중 오류가 발생했습니다: ${error.message}`);
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsArrayBuffer(file);
}

function saveHrInfoFromView() {
  const year = ui.hrYear;
  const admin = isCurrentAdmin();
  state.employees.forEach((employee) => {
    const record = getHrRecord(employee.id, year);
    const dept = document.querySelector(`[data-hr-dept="${employee.id}"]`)?.value.trim() || "";
    const role = document.querySelector(`[data-hr-role="${employee.id}"]`)?.value.trim() || "";
    const joinDate = document.querySelector(`[data-hr-join="${employee.id}"]`)?.value || "";
    const stepMonth = document.querySelector(`[data-hr-step="${employee.id}"]`)?.value || "";
    const promotionMonth = document.querySelector(`[data-hr-promotion="${employee.id}"]`)?.value || "";
    const careerYears = Number(document.querySelector(`[data-hr-career="${employee.id}"]`)?.value || 0);
    const certifications = document.querySelector(`[data-hr-cert="${employee.id}"]`)?.value.trim() || "";
    const workType = document.querySelector(`[data-hr-work="${employee.id}"]`)?.value.trim() || "";
    const status = document.querySelector(`[data-hr-status="${employee.id}"]`)?.value.trim() || "";
    record.dept = dept;
    record.role = role;
    record.joinDate = joinDate;
    record.stepMonth = stepMonth;
    record.promotionMonth = promotionMonth;
    record.careerYears = careerYears;
    record.certifications = certifications;
    record.workType = workType;
    record.status = status;
    state.hrRecords[`${employee.id}_${year}`] = record;
    employee.dept = dept || employee.dept;
    employee.role = role || employee.role;
    employee.joinDate = joinDate || employee.joinDate;

    if (admin) {
      employee.birthDate = document.querySelector(`[data-hr-birth="${employee.id}"]`)?.value || "";
      employee.personalInfo = document.querySelector(`[data-hr-personal="${employee.id}"]`)?.value.trim() || "";
    }
  });
  touchState(admin ? "년도별 인사정보 저장" : "년도별 인사정보 저장(관리자 민감정보 제외)");
  renderAll();
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
    const autoTax = calculateAutoTax(record.monthlySalary);
    const manualTax = record.monthlySalary * (record.manualTaxRate / 100);
    record.withholdingTax = Math.round(record.taxMode === "manual" ? manualTax : autoTax);
    record.socialInsurance = Number(document.querySelector(`[data-pay-insurance="${employee.id}"]`)?.value || 0);
    record.spouseCount = Number(document.querySelector(`[data-pay-spouse="${employee.id}"]`)?.value || 0);
    record.childCount = Number(document.querySelector(`[data-pay-child="${employee.id}"]`)?.value || 0);
    record.otherDependentCount = Number(document.querySelector(`[data-pay-other="${employee.id}"]`)?.value || 0);
    record.adjustmentAllowance = Number(document.querySelector(`[data-pay-adjust="${employee.id}"]`)?.value || 0);
    record.overtimeHours = Number(document.querySelector(`[data-pay-ot="${employee.id}"]`)?.value || 0);
    record.holidayOvertimeHours = Number(document.querySelector(`[data-pay-hot="${employee.id}"]`)?.value || 0);
    const allowancePack = calculateAllowancePackage(record, record.monthlySalary);
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
  state.settings.payGradeTable = state.settings.payGradeTable || [];
  state.settings.payGradeTable.push({ grade: "", level: "", step: 1, basePay: 0 });
  renderPayGradeTable();
}

function savePayGradeTable() {
  const size = (state.settings.payGradeTable || []).length;
  state.settings.payGradeTable = Array.from({ length: size }, (_item, index) => ({
    grade: document.querySelector(`[data-grade-name="${index}"]`)?.value.trim() || "",
    level: document.querySelector(`[data-grade-level="${index}"]`)?.value.trim() || "",
    step: Number(document.querySelector(`[data-grade-step="${index}"]`)?.value || 1),
    basePay: Number(document.querySelector(`[data-grade-pay="${index}"]`)?.value || 0)
  })).filter((item) => item.grade || item.level || item.basePay > 0);

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
  touchState("직급/호봉 임금 테이블 저장");
  renderHrView();
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

function calculateAllowancePackage(record, basePay) {
  const rule = state.settings.allowanceRules || defaultAllowanceRules();
  const spouseCount = Number(record.spouseCount || 0);
  const childCount = Number(record.childCount || 0);
  const otherCount = Number(record.otherDependentCount || 0);
  const childAllowance = (childCount >= 1 ? rule.child1 : 0) + (childCount >= 2 ? rule.child2 : 0) + (childCount >= 3 ? (childCount - 2) * rule.child3Plus : 0);
  const familyAllowance = (spouseCount > 0 ? rule.spouse : 0) + childAllowance + (otherCount * rule.otherDependent);
  const managerAllowance = record.payGrade === "관리직" ? rule.manager : 0;
  const adjustment = Number(record.adjustmentAllowance || rule.defaultAdjustment || 0);
  const meal = rule.meal;
  const holidayBonusMonthly = basePay * 1.2 / 12;
  const ordinaryWage = basePay + meal + adjustment + holidayBonusMonthly;
  const hourly = ordinaryWage / 209;
  const overtimeAllowance = (Number(record.overtimeHours || 0) * hourly * 1.5) + (Number(record.holidayOvertimeHours || 0) * hourly * 2);
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
      leaveUnitPrice: Number(row["일정산단가"] || existing?.leaveUnitPrice || 0)
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
