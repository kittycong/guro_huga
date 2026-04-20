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
    record.monthlySalary = calculatePayByGrade(record.payGrade, record.payLevel, record.payStep);
    const allowance = calculateAllowancePackage(record, record.monthlySalary, record.allowanceFlags);
    const gross = record.monthlySalary + allowance.totalAllowance;
    const tax = calculateWithholdingTax(record.monthlySalary, record.taxFamilyCount, record.taxChildCount, record.taxRatePercent);
    const localTax = calculateLocalIncomeTax(tax);
    const insurance = Number(record.socialInsurance || 0);
    const net = gross - tax - localTax - insurance;
    document.getElementById("wage-calc-result").innerHTML = `
      <div class="status-row"><span>직원</span><strong>${employee.name}</strong></div>
      <div class="status-row"><span>기본급</span><strong>${Math.round(record.monthlySalary).toLocaleString("ko-KR")}원</strong></div>
      <div class="status-row"><span>제수당 합계</span><strong>${Math.round(allowance.totalAllowance).toLocaleString("ko-KR")}원</strong></div>
      <div class="status-row"><span>통상임금</span><strong>${Math.round(allowance.ordinaryWage).toLocaleString("ko-KR")}원</strong></div>
      <div class="status-row"><span>원천세(자동)</span><strong>${Math.round(tax).toLocaleString("ko-KR")}원</strong></div>
      <div class="status-row"><span>지방소득세</span><strong>${Math.round(localTax).toLocaleString("ko-KR")}원</strong></div>
      <div class="status-row"><span>4대보험</span><strong>${Math.round(insurance).toLocaleString("ko-KR")}원</strong></div>
      <div class="status-row"><span>예상 실수령</span><strong>${Math.round(net).toLocaleString("ko-KR")}원</strong></div>
      <div class="hint-box">계산식: 기본급 + 제수당 - 원천세 - 지방소득세 - 4대보험. 간이세액표 업로드 시 원천세에 lookup 값을 적용합니다.</div>
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
      const calculatedPay = calculatePayByGrade(record.payGrade, record.payLevel, record.payStep);
      const inputSalary = Number(document.querySelector(`[data-pay-salary="${employee.id}"]`)?.value || 0);
      record.monthlySalary = inputSalary || calculatedPay || 0;
      record.taxMode = document.querySelector(`[data-pay-tax-mode="${employee.id}"]`)?.value || "hometax";
      record.manualTaxRate = Number(document.querySelector(`[data-pay-tax-rate="${employee.id}"]`)?.value || 0);
      record.spouseCount = Number(document.querySelector(`[data-pay-spouse="${employee.id}"]`)?.value || 0);
      record.childCount = Number(document.querySelector(`[data-pay-child="${employee.id}"]`)?.value || 0);
      record.otherDependentCount = Number(document.querySelector(`[data-pay-other="${employee.id}"]`)?.value || 0);
      record.taxFamilyCount = deriveTaxFamilyCount(record);
      record.taxChildCount = deriveTaxChildCount(record);
      const manualTaxInput = document.querySelector(`[data-pay-tax="${employee.id}"]`);
      const manualTaxValue = manualTaxInput && manualTaxInput.value !== "" ? Number(manualTaxInput.value || 0) : null;
      const autoTax = calculateWithholdingTax(record.monthlySalary, record.taxFamilyCount, record.taxChildCount, Number(record.taxRatePercent || 100));
      const manualTaxByRate = record.monthlySalary * (record.manualTaxRate / 100);
      record.withholdingTax = Math.round(record.taxMode === "manual"
        ? (manualTaxValue !== null ? manualTaxValue : manualTaxByRate)
        : autoTax);
      record.socialInsurance = Number(document.querySelector(`[data-pay-insurance="${employee.id}"]`)?.value || 0);
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
  };
})();
