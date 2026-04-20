(function () {
  function parseStateTimestamp(value) {
    if (!value || typeof value !== "string") return 0;
    const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value)
      ? value.replace(" ", "T")
      : value;
    const parsed = Date.parse(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function scoreStateCompleteness(data) {
    if (!data || typeof data !== "object") return -1;
    const settings = data.settings || {};
    let score = 0;
    score += (data.employees?.length || 0) * 20;
    score += (data.records?.length || 0) * 16;
    score += (data.subLeaves?.length || 0) * 12;
    score += (data.specialLeaves?.length || 0) * 12;
    score += Object.keys(data.totals || {}).length * 8;
    score += Object.keys(data.hrRecords || {}).length * 10;
    score += (data.orgUnits?.length || 0) * 8;
    score += Math.min(data.auditLogs?.length || 0, 20);
    score += settings.simpleTaxTable?.length ? 40 : 0;
    score += settings.payGradeTable?.length ? 24 : 0;
    score += settings.allowanceRules ? 12 : 0;
    score += settings.welfareStandard ? 12 : 0;
    score += settings.employmentRules ? 8 : 0;
    return score;
  }

  function selectPreferredState(draft, remote) {
    if (!draft && !remote) {
      return { state, tone: "idle", label: "대기", detail: "불러올 데이터가 없습니다." };
    }
    if (!draft && remote) {
      return { state: remote, tone: "success", label: "공유", detail: "공유 JSON 데이터를 불러왔습니다." };
    }
    if (draft && !remote) {
      return { state: draft, tone: "idle", label: "초안", detail: "공유 데이터 대신 로컬 초안을 유지했습니다." };
    }

    const draftTime = parseStateTimestamp(draft.updatedAt);
    const remoteTime = parseStateTimestamp(remote.updatedAt);
    const draftScore = scoreStateCompleteness(draft);
    const remoteScore = scoreStateCompleteness(remote);

    if (draftTime > remoteTime + 60000) {
      return {
        state: draft,
        tone: "idle",
        label: "초안 유지",
        detail: "로컬 초안이 더 최신이라 공유 JSON 대신 유지했습니다."
      };
    }
    if (remoteTime > draftTime + 60000 && remoteScore + 10 >= draftScore) {
      return {
        state: remote,
        tone: "success",
        label: "공유",
        detail: "공유 JSON이 더 최신이라 로컬 초안 대신 적용했습니다."
      };
    }
    if (draftScore > remoteScore) {
      return {
        state: draft,
        tone: "idle",
        label: "초안 유지",
        detail: "공유 JSON보다 로컬 초안이 더 충실해서 초안을 유지했습니다."
      };
    }
    return { state: remote, tone: "success", label: "공유", detail: "공유 JSON 데이터를 불러왔습니다." };
  }

  function deriveTaxFamilyCount(record) {
    return Math.max(1, 1 + Number(record.spouseCount || 0) + Number(record.childCount || 0) + Number(record.otherDependentCount || 0));
  }

  function deriveTaxChildCount(record) {
    return Math.max(0, Number(record.childCount || 0));
  }

  function calculateLocalIncomeTax(withholdingTax) {
    const localRate = Number(state.settings.localTaxRate ?? 10) / 100;
    return Number(withholdingTax || 0) * localRate;
  }

  function payrollReferenceDate(year, employee) {
    if (employee?.resignationDate) {
      const resignDate = new Date(employee.resignationDate);
      if (!Number.isNaN(resignDate.getTime())) return resignDate;
    }
    const currentYear = new Date().getFullYear();
    return year >= currentYear ? new Date() : new Date(year, 11, 31);
  }

  function calculateServiceYears(joinDate, referenceDate) {
    if (!joinDate) return 0;
    const start = new Date(joinDate);
    const end = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return 0;
    return Math.round(((end - start) / (1000 * 60 * 60 * 24 * 365.25)) * 100) / 100;
  }

  function formatWon(value) {
    return `${Math.round(Number(value || 0)).toLocaleString("ko-KR")}원`;
  }

  function resolvePayrollBasePay(record, inputSalary = null) {
    const lookedUpMonthlySalary = calculatePayByGrade(record.payGrade, record.payLevel, record.payStep);
    const explicitInput = inputSalary !== null ? Number(inputSalary || 0) : null;
    const savedMonthlySalary = Number(record.monthlySalary || 0);
    const basePay = explicitInput !== null
      ? explicitInput || lookedUpMonthlySalary || savedMonthlySalary || 0
      : savedMonthlySalary || lookedUpMonthlySalary || 0;
    let salarySourceLabel = "기본급 미설정";
    let salarySourceTone = "red";
    if (lookedUpMonthlySalary > 0 && (!savedMonthlySalary || savedMonthlySalary === lookedUpMonthlySalary || explicitInput === lookedUpMonthlySalary)) {
      salarySourceLabel = "임금테이블 lookup";
      salarySourceTone = "green";
    } else if (savedMonthlySalary > 0 && lookedUpMonthlySalary > 0 && savedMonthlySalary !== lookedUpMonthlySalary) {
      salarySourceLabel = "저장값 우선";
      salarySourceTone = "amber";
    } else if (savedMonthlySalary > 0 || explicitInput > 0) {
      salarySourceLabel = "수동/저장 기본급";
      salarySourceTone = "amber";
    }
    return { basePay, salarySourceLabel, salarySourceTone };
  }

  function calculatePayrollSnapshot(employee, record, year, options = {}) {
    const resolvedPay = resolvePayrollBasePay(record, options.basePay ?? null);
    const taxMode = options.taxMode || record.taxMode || "hometax";
    const taxRatePercent = Number(options.taxRatePercent ?? record.taxRatePercent || 100);
    const manualTaxRate = Number(options.manualTaxRate ?? record.manualTaxRate || 0);
    const taxFamilyCount = Math.max(1, Number(options.taxFamilyCount ?? record.taxFamilyCount || deriveTaxFamilyCount(record)));
    const taxChildCount = Math.max(0, Number(options.taxChildCount ?? record.taxChildCount || deriveTaxChildCount(record)));
    const manualTaxInput = options.manualTaxInput !== undefined && options.manualTaxInput !== null && options.manualTaxInput !== ""
      ? Number(options.manualTaxInput || 0)
      : Number(record.withholdingTax || 0);
    const autoTax = calculateWithholdingTax(resolvedPay.basePay, taxFamilyCount, taxChildCount, taxRatePercent);
    const withholdingTax = Math.round(taxMode === "manual"
      ? (manualTaxInput > 0 ? manualTaxInput : (resolvedPay.basePay * (manualTaxRate / 100)))
      : autoTax);
    const localIncomeTax = Math.round(calculateLocalIncomeTax(withholdingTax));
    const insurance = Number(options.socialInsurance ?? record.socialInsurance || 0);
    const allowancePack = calculateAllowancePackage(record, resolvedPay.basePay, record.allowanceFlags);
    const grossPay = resolvedPay.basePay + allowancePack.totalAllowance;
    const netPay = grossPay - withholdingTax - localIncomeTax - insurance;
    const serviceYears = calculateServiceYears(employee?.joinDate || record.joinDate, payrollReferenceDate(year, employee));
    const autoSeverance = Math.round(grossPay * serviceYears);
    const taxSourceLabel = taxMode === "manual"
      ? "수동 원천세 입력"
      : (state.settings.simpleTaxTable?.length
        ? `간이세액표 lookup · ${taxFamilyCount}명/${taxChildCount}자녀`
        : `fallback 세율 ${Number(state.settings.hometaxRate || 0)}%`);
    return {
      ...resolvedPay,
      taxMode,
      taxRatePercent,
      manualTaxRate,
      taxFamilyCount,
      taxChildCount,
      withholdingTax,
      localIncomeTax,
      insurance,
      allowancePack,
      netPay,
      serviceYears,
      autoSeverance,
      taxSourceLabel
    };
  }

  function ensureHrPayrollHotfixStyle() {
    if (document.getElementById("hr-payroll-hotfix-style")) return;
    const style = document.createElement("style");
    style.id = "hr-payroll-hotfix-style";
    style.textContent = `
      .hotfix-payroll-card .table-wrap { overflow-x: auto; padding-bottom: 4px; }
      .hotfix-payroll-card .table { min-width: 2280px; }
      .hotfix-payroll-card .table th,
      .hotfix-payroll-card .table td { vertical-align: top; }
      .hotfix-payroll-card .table th:first-child,
      .hotfix-payroll-card .table td:first-child { position: sticky; left: 0; background: #fff; z-index: 1; }
      .hotfix-payroll-card .table th:first-child { background: #f7faf8; z-index: 2; }
      .hotfix-payroll-toolbar { display:flex; gap:8px; flex-wrap:wrap; justify-content:space-between; }
      .hotfix-table-stack { display:grid; gap:6px; min-width:120px; }
      .hotfix-payroll-value { font-size:13px; font-weight:700; white-space:nowrap; }
      .hotfix-payroll-card .tag { width: fit-content; }
      @media (max-width: 960px) {
        .hotfix-payroll-card .table th:first-child,
        .hotfix-payroll-card .table td:first-child { position: static; }
      }
    `;
    document.head.appendChild(style);
  }

  function findCardByTitle(viewId, titleText) {
    return Array.from(document.querySelectorAll(`#${viewId} .card`)).find((card) => {
      const title = card.querySelector(".card-title")?.textContent?.trim() || "";
      return title.includes(titleText);
    });
  }

  function enhanceHrPayrollLayout() {
    ensureHrPayrollHotfixStyle();
    const hrView = document.getElementById("view-hr");
    if (!hrView) return;
    const payrollCard = findCardByTitle("view-hr", "급여/세무/퇴직금 관리");
    const welfareCard = findCardByTitle("view-hr", "서울시 사회복지시설 기준 템플릿");
    const birthdayCard = findCardByTitle("view-hr", "생년월일");
    if (!payrollCard) return;

    const wrapper = payrollCard.parentElement;
    if (wrapper?.classList?.contains("layout-two")) {
      wrapper.parentElement.insertBefore(payrollCard, wrapper);
      if (welfareCard) {
        if (birthdayCard) {
          birthdayCard.after(welfareCard);
        } else {
          wrapper.parentElement.appendChild(welfareCard);
        }
      }
      if (!wrapper.querySelector(".card")) wrapper.remove();
    }

    payrollCard.classList.add("hotfix-payroll-card");
    payrollCard.querySelector(".card-meta").textContent = "임금테이블 lookup, 간이세액표, 수당/공제, 퇴직금 내부 추정까지 한 번에 관리";

    const cardBody = payrollCard.querySelector(".card-body") || payrollCard;
    let toolbar = payrollCard.querySelector(".hotfix-payroll-toolbar");
    if (!toolbar) {
      toolbar = document.createElement("div");
      toolbar.className = "button-row hotfix-payroll-toolbar";
      toolbar.innerHTML = `
        <button class="btn ghost small" type="button" data-action="open-erp-menu" data-view="payroll">임금 자동계산기 열기</button>
        <button class="btn ghost small" type="button" data-action="import-tax-table-excel">간이세액표 업로드</button>
        <button class="btn ghost small" type="button" data-action="import-pay-grade-excel">임금테이블 업로드</button>
        <button class="btn primary small" type="button" data-action="save-payroll-info">급여/세무/퇴직금 저장</button>
      `;
      cardBody.prepend(toolbar);
    }

    let summary = document.getElementById("payroll-summary");
    if (!summary) {
      summary = document.createElement("div");
      summary.id = "payroll-summary";
      summary.className = "kpi-grid four";
      toolbar.after(summary);
    }

    let footnote = document.getElementById("payroll-footnote");
    if (!footnote) {
      footnote = document.createElement("div");
      footnote.id = "payroll-footnote";
      footnote.className = "hint-box";
      summary.after(footnote);
    }

    const table = payrollCard.querySelector(".table");
    if (!table) return;
    table.classList.add("payroll-table");
    const theadRow = table.querySelector("thead tr");
    if (theadRow) {
      theadRow.innerHTML = `
        <th>직원</th>
        <th>직급</th>
        <th>급수</th>
        <th>호봉</th>
        <th>월 기본급</th>
        <th>세금방식</th>
        <th>반영률</th>
        <th>수동세율(%)</th>
        <th>원천세</th>
        <th>지방소득세</th>
        <th>4대보험(월)</th>
        <th>배우자</th>
        <th>자녀</th>
        <th>기타부양</th>
        <th>조정수당</th>
        <th>시간외(월h)</th>
        <th>휴일OT(h)</th>
        <th>제수당 합계</th>
        <th>통상임금</th>
        <th>예상 실수령</th>
        <th>퇴직금 자동추정</th>
        <th>퇴직금 조정</th>
        <th>의무교육</th>
      `;
    }

    const snapshots = state.employees.map((employee) => {
      const record = getHrRecord(employee.id, ui.hrYear);
      const snapshot = calculatePayrollSnapshot(employee, record, ui.hrYear);
      return { employee, record, snapshot };
    });
    summary.innerHTML = [
      kpiCard("white", "월 기본급 합계", `${Math.round(snapshots.reduce((sum, item) => sum + item.snapshot.basePay, 0)).toLocaleString("ko-KR")}`, "원", `${ui.hrYear}년 기준 입력`),
      kpiCard("green", "제수당 합계", `${Math.round(snapshots.reduce((sum, item) => sum + item.snapshot.allowancePack.totalAllowance, 0)).toLocaleString("ko-KR")}`, "원", "정액급식비/가족/시간외 포함"),
      kpiCard("amber", "세금+4대보험", `${Math.round(snapshots.reduce((sum, item) => sum + item.snapshot.withholdingTax + item.snapshot.localIncomeTax + item.snapshot.insurance, 0)).toLocaleString("ko-KR")}`, "원", "원천세 + 지방소득세 + 4대보험"),
      kpiCard("primary", "예상 실수령 합계", `${Math.round(snapshots.reduce((sum, item) => sum + item.snapshot.netPay, 0)).toLocaleString("ko-KR")}`, "원", "월 기준 추정")
    ].join("");
    footnote.innerHTML = [
      `자동세금은 ${state.settings.simpleTaxTable?.length ? "업로드된 간이세액표" : "fallback 세율"}를 기준으로 계산합니다.`,
      "퇴직금 자동추정은 월 총지급액 × 근속연수의 내부 참고값이며, 최종 정산 전 노무/회계 검토가 필요합니다."
    ].join(" ");

    const tbody = document.getElementById("payroll-body");
    if (!tbody) return;
    tbody.innerHTML = snapshots.map(({ employee, record, snapshot }) => {
      const displaySeverance = Number(record.severanceEstimate || 0) || snapshot.autoSeverance;
      return `
        <tr>
          <td>${employeeCell(employee)}</td>
          <td><input class="field" type="text" value="${record.payGrade || ""}" data-pay-grade="${employee.id}" placeholder="예: 일반직/관리직/기능직"></td>
          <td><input class="field" type="text" value="${record.payLevel || ""}" data-pay-level="${employee.id}" placeholder="예: 1급~5급"></td>
          <td><input class="field" type="number" min="1" step="1" value="${record.payStep || ""}" data-pay-step="${employee.id}" placeholder="예: 3"></td>
          <td><div class="hotfix-table-stack"><input class="field" type="number" min="0" step="10000" value="${snapshot.basePay}" data-pay-salary="${employee.id}"><span class="tag ${snapshot.salarySourceTone}">${snapshot.salarySourceLabel}</span></div></td>
          <td><div class="hotfix-table-stack"><select class="field" data-pay-tax-mode="${employee.id}"><option value="hometax" ${record.taxMode === "hometax" ? "selected" : ""}>자동(표/세율)</option><option value="manual" ${record.taxMode === "manual" ? "selected" : ""}>수동 입력</option></select><span class="row-desc">${snapshot.taxSourceLabel}</span></div></td>
          <td><select class="field" data-pay-tax-percent="${employee.id}"><option value="80" ${Number(record.taxRatePercent || 100) === 80 ? "selected" : ""}>80%</option><option value="100" ${Number(record.taxRatePercent || 100) === 100 ? "selected" : ""}>100%</option><option value="120" ${Number(record.taxRatePercent || 100) === 120 ? "selected" : ""}>120%</option></select></td>
          <td><input class="field" type="number" min="0" max="100" step="0.01" value="${record.manualTaxRate || 0}" data-pay-tax-rate="${employee.id}" placeholder="수동세율"></td>
          <td><input class="field" type="number" min="0" step="1000" value="${snapshot.withholdingTax}" data-pay-tax="${employee.id}"></td>
          <td><div class="hotfix-payroll-value">${formatWon(snapshot.localIncomeTax)}</div></td>
          <td><input class="field" type="number" min="0" step="1000" value="${record.socialInsurance || 0}" data-pay-insurance="${employee.id}"></td>
          <td><input class="field" type="number" min="0" step="1" value="${record.spouseCount || 0}" data-pay-spouse="${employee.id}"></td>
          <td><input class="field" type="number" min="0" step="1" value="${record.childCount || 0}" data-pay-child="${employee.id}"></td>
          <td><input class="field" type="number" min="0" step="1" value="${record.otherDependentCount || 0}" data-pay-other="${employee.id}"></td>
          <td><input class="field" type="number" min="0" step="1000" value="${record.adjustmentAllowance || 0}" data-pay-adjust="${employee.id}"></td>
          <td><input class="field" type="number" min="0" step="1" value="${record.overtimeHours || 0}" data-pay-ot="${employee.id}"></td>
          <td><input class="field" type="number" min="0" step="1" value="${record.holidayOvertimeHours || 0}" data-pay-hot="${employee.id}"></td>
          <td><div class="hotfix-payroll-value">${formatWon(snapshot.allowancePack.totalAllowance)}</div></td>
          <td><div class="hotfix-payroll-value">${formatWon(snapshot.allowancePack.ordinaryWage)}</div></td>
          <td><div class="hotfix-payroll-value">${formatWon(snapshot.netPay)}</div></td>
          <td><div class="hotfix-table-stack"><div class="hotfix-payroll-value">${formatWon(snapshot.autoSeverance)}</div><span class="row-desc">근속 ${snapshot.serviceYears.toFixed(2)}년 기준</span></div></td>
          <td><input class="field" type="number" min="0" step="10000" value="${displaySeverance}" data-pay-severance="${employee.id}" placeholder="비우면 자동추정"></td>
          <td><label class="checkbox-row"><input type="checkbox" data-pay-edu="${employee.id}" ${record.mandatoryEduDone ? "checked" : ""}><span>이수</span></label></td>
        </tr>
      `;
    }).join("");
  }

  function syncPayrollTaxInputs() {
    state.employees.forEach((employee) => {
      const record = getHrRecord(employee.id, ui.hrYear);
      const taxInput = document.querySelector(`[data-pay-tax="${employee.id}"]`);
      const salaryInput = document.querySelector(`[data-pay-salary="${employee.id}"]`);
      if (!taxInput || !salaryInput || record.taxMode === "manual") return;
      const basePay = Number(salaryInput.value || record.monthlySalary || 0);
      const autoTax = calculateWithholdingTax(
        basePay,
        deriveTaxFamilyCount(record),
        deriveTaxChildCount(record),
        Number(record.taxRatePercent || 100)
      );
      taxInput.value = String(Math.round(autoTax));
    });
  }

  const originalRenderHrView = window.renderHrView;
  window.renderHrView = renderHrView = function renderHrViewHotfix() {
    originalRenderHrView.apply(this, arguments);
    enhanceHrPayrollLayout();
    syncPayrollTaxInputs();
  };

  const originalLoadWageCalcFromEmployee = window.loadWageCalcFromEmployee;
  window.loadWageCalcFromEmployee = loadWageCalcFromEmployee = function loadWageCalcFromEmployeeHotfix() {
    originalLoadWageCalcFromEmployee.apply(this, arguments);
    const employee = employeeById(ui.wageCalcEmployeeId) || state.employees[0];
    if (!employee) return;
    const record = getHrRecord(employee.id, ui.hrYear);
    document.getElementById("wage-calc-family").value = record.taxFamilyCount || deriveTaxFamilyCount(record);
    document.getElementById("wage-calc-child-tax").value = record.taxChildCount || deriveTaxChildCount(record);
    window.runWageCalculator(false);
  };

  window.calculateAutoTax = calculateAutoTax = function calculateAutoTaxHotfix(basePay) {
    const hometaxRate = Number(state.settings.hometaxRate || 0) / 100;
    return basePay * hometaxRate;
  };

  window.calculateLocalIncomeTax = calculateLocalIncomeTax;
  window.deriveTaxFamilyCount = deriveTaxFamilyCount;
  window.deriveTaxChildCount = deriveTaxChildCount;

  window.loadInitialState = loadInitialState = async function loadInitialStateRecoveryHotfix() {
    const draft = readJsonStorage(STORAGE_KEYS.draft);
    if (draft) {
      state = draft;
      lastLoadedAt = formatDateTime(new Date());
      setSyncStatus("idle", "초안", "로컬 초안을 불러왔습니다.");
    }

    try {
      const response = await fetch(`./data/app-data.json?ts=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`공유 파일 로딩 실패 (${response.status})`);
      const remote = await response.json();
      const selection = selectPreferredState(draft, remote);
      state = selection.state;
      lastLoadedAt = formatDateTime(new Date());
      setSyncStatus(selection.tone, selection.label, selection.detail);
    } catch (error) {
      if (!draft) {
        setSyncStatus("error", "오류", error.message);
      }
    }

    await refreshGithubSha();
  };

  window.reloadFromRemote = reloadFromRemote = async function reloadFromRemoteRecoveryHotfix() {
    try {
      const draft = readJsonStorage(STORAGE_KEYS.draft);
      const response = await fetch(`./data/app-data.json?ts=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`공유 데이터 다시 읽기 실패 (${response.status})`);
      const remote = await response.json();
      const selection = selectPreferredState(draft, remote);
      state = selection.state;
      normalizeState();
      initializeSelections();
      lastLoadedAt = formatDateTime(new Date());
      setSyncStatus(selection.tone, selection.label, selection.detail);
      renderAll();
    } catch (error) {
      setSyncStatus("error", "실패", error.message);
      renderSyncStatus();
    }
  };

  window.runWageCalculator = runWageCalculator = function runWageCalculatorHotfix(shouldSave = true) {
    const empId = document.getElementById("wage-calc-emp").value;
    const employee = employeeById(empId);
    if (!employee) return;
    const year = ui.hrYear;
    const record = getHrRecord(empId, year);
    const savedMonthlySalary = Number(record.monthlySalary || 0);
    record.payGrade = document.getElementById("wage-calc-grade").value.trim();
    record.payLevel = document.getElementById("wage-calc-level").value.trim();
    record.payStep = Number(document.getElementById("wage-calc-step").value || 1);
    record.spouseCount = Number(document.getElementById("wage-calc-spouse").value || 0);
    record.childCount = Number(document.getElementById("wage-calc-child").value || 0);
    record.otherDependentCount = Number(document.getElementById("wage-calc-other").value || 0);
    record.adjustmentAllowance = Number(document.getElementById("wage-calc-adjust").value || 0);
    record.overtimeHours = Number(document.getElementById("wage-calc-overtime").value || 0);
    record.holidayOvertimeHours = Number(document.getElementById("wage-calc-holiday").value || 0);
    record.taxFamilyCount = Number(document.getElementById("wage-calc-family").value || deriveTaxFamilyCount(record));
    record.taxChildCount = Number(document.getElementById("wage-calc-child-tax").value || deriveTaxChildCount(record));
    record.taxRatePercent = Number(document.getElementById("wage-calc-tax-rate").value || 100);
    record.allowanceFlags = {
      meal: document.getElementById("wage-allow-meal").checked,
      manager: document.getElementById("wage-allow-manager").checked,
      family: document.getElementById("wage-allow-family").checked,
      adjustment: document.getElementById("wage-allow-adjust").checked,
      overtime: document.getElementById("wage-allow-overtime").checked
    };
    const lookedUpMonthlySalary = calculatePayByGrade(record.payGrade, record.payLevel, record.payStep);
    const usedSavedMonthlySalary = !(lookedUpMonthlySalary > 0) && savedMonthlySalary > 0;
    record.monthlySalary = lookedUpMonthlySalary > 0 ? lookedUpMonthlySalary : savedMonthlySalary;
    const allowance = calculateAllowancePackage(record, record.monthlySalary, record.allowanceFlags);
    const gross = record.monthlySalary + allowance.totalAllowance;
    const tax = calculateWithholdingTax(record.monthlySalary, record.taxFamilyCount, record.taxChildCount, record.taxRatePercent);
    const localTax = calculateLocalIncomeTax(tax);
    const insurance = Number(record.socialInsurance || 0);
    const net = gross - tax - localTax - insurance;
    const wageCalcHint = !record.monthlySalary
      ? "직군/급수/호봉에 맞는 기본급을 찾지 못해 기본급 0원으로 계산되었습니다. 임금테이블 또는 인사정보의 월 기본급을 먼저 확인해 주세요."
      : usedSavedMonthlySalary
        ? "임금테이블에서 일치하는 기본급을 찾지 못해 인사정보에 저장된 월 기본급으로 계산했습니다. 간이세액표는 이 기본급 기준으로 lookup 됩니다."
        : "계산식: 기본급 + 제수당 - 원천세 - 지방소득세 - 4대보험. 간이세액표 업로드 시 원천세에 lookup 값을 적용합니다.";
    document.getElementById("wage-calc-result").innerHTML = `
      <div class="status-row"><span>직원</span><strong>${employee.name}</strong></div>
      <div class="status-row"><span>기본급</span><strong>${Math.round(record.monthlySalary).toLocaleString("ko-KR")}원</strong></div>
      <div class="status-row"><span>제수당 합계</span><strong>${Math.round(allowance.totalAllowance).toLocaleString("ko-KR")}원</strong></div>
      <div class="status-row"><span>통상임금</span><strong>${Math.round(allowance.ordinaryWage).toLocaleString("ko-KR")}원</strong></div>
      <div class="status-row"><span>원천세(자동)</span><strong>${Math.round(tax).toLocaleString("ko-KR")}원</strong></div>
      <div class="status-row"><span>지방소득세</span><strong>${Math.round(localTax).toLocaleString("ko-KR")}원</strong></div>
      <div class="status-row"><span>4대보험</span><strong>${Math.round(insurance).toLocaleString("ko-KR")}원</strong></div>
      <div class="status-row"><span>예상 실수령</span><strong>${Math.round(net).toLocaleString("ko-KR")}원</strong></div>
      <div class="hint-box">${wageCalcHint}</div>
    `;
    state.hrRecords[`${empId}_${year}`] = record;
    if (shouldSave) touchState("임금 자동계산 실행");
  };

  window.savePayrollInfoFromView = savePayrollInfoFromView = function savePayrollInfoFromViewHotfix() {
    const year = ui.hrYear;
    state.employees.forEach((employee) => {
      const record = getHrRecord(employee.id, year);
      record.payGrade = document.querySelector(`[data-pay-grade="${employee.id}"]`)?.value.trim() || "";
      record.payLevel = document.querySelector(`[data-pay-level="${employee.id}"]`)?.value.trim() || "";
      record.payStep = Number(document.querySelector(`[data-pay-step="${employee.id}"]`)?.value || 0);
      const inputSalary = Number(document.querySelector(`[data-pay-salary="${employee.id}"]`)?.value || 0);
      record.taxMode = document.querySelector(`[data-pay-tax-mode="${employee.id}"]`)?.value || "hometax";
      record.taxRatePercent = Number(document.querySelector(`[data-pay-tax-percent="${employee.id}"]`)?.value || record.taxRatePercent || 100);
      record.manualTaxRate = Number(document.querySelector(`[data-pay-tax-rate="${employee.id}"]`)?.value || 0);
      record.spouseCount = Number(document.querySelector(`[data-pay-spouse="${employee.id}"]`)?.value || 0);
      record.childCount = Number(document.querySelector(`[data-pay-child="${employee.id}"]`)?.value || 0);
      record.otherDependentCount = Number(document.querySelector(`[data-pay-other="${employee.id}"]`)?.value || 0);
      record.taxFamilyCount = deriveTaxFamilyCount(record);
      record.taxChildCount = deriveTaxChildCount(record);
      const manualTaxInput = document.querySelector(`[data-pay-tax="${employee.id}"]`);
      const manualTaxValue = manualTaxInput && manualTaxInput.value !== "" ? Number(manualTaxInput.value || 0) : null;
      record.socialInsurance = Number(document.querySelector(`[data-pay-insurance="${employee.id}"]`)?.value || 0);
      record.adjustmentAllowance = Number(document.querySelector(`[data-pay-adjust="${employee.id}"]`)?.value || 0);
      record.overtimeHours = Number(document.querySelector(`[data-pay-ot="${employee.id}"]`)?.value || 0);
      record.holidayOvertimeHours = Number(document.querySelector(`[data-pay-hot="${employee.id}"]`)?.value || 0);
      const snapshot = calculatePayrollSnapshot(employee, record, year, {
        basePay: inputSalary,
        taxMode: record.taxMode,
        taxRatePercent: record.taxRatePercent,
        manualTaxRate: record.manualTaxRate,
        manualTaxInput: manualTaxValue,
        taxFamilyCount: record.taxFamilyCount,
        taxChildCount: record.taxChildCount,
        socialInsurance: record.socialInsurance
      });
      record.monthlySalary = snapshot.basePay;
      record.withholdingTax = snapshot.withholdingTax;
      record.localIncomeTax = snapshot.localIncomeTax;
      record.totalAllowance = Math.round(snapshot.allowancePack.totalAllowance);
      record.ordinaryWage = Math.round(snapshot.allowancePack.ordinaryWage);
      record.overtimeAllowance = Math.round(snapshot.allowancePack.overtimeAllowance);
      record.expectedNetPay = Math.round(snapshot.netPay);
      const severanceInput = document.querySelector(`[data-pay-severance="${employee.id}"]`)?.value;
      record.severanceEstimate = severanceInput !== undefined && severanceInput !== ""
        ? Number(severanceInput || 0)
        : snapshot.autoSeverance;
      record.mandatoryEduDone = !!document.querySelector(`[data-pay-edu="${employee.id}"]`)?.checked;
      state.hrRecords[`${employee.id}_${year}`] = record;
    });
    touchState("급여/세무/퇴직금 정보 저장");
    renderHrView();
  };
})();
