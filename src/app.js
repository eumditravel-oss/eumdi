const DATA = window.MOMMYFLOW_DATA;
const BACKUP_STORE_KEY = "mommyflow-integrated-v1";
const TOKEN_KEY = "mommyflow-token";
const API_BASE_URL = String(window.MOMMYFLOW_API_BASE_URL || "").replace(/\/+$/, "");
function apiEndpoint(path){ return `${API_BASE_URL}${path}`; }
const LOAD_ENDPOINT = apiEndpoint("/api/load");
const SAVE_ENDPOINT = apiEndpoint("/api/save");
const HEALTH_ENDPOINT = apiEndpoint("/api/health");
const PROFILE_ENDPOINT = apiEndpoint("/api/profile");
const FAMILY_SETTINGS_ENDPOINT = apiEndpoint("/api/family-settings");

const ROLE_LABEL = { husband: "남편", wife: "아내" };
const DIARY_WRITERS = ["남편이 아내에게", "아내가 남편에게"];
function defaultDiaryWriter(){ return authUser?.role === "wife" ? "아내가 남편에게" : "남편이 아내에게"; }

let authToken = "";
let authUser = null;
let authMode = "login";
let authError = "";
let authBusy = false;

/* 프로필 수정 모달 */
let profileOpen = false;
let profileError = "";
let profileBusy = false;

/* AI 도우미 */
let aiOpen = false;
let aiBusy = false;
let aiMessages = [];           // {role:'user'|'ai', text, sources?, appRefs?}
let aiSettingsOpen = false;
let familySettings = null;     // {geminiApiKey}
let familySettingsLoaded = false;

/* 접기/펼치기 (세션 메모리) */
const foldState = {};
let infoTab = "baby";
let searchOpen = false;
let diaryFilter = "all";
function isFolded(id, def){ return foldState[id] ?? def; }

function backupKey(){ return `${BACKUP_STORE_KEY}-${authUser?.familyId || "local"}`; }
function authHeaders(extra = {}){
  return authToken ? { ...extra, authorization: `Bearer ${authToken}` } : extra;
}
const DAY_MS = 24 * 60 * 60 * 1000;
const VIEWS = [
  ["timeline", "calendar-days", "주차별 타임라인", "1~40주 태아·산모 변화"],
  ["roadmap", "route", "통합 로드맵", "임신 확인~24개월"],
  ["checklist", "list-checks", "전체 체크리스트", "모든 자료 통합"],
  ["subsidies", "gift", "지원금 & 혜택", "국가·성남시·휴직"],
  ["gear", "baby", "준비물 · 출산가방", "아기용품·조리원"],
  ["compare", "table-properties", "병원 · 조리원 비교", "직접 비교표"],
  ["diary", "message-square", "부부 태교 일기장", "서로에게 남기는 편지"],
  ["family", "users", "가족 정보", "비상연락망"],
];
const CATEGORY_LABEL = Object.fromEntries(DATA.planner.baseCategories.map(c => [c.id, c.name]));

const DEFAULT_BUDGET_EXPENSES = [
  ["산전 진료·검사 본인부담", 500000],
  ["NIPT·선택 유전자 검사", 600000],
  ["태아보험 1년 예상", 600000],
  ["산후조리원 2주", 3500000],
  ["산후도우미 본인부담", 600000],
  ["출산가방·산모용품", 500000],
  ["초기 육아용품 전체", 3000000],
  ["카시트", 700000],
  ["유모차", 1000000],
  ["월 육아비 12개월 예비", 6000000],
  ["돌잔치·촬영", 2500000],
];
const DEFAULT_BUDGET_BENEFITS = [
  ["국민행복카드", 1000000],
  ["첫만남이용권 첫째", 2000000],
  ["부모급여 0세 12개월", 12000000],
  ["부모급여 1세 12개월", 6000000],
  ["아동수당 만 8세까지", 9600000],
  ["성남시·보건소 물품/교육", 0],
  ["산모·신생아 건강관리 바우처", 0],
];

function createDefaultState(){
  return {
    view:"timeline", selectedWeek:12, selectedTrimester:1, selectedStageId:"s1", checklistStatus:"all", checklistCategory:"all", checklistOwner:"all", search:"", subsidyFilter:"all",
    checked:{},
    family:{ dueDate:"", babyNickname:"", babyName:"", hospital:"", hospitalTel:"", carecenter:"", carecenterTel:"", pediatrician:"", pediatricianTel:"", insurance:"", emergencyContact:"", memo:"" },
    diary:[],
    comparisons:createDefaultComparisons(),
    budget:{ expenses:DEFAULT_BUDGET_EXPENSES.map(([name, amount])=>({name, amount})), benefits:DEFAULT_BUDGET_BENEFITS.map(([name, amount])=>({name, amount})) }
  };
}
function createDefaultComparisons(){
  const result = {};
  Object.entries(DATA.planner.comparisonConfig).forEach(([group, config])=>{
    result[group] = config.rows.map(label=>{
      const row = { label };
      config.fields.forEach(([key])=> row[key] = "");
      return row;
    });
  });
  return result;
}
function mergeState(saved){
  const defaults=createDefaultState();
  saved = saved || {};
  return {
    ...defaults, ...saved,
    family:{...defaults.family, ...(saved.family||{})},
    comparisons:{...defaults.comparisons, ...(saved.comparisons||{})},
    budget:{expenses:saved.budget?.expenses||defaults.budget.expenses, benefits:saved.budget?.benefits||defaults.budget.benefits},
    checked:saved.checked||{}, diary:saved.diary||[]
  };
}
function loadBackupState(){
  try{
    return mergeState(JSON.parse(localStorage.getItem(backupKey())||"{}"));
  }catch(e){return createDefaultState();}
}
let state = createDefaultState();
const app = document.querySelector("#app");
let catalogCache = null;
let initialCloudLoadDone = false;
let changedBeforeCloudLoad = false;
let saveTimer = null;
let saveInFlight = false;
let saveAgain = false;
let syncStatus = {
  loading: true,
  saving: false,
  source: "cloud",
  error: "",
  lastSavedAt: "",
};

function saveBackupState(){
  try{ localStorage.setItem(backupKey(), JSON.stringify(state)); }catch(e){}
}
function saveState(){
  saveBackupState();
  if(!initialCloudLoadDone){
    changedBeforeCloudLoad = true;
    return;
  }
  queueRemoteSave();
}
async function loadRemoteState(options={}){
  if(!authToken) return;
  syncStatus = {...syncStatus, loading:true, error:""};
  updateSyncIndicator();
  try{
    const response = await fetch(LOAD_ENDPOINT, {
      method:"GET",
      headers:authHeaders({ "accept":"application/json" }),
      cache:"no-store",
    });
    if(response.status === 401){ handleAuthExpired(); return; }
    const payload = await response.json().catch(()=>({}));
    if(!response.ok || payload.ok === false) throw new Error(payload.error || "load failed");
    initialCloudLoadDone = true;
    if(payload.state && (options.force || !changedBeforeCloudLoad)){
      state = mergeState(payload.state);
      saveBackupState();
      syncStatus = {...syncStatus, loading:false, source:"cloud", error:"", lastSavedAt:payload.updatedAt || syncStatus.lastSavedAt};
      render();
      return;
    }
    syncStatus = {...syncStatus, loading:false, source:"cloud", error:"", lastSavedAt:payload.updatedAt || syncStatus.lastSavedAt};
    render();
    if(changedBeforeCloudLoad) queueRemoteSave();
  }catch(e){
    initialCloudLoadDone = true;
    if(!changedBeforeCloudLoad) state = loadBackupState();
    syncStatus = {...syncStatus, loading:false, source:"backup", error:`MongoDB 불러오기 실패: ${e.message || "원인 미상"}`};
    render();
  }
}
function queueRemoteSave(){
  if(saveTimer) clearTimeout(saveTimer);
  syncStatus = {...syncStatus, saving:true, error:""};
  updateSyncIndicator();
  saveTimer = setTimeout(flushRemoteSave, 650);
}
async function flushRemoteSave(){
  if(saveInFlight){
    saveAgain = true;
    return;
  }
  saveInFlight = true;
  saveTimer = null;
  syncStatus = {...syncStatus, saving:true, error:""};
  updateSyncIndicator();
  try{
    const response = await fetch(SAVE_ENDPOINT, {
      method:"POST",
      headers:authHeaders({ "content-type":"application/json", "accept":"application/json" }),
      body:JSON.stringify({ state }),
    });
    if(response.status === 401){ saveInFlight=false; handleAuthExpired(); return; }
    const payload = await response.json().catch(()=>({}));
    if(!response.ok || payload.ok === false) throw new Error(payload.error || "save failed");
    syncStatus = {...syncStatus, saving:false, source:"cloud", error:"", lastSavedAt:payload.updatedAt || new Date().toISOString()};
  }catch(e){
    syncStatus = {...syncStatus, saving:false, source:"backup", error:`MongoDB 저장 실패: ${e.message || "원인 미상"}`};
  }finally{
    saveInFlight = false;
    updateSyncIndicator();
    if(saveAgain){
      saveAgain = false;
      queueRemoteSave();
    }
  }
}
function syncLabel(){
  if(syncStatus.loading) return "MongoDB 불러오는 중";
  if(syncStatus.saving) return "MongoDB 저장 중";
  if(syncStatus.error) return "브라우저 백업 모드";
  return "MongoDB 저장됨";
}
function syncDetail(){
  if(syncStatus.error) return syncStatus.error;
  if(syncStatus.loading) return "서버에서 데이터를 불러오는 중";
  if(syncStatus.saving) return "변경사항을 서버에 저장 중";
  if(syncStatus.lastSavedAt) return `마지막 저장: ${new Date(syncStatus.lastSavedAt).toLocaleString("ko-KR")}`;
  return "가족 계정으로 동기화됨";
}
async function runHealthCheck(){
  syncStatus = {...syncStatus, loading:true, error:""};
  updateSyncIndicator();
  try{
    const response = await fetch(HEALTH_ENDPOINT, {
      method:"GET",
      headers:authHeaders({ "accept":"application/json" }),
      cache:"no-store",
    });
    const payload = await response.json().catch(()=>({}));
    if(!response.ok || payload.ok === false) throw new Error(payload.error || "health check failed");
    syncStatus = {...syncStatus, loading:false, source:"cloud", error:"", lastSavedAt:new Date().toISOString()};
    alert(`MongoDB 연결 정상\nDB: ${payload.dbName}\nCollection: ${payload.collectionName}\nLatency: ${payload.latencyMs}ms`);
  }catch(e){
    syncStatus = {...syncStatus, loading:false, source:"backup", error:`MongoDB 진단 실패: ${e.message || "원인 미상"}`};
    alert(syncStatus.error);
  }finally{
    updateSyncIndicator();
    render();
  }
}
function syncClass(){
  if(syncStatus.error) return "error";
  if(syncStatus.loading || syncStatus.saving) return "pending";
  return "ok";
}
function updateSyncIndicator(){
  document.querySelectorAll("[data-sync-status]").forEach(el=>el.textContent = syncLabel());
  document.querySelectorAll("[data-sync-detail]").forEach(el=>el.textContent = syncDetail());
  document.querySelectorAll("[data-sync-box]").forEach(el=>el.className = `sync-status ${syncClass()}${el.classList.contains("desktop-only")?" desktop-only":""}`);
}
function h(value){ return String(value ?? "").replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m])); }
function stripHtml(value){ const div=document.createElement("div"); div.innerHTML=String(value||""); return div.textContent || div.innerText || ""; }
function money(num){ return Number(num||0).toLocaleString("ko-KR") + "원"; }
function pct(done,total){ return total ? Math.round(done/total*100) : 0; }
function clamp(n,min,max){ return Math.min(max, Math.max(min, n)); }
function parseDate(value){ if(!value) return null; const [y,m,d]=value.split("-").map(Number); if(!y||!m||!d) return null; const date=new Date(y,m-1,d); date.setHours(0,0,0,0); return date; }
function today(){ const t=new Date(); t.setHours(0,0,0,0); return t; }
function icon(name){ return `<i data-lucide="${name}"></i>`; }
function sourceTag(label){ return `<span class="tag">${h(label)}</span>`; }

function getPosition(){
  const due = parseDate(state.family.dueDate);
  if(!due){
    return {type:"manual", week:state.selectedWeek, dayInWeek:0, dday:null, progress:Math.round(state.selectedWeek/40*100), label:`임신 ${state.selectedWeek}주차`, subtitle:"예정일 미설정 · 수동 주차 기준"};
  }
  const diff = Math.ceil((due - today()) / DAY_MS);
  if(diff >= 0){
    const elapsed = clamp(280 - diff, 0, 280);
    const week = clamp(Math.floor(elapsed/7)+1,1,40);
    const dayInWeek = elapsed % 7;
    return {type:"pregnancy", week, dayInWeek, dday:diff, progress:Math.round(elapsed/280*100), label:`임신 ${week}주차 ${dayInWeek}일`, subtitle:`출산까지 D-${diff}`};
  }
  const days = Math.abs(diff);
  const months = Math.floor(days / 30.4375);
  return {type:"postpartum", days, months, dday:diff, progress:100, label:`생후 ${days}일`, subtitle:`약 ${months}개월 · 출산 후 로드맵`};
}
function currentRoadmapStage(){
  const p=getPosition();
  if(p.type==="pregnancy" || p.type==="manual"){
    return DATA.standalone.STAGES.find(s=>s.wk && p.week >= s.wk[0] && p.week < s.wk[1]) || DATA.standalone.STAGES[0];
  }
  return DATA.standalone.STAGES.find(s=>s.day && p.days >= s.day[0] && p.days < s.day[1]) || DATA.standalone.STAGES.at(-1);
}

function buildCatalog(){
  if(catalogCache) return catalogCache;
  const tasks=[];
  DATA.pregnancy.weeks.forEach(w=>{
    w.checklist.forEach(item=>tasks.push({
      id:`week-${w.week}-${item.id}`, title:item.text, note:`${w.week}주차 · ${w.title}`, category:"주차별", owner:"공동", priority:"", stage:`${w.week}주차`, source:"임신출산앱2 주차별", view:"timeline", week:w.week
    }));
  });
  DATA.standalone.STAGES.forEach(stage=>{
    stage.sections.forEach((sec,si)=>{
      sec.items.forEach((it,ii)=>{
        const [title,note,label,priority,when,deadline,amount]=it;
        tasks.push({ id:`road-${stage.id}-${si}-${ii}`, title, note, category:label||stage.name, owner:label==="남편"?"아빠":"공동", priority:priority===1?"필수":priority===2?"권장":"", stage:`${stage.name} · ${sec.name}`, source:"로드맵 상세", when, deadline, amount, view:"roadmap", stageId:stage.id });
      });
    });
  });
  Object.entries(DATA.pregnancy.timelineStages).forEach(([key,stage])=>{
    stage.checklist.forEach(item=>tasks.push({ id:`legacy-${key}-${item.id}`, title:item.text, note:stage.description, category:key==="beforeBirth"?"출산가방":key==="postpartumCare"?"조리원":"출산 후 행정", owner:"공동", priority:"", stage:stage.title, source:"임신출산앱2 고정 리스트", view:"gear" }));
  });
  DATA.standalone.GEAR_GROUPS.forEach(group=>{
    group.list.forEach(card=>{
      card.items.forEach((it,ii)=>tasks.push({ id:`gear-${card.id}-${ii}`, title:it[0], note:it[1]||card.tip||group.g, category:"준비물", owner:card.name.includes("산모")?"엄마":"공동", priority:"", stage:`${group.g} · ${card.name}`, source:"준비물 상세", view:"gear" }));
    });
  });
  DATA.pregnancy.subsidies.forEach(sub=>{
    (sub.checklist||[]).forEach(item=>tasks.push({ id:`sub-${sub.id}-${item.id}`, title:item.text, note:`${sub.title} · ${sub.amount}`, category:"지원금", owner:"공동", priority:"", stage:sub.type==="local"?"성남시 자체":"국가 공통", source:"지원금 신청 프로세스", view:"subsidies" }));
  });
  DATA.planner.tasks.forEach(t=>tasks.push({ id:`planner-${t.id}`, title:t.title, note:t.note, category:CATEGORY_LABEL[t.categoryId]||t.categoryId, owner:t.owner, priority:t.priority, stage:(DATA.planner.stages.find(s=>s.id===t.stageId)?.title)||t.stageId, source:"Eumdi Parent Planner", view:"checklist" }));
  catalogCache = tasks;
  return tasks;
}
function getTaskStats(filterFn=()=>true){
  const list=buildCatalog().filter(filterFn);
  const done=list.filter(t=>state.checked[t.id]).length;
  return {total:list.length, done, pct:pct(done,list.length)};
}
function isDone(id){ return !!state.checked[id]; }
function toggleCheck(id){ state.checked[id] = !state.checked[id]; if(!state.checked[id]) delete state.checked[id]; saveState(); render(); }

function render(){
  const prevScroll=document.querySelector(".main-content")?.scrollTop ?? 0;
  const p=getPosition();
  const all=getTaskStats();
  const currentWeek = DATA.pregnancy.weeks.find(w=>w.week===state.selectedWeek) || DATA.pregnancy.weeks.find(w=>w.week===p.week) || DATA.pregnancy.weeks[11];
  app.innerHTML = `
  <div class="app-container ${state.mobileOpen?'side-open':''}">
    <div class="mobile-overlay" data-action="close-mobile"></div>
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="app-logo"><span class="logo-icon">🌸</span><div><div class="logo-text">MommyFlow</div><div class="logo-sub">통합 임신·출산 로드맵</div></div></div>
      </div>
      ${renderDueCard(p)}
      <nav class="sidebar-nav">
        <div class="nav-section"><span class="nav-section-title">전체 메뉴</span><ul class="nav-list">
          ${VIEWS.map(([id,ic,label])=>`<li><button class="nav-item ${state.view===id?'active':''}" data-view="${id}">${icon(ic)}<span>${label}</span><span class="nav-badge">${navCount(id)}</span></button></li>`).join("")}
        </ul></div>
        <div class="nav-section"><span class="nav-section-title">통합 자료 출처</span>
          <div class="notice" style="box-shadow:none;margin:0;padding:12px;font-size:12px">${icon("database")}<div>UI는 <strong>임신출산앱2</strong> 기준, 기능·데이터는 <strong>로드맵 HTML</strong>과 <strong>eumdi-main</strong>까지 합쳤습니다.</div></div>
        </div>
      </nav>
      <div class="sidebar-footer">
        <div class="side-account">
          <div class="side-avatar">${h((authUser?.name||"?").slice(0,1))}</div>
          <div class="side-account-text"><b>${h(authUser?.name||"")}</b><small>${h(authUser?.email||"")}</small></div>
        </div>
        <div class="side-account-actions">
          <button class="btn btn-sm" data-action="open-profile">${icon("user-pen")}내 정보</button>
          <button class="btn btn-sm" data-action="copy-code" title="배우자 초대용 가족 코드">${icon("link")}가족 코드 ${h(authUser?.familyCode||"-")}</button>
          <button class="btn btn-sm btn-danger" data-action="logout">${icon("log-out")}로그아웃</button>
        </div>
      </div>
    </aside>
    <main class="main-content">
      <header class="content-header ${(searchOpen||state.search)?'search-open':''}">
        <div class="header-left">
          <button class="mobile-menu" data-action="open-more" aria-label="메뉴">${icon("menu")}</button>
          <div class="header-titles"><h1>${viewTitle()}</h1><p class="view-subtitle">${viewSubtitle(p,currentWeek)}</p></div>
          <button class="icon-btn search-toggle" data-action="toggle-search" aria-label="검색">${icon("search")}</button>
        </div>
        <div class="header-right">
          <div class="sync-status ${syncClass()} desktop-only" data-sync-box title="${h(syncDetail())}">
            <span class="sync-dot"></span>
            <span data-sync-status>${h(syncLabel())}</span>
            <small data-sync-detail>${h(syncDetail())}</small>
          </div>
          <label class="search-box">${icon("search")}<input data-field="search" value="${h(state.search)}" placeholder="검색: 카시트, 부모급여, 조리원, BCG" /></label>
          <button class="btn desktop-only" data-action="load-cloud">${icon("refresh-cw")}동기화</button>
          <button class="btn desktop-only" data-action="health-check">${icon("stethoscope")}진단</button>
          <button class="btn desktop-only" data-action="export-json">${icon("download")}백업</button>
          <button class="btn btn-danger desktop-only" data-action="reset-checks">${icon("rotate-ccw")}체크 초기화</button>
        </div>
      </header>
      <div class="scroll-area">
        ${state.view==="subsidies"?renderNotice():""}
        ${renderActiveView(p,currentWeek)}
      </div>
    </main>
    ${renderBottomNav()}
    ${renderMoreSheet(p)}
    ${renderProfileModal()}
    ${renderAiFab()}
    ${renderAiChat()}
  </div>`;
  bindIcons();
  const mc=document.querySelector(".main-content");
  if(mc) mc.scrollTop=prevScroll;
  const log=document.querySelector(".ai-log");
  if(log) log.scrollTop=log.scrollHeight;
  const room=document.querySelector("[data-chat-room]");
  if(room) room.scrollTop=room.scrollHeight;
  const weekRow=document.querySelector("[data-week-row]");
  const activeWeek=weekRow?.querySelector(".week-badge.active");
  if(weekRow && activeWeek) weekRow.scrollLeft=activeWeek.offsetLeft - weekRow.clientWidth/2 + activeWeek.clientWidth/2;
}
const BOTTOM_TABS=[["timeline","calendar-days","타임라인"],["roadmap","route","로드맵"],["checklist","list-checks","체크"],["subsidies","gift","지원금"]];
function renderBottomNav(){
  const inMore=!BOTTOM_TABS.some(([id])=>id===state.view);
  return `<nav class="bottom-nav">
    ${BOTTOM_TABS.map(([id,ic,label])=>`<button class="bn-item ${state.view===id?'active':''}" data-view="${id}">${icon(ic)}<span>${label}</span></button>`).join("")}
    <button class="bn-item ${inMore||state.moreOpen?'active':''}" data-action="open-more">${icon("layout-grid")}<span>전체</span></button>
  </nav>`;
}
function renderMoreSheet(p){
  return `<div class="sheet-backdrop ${state.moreOpen?'show':''}" data-action="close-more"></div>
  <section class="more-sheet ${state.moreOpen?'open':''}" role="dialog" aria-label="전체 메뉴">
    <div class="sheet-grab" data-action="close-more"></div>
    <div class="sheet-account">
      <div class="side-avatar">${authUser?.role==="wife"?"👩":authUser?.role==="husband"?"👨":h((authUser?.name||"?").slice(0,1))}</div>
      <div class="side-account-text"><b>${h(authUser?.name||"")} <span class="role-badge">${h(ROLE_LABEL[authUser?.role]||"")}</span></b><small>${h(authUser?.email||"")} · ${h(p.label)}</small></div>
      <button class="btn btn-sm" data-action="open-profile">${icon("user-pen")}내 정보</button>
      <button class="btn btn-sm btn-danger" data-action="logout">${icon("log-out")}</button>
    </div>
    <div class="family-code-row">
      <div>가족 코드 <b>${h(authUser?.familyCode||"-")}</b><small>배우자가 회원가입할 때 입력하면 같은 데이터를 함께 봐요</small></div>
      <button class="btn btn-sm" data-action="copy-code">${icon("copy")}복사</button>
    </div>
    <div class="sheet-grid">
      ${VIEWS.map(([id,ic,label])=>`<button class="sheet-item ${state.view===id?'active':''}" data-view="${id}">${icon(ic)}<span>${h(label)}</span></button>`).join("")}
    </div>
    <div class="sheet-actions">
      <button class="btn btn-sm" data-action="load-cloud">${icon("refresh-cw")}동기화</button>
      <button class="btn btn-sm" data-action="health-check">${icon("stethoscope")}진단</button>
      <button class="btn btn-sm" data-action="export-json">${icon("download")}백업</button>
      <button class="btn btn-sm btn-danger" data-action="reset-checks">${icon("rotate-ccw")}체크 초기화</button>
    </div>
    <div class="sync-status ${syncClass()}" data-sync-box>
      <span class="sync-dot"></span>
      <span data-sync-status>${h(syncLabel())}</span>
      <small data-sync-detail>${h(syncDetail())}</small>
    </div>
  </section>`;
}
function bindIcons(){ if(window.lucide) window.lucide.createIcons(); }
function renderDueCard(p){
  return `<div class="due-date-card">
    <div class="card-row"><span class="baby-emoji">👶</span><div class="week-info"><h4>${h(p.label)}</h4><p>${h(p.subtitle)}</p><span class="baby-nickname-badge">태명: ${h(state.family.babyNickname||"미설정")}</span></div></div>
    <div class="progress-container"><div class="progress-bar-wrapper"><div class="progress-bar-fill" style="width:${p.progress}%"></div></div><span class="progress-pct">${p.progress}%</span></div>
    <div class="side-form"><label>출산예정일</label><input type="date" data-family="dueDate" value="${h(state.family.dueDate)}"><label>태명</label><input data-family="babyNickname" value="${h(state.family.babyNickname)}" placeholder="예: 튼튼이"></div>
  </div>`;
}
function navCount(id){
  if(id==="timeline") return DATA.pregnancy.weeks.length;
  if(id==="roadmap") return DATA.standalone.STAGES.length;
  if(id==="checklist") return getTaskStats().total;
  if(id==="subsidies") return DATA.standalone.MONEY_GROUPS.reduce((a,g)=>a+g.list.length,0)+DATA.pregnancy.subsidies.length+DATA.planner.benefits.length;
  if(id==="gear") return DATA.standalone.GEAR_GROUPS.reduce((a,g)=>a+g.list.reduce((b,c)=>b+c.items.length,0),0);
  if(id==="diary") return state.diary.length;
  return "";
}
function viewTitle(){ return VIEWS.find(v=>v[0]===state.view)?.[2] || "MommyFlow"; }
function viewSubtitle(p,w){
  if(state.view==="timeline") return `${p.label} · ${w.title}`;
  if(state.view==="roadmap") return "임신 확인 직후부터 산후 24개월까지 단계별 행동 로드맵";
  if(state.view==="checklist") { const s=getTaskStats(); return `총 ${s.total}개 항목 중 ${s.done}개 완료 (${s.pct}%)`; }
  if(state.view==="subsidies") return "국가 공통, 성남시 자체, 휴가·휴직, 생활 할인 혜택을 통합 정리";
  if(state.view==="gear") return "출산가방, 산후조리원, 수유·수면·위생·이동 준비물";
  if(state.view==="diary") return "둘만의 대화방 · ☆를 누르면 대화가 저장돼요";
  if(state.view==="timeline") return "";
  return "브라우저에 자동 저장됩니다";
}
function renderNotice(){
  const folded=isFolded("notice", true);
  return `<div class="notice notice-fold ${folded?'folded':''}" data-fold-id="notice">${icon("info")}<div class="fold-toggle" data-action="toggle-fold"><strong>자료 확인 안내</strong><span class="fold-caret">${icon("chevron-down")}</span></div><div class="fold-body">지원금·휴가·보건소 사업은 정책 변경 가능성이 있으므로 실제 신청 전 복지로, 고용24, 성남시 또는 관할 보건소 공지로 최종 확인하세요. 모든 데이터는 가족 계정으로 서버에 자동 저장되며, 부부가 각자 로그인하면 같은 내용을 함께 봅니다.</div></div>`;
}
function renderActiveView(p, currentWeek){
  const map={timeline:()=>renderTimeline(p,currentWeek), roadmap:()=>renderRoadmap(p), checklist:()=>renderChecklist(), subsidies:()=>renderSubsidies(), gear:()=>renderGear(), compare:()=>renderCompare(), diary:()=>renderDiary(), family:()=>renderFamily()};
  return (map[state.view]||map.timeline)();
}

function renderTimeline(p, weekData){
  const tasks=buildCatalog().filter(t=>t.view==="timeline" && t.week===weekData.week);
  const s=getTaskStats(t=>t.view==="timeline" && t.week===weekData.week);
  const INFO_TABS=[["baby","👶 태아"],["mom","💜 엄마"],["tips","💡 팁"]];
  const tabKey=INFO_TABS.some(([k])=>k===infoTab)?infoTab:"baby";
  return `
    <div class="panel week-picker">
      <div class="week-row" data-week-row>${DATA.pregnancy.weeks.map(w=>`<button class="week-badge ${w.week===weekData.week?'active':''} ${w.week===p.week?'current':''}" data-action="select-week" data-week="${w.week}">${w.week}주</button>`).join("")}</div>
    </div>
    <div class="panel week-hero">
      <div class="hero-msg"><div class="baby-face">👶</div><div class="hero-msg-text"><small>${h(state.family.babyNickname||"아기")}가 엄마에게 · ${weekData.week}주차 ${h(weekData.title)}</small><p>“${h(weekData.babyMessage)}”</p></div></div>
      <div class="info-tabs">${INFO_TABS.map(([k,label])=>`<button class="info-tab ${tabKey===k?'active':''}" data-action="info-tab" data-tab="${k}">${label}</button>`).join("")}</div>
      <p class="info-body clamp" data-action="expand-info">${h(weekData[tabKey])}</p>
    </div>
    <div class="panel week-tasks"><h2 class="section-title">${icon("list-checks")} 이번 주 체크 <span class="tag">${s.done}/${s.total}</span></h2>${renderTaskList(tasks.map(t=>({id:t.id,title:t.title})),{compact:true})}</div>`;
}
function renderRoadmap(p){
  const cur=currentRoadmapStage();
  const selected=DATA.standalone.STAGES.find(s=>s.id===state.selectedStageId) || cur;
  const st=getTaskStats(t=>t.view==="roadmap" && t.stageId===selected.id);
  return `<div class="panel week-picker"><div class="chip-row">${DATA.standalone.STAGES.map(s=>`<button class="chip ${selected.id===s.id?'active':''}" data-action="select-stage" data-stage="${s.id}">${s.icon} ${s.name}</button>`).join("")}</div></div>
  <div class="stage-card"><div class="stage-head"><div><div class="stage-period">${h(selected.period)}${cur.id===selected.id?' · 현재 단계':''}</div><div class="stage-title">${selected.icon} ${h(selected.name)}</div><p class="stage-summary">${h(selected.desc)}</p></div><div class="stage-stat">${st.done}/${st.total} 완료</div></div>
  ${selected.sections.map((sec,si)=>{
    const list=buildCatalog().filter(t=>t.view==="roadmap" && t.stageId===selected.id && t.stage.includes(sec.name));
    const done=list.filter(t=>isDone(t.id)).length;
    const fid=`road-${selected.id}-${si}`;
    const folded=isFolded(fid, si>0);
    return `<div class="road-section foldable ${folded?'folded':''}" data-fold-id="${fid}">
      <h3 class="road-section-title fold-toggle" data-action="toggle-fold"><span>${h(sec.name)}</span><span class="fold-meta">${done}/${list.length}<span class="fold-caret">${icon("chevron-down")}</span></span></h3>
      <div class="fold-body">${sec.tip?`<div class="tip">💡<div>${sec.tip}</div></div>`:""}${renderTaskList(list)}</div>
    </div>`;
  }).join("")}</div>`;
}
function renderChecklist(){
  const categories=["all",...new Set(buildCatalog().map(t=>t.category))];
  const owners=["all",...new Set(buildCatalog().map(t=>t.owner).filter(Boolean))];
  const filtered=filteredTasks();
  const grouped=groupBy(filtered,t=>t.source);
  return `<div class="panel"><h2 class="section-title">${icon("sliders-horizontal")} 필터</h2><div class="form-grid"><div class="field"><label>상태</label><select class="select" data-field="checklistStatus"><option value="all">전체</option><option value="active" ${state.checklistStatus==='active'?'selected':''}>진행 중</option><option value="done" ${state.checklistStatus==='done'?'selected':''}>완료</option></select></div><div class="field"><label>카테고리</label><select class="select" data-field="checklistCategory">${categories.map(c=>`<option value="${h(c)}" ${state.checklistCategory===c?'selected':''}>${c==='all'?'전체':h(c)}</option>`).join("")}</select></div><div class="field"><label>담당</label><select class="select" data-field="checklistOwner">${owners.map(o=>`<option value="${h(o)}" ${state.checklistOwner===o?'selected':''}>${o==='all'?'전체':h(o)}</option>`).join("")}</select></div><div class="field"><label>검색 결과</label><div class="input">${filtered.length}개 항목</div></div></div></div>
  ${filtered.length?Object.entries(grouped).map(([source,list])=>`<div class="panel"><h2 class="section-title">${sourceTag(source)} ${h(source)} <span class="tag">${list.length}개</span></h2>${renderTaskList(list)}</div>`).join(""):`<div class="empty"><div class="big">🔎</div><p>조건에 맞는 체크리스트가 없습니다.</p></div>`}`;
}
function filteredTasks(){
  const q=state.search.trim().toLowerCase();
  return buildCatalog().filter(t=>{
    if(state.checklistStatus==="active" && isDone(t.id)) return false;
    if(state.checklistStatus==="done" && !isDone(t.id)) return false;
    if(state.checklistCategory!=="all" && t.category!==state.checklistCategory) return false;
    if(state.checklistOwner!=="all" && t.owner!==state.checklistOwner) return false;
    if(q && !`${t.title} ${t.note} ${t.category} ${t.stage} ${t.source}`.toLowerCase().includes(q)) return false;
    return true;
  });
}
function renderTaskList(tasks, opts={}){
  if(!tasks.length) return `<div class="empty"><div class="big">✓</div><p>표시할 항목이 없습니다.</p></div>`;
  if(opts.compact){
    return `<div class="task-list compact">${tasks.map(t=>`<div class="task-item ${isDone(t.id)?'done':''}" data-action="toggle" data-id="${h(t.id)}"><div class="task-check">${icon("check")}</div><div class="task-title">${h(t.title)}</div></div>`).join("")}</div>`;
  }
  return `<div class="task-list">${tasks.map(t=>`<div class="task-item ${isDone(t.id)?'done':''}" data-action="toggle" data-id="${h(t.id)}"><div class="task-check">${icon("check")}</div><div><div class="task-title">${h(t.title)}</div>${t.note?`<div class="task-note">${h(t.note)}</div>`:""}<div class="task-meta">${t.category?`<span class="tag">${h(t.category)}</span>`:""}${t.owner?`<span class="tag">${h(t.owner)}</span>`:""}${t.priority?`<span class="tag priority-${h(t.priority)}">${h(t.priority)}</span>`:""}${t.when?`<span class="tag">📅 ${h(t.when)}</span>`:""}${t.deadline?`<span class="tag deadline">⏰ ${h(t.deadline)}</span>`:""}${t.amount?`<span class="tag money">₩ ${h(t.amount)}</span>`:""}${t.stage?`<span class="tag">${h(t.stage)}</span>`:""}</div></div><div class="task-actions"><button class="btn btn-sm" type="button">${isDone(t.id)?'완료':'체크'}</button></div></div>`).join("")}</div>`;
}
function groupBy(list,fn){ return list.reduce((a,x)=>{const k=fn(x); (a[k] ||= []).push(x); return a;},{}); }

function renderSubsidies(){
  const q=state.search.trim().toLowerCase();
  const cards=[];
  DATA.standalone.MONEY_GROUPS.forEach(group=>group.list.forEach(item=>cards.push({kind:"money", group:group.g, id:item.id, title:item.name, amount:item.amt, summary:item.one, icon:item.icon, rows:item.rows, type:group.g.includes("출산")?"birth":group.g.includes("휴가")?"leave":"pregnancy"})));
  DATA.pregnancy.subsidies.forEach(item=>cards.push({kind:"legacy", group:item.type==="local"?"성남시 자체 혜택":"국가 공통 혜택", id:`legacy-${item.id}`, title:item.title, amount:item.amount, summary:item.target, detail:item.apply, type:item.type, checklist:(item.checklist||[]).map(x=>({id:`sub-${item.id}-${x.id}`, title:x.text}))}));
  DATA.planner.benefits.forEach(item=>cards.push({kind:"planner", group:"Eumdi Planner 혜택", id:`planner-${item.id}`, title:item.title, amount:item.amount, summary:`${item.timing} · ${item.note}`, type:"planner"}));
  const filtered=cards.filter(c=>{
    if(state.subsidyFilter!=="all" && c.type!==state.subsidyFilter && c.group!==state.subsidyFilter) return false;
    if(q && !`${c.title} ${c.amount} ${c.summary} ${c.group}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const filters=["all","pregnancy","birth","leave","national","local","planner"];
  const labels={all:"전체",pregnancy:"임신 중",birth:"출산 직후",leave:"휴가·할인",national:"국가 공통",local:"성남시",planner:"Planner"};
  return `<div class="panel"><h2 class="section-title">${icon("gift")} 지원금·혜택 필터</h2><div class="chip-row">${filters.map(f=>`<button class="chip ${state.subsidyFilter===f?'active':''}" data-action="subsidy-filter" data-filter="${f}">${labels[f]}</button>`).join("")}</div></div>
  <div class="subsidy-grid">${filtered.map(renderSubsidyCard).join("")}</div>`;
}
function renderSubsidyCard(c){
  const rows=(c.rows||[]).map(r=>`<div class="sub-row"><div class="key">${h(r[0])}</div><div>${h(r[1])}</div></div>`).join("");
  const check=(c.checklist||[]).length?`<div style="margin-top:12px"><h4 style="font-size:13px;margin-bottom:8px">신청 프로세스</h4>${renderTaskList(c.checklist.map(x=>({id:x.id,title:x.title,category:"지원금",source:c.title})))}</div>`:"";
  return `<article class="subsidy-card"><div class="subsidy-head"><div class="round-icon">${c.icon||"🎁"}</div><div><h3>${h(c.title)}</h3><span class="amount">${h(c.amount||"확인 필요")}</span></div></div><p class="task-note" style="margin-bottom:12px">${h(c.summary||"")}</p><div class="tag">${h(c.group)}</div>${rows?`<div style="margin-top:12px">${rows}</div>`:""}${c.detail?`<div class="html-detail" style="margin-top:12px">${c.detail}</div>`:""}${check}</article>`;
}

function renderGear(){
  return `${DATA.standalone.GEAR_GROUPS.map(group=>`<div class="panel"><h2 class="section-title">${icon("package-check")} ${h(group.g)}</h2><div class="gear-grid">${group.list.map(card=>{
    const list=card.items.map((it,ii)=>({id:`gear-${card.id}-${ii}`,title:it[0],note:it[1]||"",category:"준비물",stage:card.name,source:group.g}));
    const done=list.filter(t=>isDone(t.id)).length;
    const fid=`gear-${card.id}`;
    const folded=isFolded(fid, true);
    return `<article class="gear-card foldable ${folded?'folded':''}" data-fold-id="${fid}"><div class="gear-head fold-toggle" data-action="toggle-fold"><div class="round-icon">${card.icon||"🍼"}</div><div style="flex:1;min-width:0"><h3>${h(card.name)}</h3>${card.tip?`<p class="task-note">${h(stripHtml(card.tip))}</p>`:""}</div><span class="fold-meta">${done}/${list.length}<span class="fold-caret">${icon("chevron-down")}</span></span></div><div class="fold-body">${renderTaskList(list)}</div></article>`;
  }).join("")}</div></div>`).join("")}
  ${Object.entries(DATA.pregnancy.timelineStages).map(([key,stage],gi)=>{
    const list=stage.checklist.map(item=>({id:`legacy-${key}-${item.id}`,title:item.text,category:"출산/조리원",source:stage.title}));
    const done=list.filter(t=>isDone(t.id)).length;
    const fid=`legacy-${key}`;
    const folded=isFolded(fid, true);
    return `<div class="panel foldable ${folded?'folded':''}" data-fold-id="${fid}"><h2 class="section-title fold-toggle" data-action="toggle-fold"><span>${icon("luggage")} ${h(stage.title)}</span><span class="fold-meta">${done}/${list.length}<span class="fold-caret">${icon("chevron-down")}</span></span></h2><div class="fold-body"><p class="section-desc">${h(stage.description)}</p>${renderTaskList(list)}</div></div>`;
  }).join("")}`;
}
function renderCompare(){
  return `<div class="grid">${Object.entries(DATA.planner.comparisonConfig).map(([group,config])=>`<div class="comparison-card panel"><h2 class="section-title">${icon(group==='hospitals'?'hospital':'home')} ${h(config.title)}</h2><div class="table-wrap"><table><thead><tr><th>구분</th>${config.fields.map(([_,label])=>`<th>${h(label)}</th>`).join("")}</tr></thead><tbody>${(state.comparisons[group]||[]).map((row,ri)=>`<tr><th>${h(row.label)}</th>${config.fields.map(([key])=>`<td><input data-comparison="${group}.${ri}.${key}" value="${h(row[key]||"")}" placeholder="입력"></td>`).join("")}</tr>`).join("")}</tbody></table></div></div>`).join("")}</div>`;
}
function normalizeDiaryEntry(d){
  if(d.role) return d;
  const role = d.writer===DIARY_WRITERS[1] ? "wife" : "husband";
  return { ...d, role, text:[d.title,d.text].filter(Boolean).join("\n"), ts:Number(d.id)||Date.now(), name:ROLE_LABEL[role] };
}
function chatTime(ts){
  const d=new Date(ts);
  if(isNaN(d)) return "";
  const hour=d.getHours();
  return `${hour<12?"오전":"오후"} ${((hour+11)%12)+1}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function chatDateLabel(ts){
  const d=new Date(ts);
  if(isNaN(d)) return "";
  return d.toLocaleDateString("ko-KR",{year:"numeric",month:"long",day:"numeric",weekday:"short"});
}
function renderDiary(){
  const myRole=authUser?.role==="wife"?"wife":"husband";
  const all=state.diary.map(normalizeDiaryEntry);
  const savedCount=all.filter(d=>d.saved).length;
  let list=all.slice().reverse(); // 오래된 메시지가 위로
  if(diaryFilter==="saved") list=list.filter(d=>d.saved);
  let lastDate="";
  const bubbles=list.map(d=>{
    const mine=d.role===myRole;
    const dateLabel=chatDateLabel(d.ts);
    const divider=dateLabel&&dateLabel!==lastDate?`<div class="chat-date"><span>${h(dateLabel)}</span></div>`:"";
    lastDate=dateLabel||lastDate;
    const meta=`<div class="kbub-meta">
        <button class="kbub-act ${d.saved?'on':''}" data-action="save-msg" data-id="${d.id}" title="${d.saved?'저장 해제':'이 대화 저장'}">${d.saved?"★":"☆"}</button>
        ${mine?`<button class="kbub-act del" data-action="delete-diary" data-id="${d.id}" title="삭제">×</button>`:""}
        <span class="kbub-time">${chatTime(d.ts)}</span>
      </div>`;
    if(mine){
      return `${divider}<div class="kbub-row mine">${meta}<div class="kbub mine ${d.saved?'saved':''}">${h(d.text).replace(/\n/g,"<br>")}</div></div>`;
    }
    return `${divider}<div class="kbub-row other">
      <div class="kbub-avatar">${d.role==="wife"?"👩":"👨"}</div>
      <div class="kbub-col"><div class="kbub-name">${h(d.name||ROLE_LABEL[d.role]||"")}</div>
        <div class="kbub-line"><div class="kbub other ${d.saved?'saved':''}">${h(d.text).replace(/\n/g,"<br>")}</div>${meta}</div>
      </div></div>`;
  }).join("");
  return `<div class="chat-shell">
    <div class="chat-toolbar">
      <button class="chip ${diaryFilter==='all'?'active':''}" data-action="diary-filter" data-filter="all">전체 대화</button>
      <button class="chip ${diaryFilter==='saved'?'active':''}" data-action="diary-filter" data-filter="saved">⭐ 저장됨 ${savedCount?`(${savedCount})`:""}</button>
    </div>
    <div class="chat-room" data-chat-room>
      ${bubbles||`<div class="chat-empty"><div class="big">💬</div><p>${diaryFilter==="saved"?"아직 저장한 대화가 없어요.<br>말풍선 옆 ☆ 별을 눌러 중요한 대화를 보관하세요.":"첫 메시지를 보내보세요!<br>배우자가 로그인하면 같은 대화방을 함께 봅니다."}</p></div>`}
    </div>
    <form data-form="diary" class="chat-send-row">
      <input class="input" name="text" placeholder="${ROLE_LABEL[myRole]}의 메시지 입력" autocomplete="off" maxlength="2000">
      <button class="btn btn-primary chat-send" type="submit">${icon("send")}</button>
    </form>
  </div>`;
}
function renderFamily(){
  const fields=[
    ["dueDate","출산예정일","date"],["babyNickname","태명","text"],["babyName","아기 이름 후보","text"],["hospital","산부인과/출산병원","text"],["hospitalTel","분만실 직통번호","tel"],["carecenter","산후조리원","text"],["carecenterTel","조리원 연락처","tel"],["pediatrician","소아과","text"],["pediatricianTel","소아과 연락처","tel"],["insurance","태아보험/증권번호","text"],["emergencyContact","비상연락처","text"]
  ];
  return `<div class="panel"><h2 class="section-title">${icon("users")} 가족 정보</h2><div class="form-grid">${fields.map(([key,label,type])=>`<div class="field"><label>${h(label)}</label><input class="input" type="${type}" data-family="${key}" value="${h(state.family[key]||"")}"></div>`).join("")}<div class="field full"><label>가족 메모</label><textarea class="textarea" data-family="memo">${h(state.family.memo||"")}</textarea></div></div></div><div class="panel"><h2 class="section-title">${icon("siren")} 즉시 병원 연락이 필요한 상황</h2><ul class="warning-list"><li>양수 파수 의심: 양과 관계없이 병원 연락 후 이동</li><li>선홍색 출혈, 심한 복통, 고열, 심한 두통 또는 시야 이상</li><li>태동이 평소보다 현저히 줄거나 느껴지지 않는 경우</li><li>규칙적인 진통이 점점 짧아지고 강해지는 경우</li></ul></div>`;
}

/* ════════════════ 내 정보 수정 ════════════════ */
function renderProfileModal(){
  if(!profileOpen) return "";
  return `<div class="modal-backdrop show" data-action="close-profile"></div>
  <section class="modal open" role="dialog" aria-label="내 정보 수정">
    <h3 class="modal-title">${icon("user-pen")} 내 정보 수정</h3>
    <form data-form="profile" class="auth-form">
      <div class="field"><label>이름 (닉네임)</label><input class="input" name="name" value="${h(authUser?.name||"")}" maxlength="30" required></div>
      <div class="field"><label>역할</label><div class="role-picker">
        <label class="role-option"><input type="radio" name="role" value="husband" ${authUser?.role!=="wife"?"checked":""}><span>👨 남편</span></label>
        <label class="role-option"><input type="radio" name="role" value="wife" ${authUser?.role==="wife"?"checked":""}><span>👩 아내</span></label>
      </div></div>
      <div class="modal-divider">비밀번호 변경 <small>(바꾸지 않으려면 비워두세요)</small></div>
      <div class="field"><label>현재 비밀번호</label><input class="input" type="password" name="currentPassword" autocomplete="current-password"></div>
      <div class="field"><label>새 비밀번호 <small>(8자 이상)</small></label><input class="input" type="password" name="newPassword" minlength="8" autocomplete="new-password"></div>
      <div class="field"><label>새 비밀번호 확인</label><input class="input" type="password" name="newPassword2" autocomplete="new-password"></div>
      ${profileError?`<div class="auth-error">⚠️ ${h(profileError)}</div>`:""}
      <div class="modal-actions">
        <button class="btn" type="button" data-action="close-profile">닫기</button>
        <button class="btn btn-primary" type="submit" ${profileBusy?"disabled":""}>${profileBusy?"저장 중…":"저장"}</button>
      </div>
    </form>
  </section>`;
}
async function submitProfile(form){
  if(profileBusy) return;
  const fd=new FormData(form);
  const payload={ name:String(fd.get("name")||"").trim(), role:String(fd.get("role")||"") };
  const newPassword=String(fd.get("newPassword")||"");
  if(newPassword){
    if(newPassword!==String(fd.get("newPassword2")||"")){ profileError="새 비밀번호가 서로 일치하지 않습니다."; render(); return; }
    payload.newPassword=newPassword;
    payload.currentPassword=String(fd.get("currentPassword")||"");
    if(!payload.currentPassword){ profileError="비밀번호를 바꾸려면 현재 비밀번호를 입력해 주세요."; render(); return; }
  }
  profileBusy=true; profileError=""; render();
  try{
    const response=await fetch(PROFILE_ENDPOINT,{
      method:"POST",
      headers:authHeaders({ "content-type":"application/json" }),
      body:JSON.stringify(payload),
    });
    if(response.status===401){ handleAuthExpired(); return; }
    const data=await response.json().catch(()=>({}));
    if(!response.ok || data.ok===false) throw new Error(data.error||"저장에 실패했습니다");
    authUser={...authUser, ...data.user};
    profileBusy=false; profileOpen=false;
    render();
  }catch(e){
    profileBusy=false; profileError=e.message||"오류가 발생했습니다"; render();
  }
}

/* ════════════════ AI 도우미 ════════════════ */
const GEMINI_MODELS=["gemini-2.5-flash","gemini-2.0-flash"];
const AI_SYSTEM_PROMPT=`당신은 임신·출산 관리 앱 'MommyFlow'의 한국어 도우미입니다. 사용자는 성남시에 사는 예비부모 부부입니다.
규칙:
1) 사용자 메시지에 [앱 데이터] 블록이 있으면, 그 안에 답이 있는지 먼저 확인하고 있으면 반드시 그것을 우선 근거로 답하세요. 답 끝에 "📚 앱 데이터 기준"이라고 표시하세요.
2) 앱 데이터로 부족한 질문만 구글 검색을 활용해 최신 정보를 찾고, 그때는 "🔎 검색 기준"이라고 표시하세요.
3) 지원금·정책 금액은 변동 가능성을 한 줄로 안내하고, 의학적 판단이 필요한 증상은 반드시 병원 상담을 권하세요.
4) 답변은 한국어로, 휴대폰에서 읽기 좋게 짧은 문단과 불릿으로 간결하게 작성하세요.`;

function searchAppData(query){
  const tokens=String(query||"").toLowerCase().split(/[\s,.?!·]+/).filter(t=>t.length>=2);
  if(!tokens.length) return [];
  const scored=[];
  const score=(text)=>{ const lower=text.toLowerCase(); let s=0; tokens.forEach(t=>{ if(lower.includes(t)) s+=1; }); return s; };
  buildCatalog().forEach(t=>{
    const s=score(`${t.title} ${t.note||""} ${t.category||""} ${t.stage||""}`);
    if(s>0) scored.push({s, title:t.title, note:[t.note,t.when&&`시기 ${t.when}`,t.deadline&&`마감 ${t.deadline}`,t.amount&&`금액 ${t.amount}`].filter(Boolean).join(" · ")});
  });
  DATA.pregnancy.weeks.forEach(w=>{
    const s=score(`${w.week}주 ${w.title} ${w.baby} ${w.mom} ${w.tips}`);
    if(s>0) scored.push({s:s+0.5, title:`임신 ${w.week}주차 — ${w.title}`, note:`태아: ${w.baby} / 엄마: ${w.mom} / 팁: ${w.tips}`});
  });
  scored.sort((a,b)=>b.s-a.s);
  const seen=new Set();
  return scored.filter(r=>{ if(seen.has(r.title)) return false; seen.add(r.title); return true; }).slice(0,6);
}

async function loadFamilySettings(force){
  if(familySettingsLoaded && !force) return familySettings;
  try{
    const response=await fetch(FAMILY_SETTINGS_ENDPOINT,{headers:authHeaders({accept:"application/json"}),cache:"no-store"});
    if(response.status===401){ handleAuthExpired(); return null; }
    const data=await response.json().catch(()=>({}));
    if(response.ok && data.ok!==false){ familySettings=data.settings||{}; familySettingsLoaded=true; }
  }catch(e){ familySettings=familySettings||{}; }
  return familySettings;
}
async function saveGeminiKey(value){
  try{
    const response=await fetch(FAMILY_SETTINGS_ENDPOINT,{
      method:"POST",
      headers:authHeaders({ "content-type":"application/json" }),
      body:JSON.stringify({ geminiApiKey:value }),
    });
    if(response.status===401){ handleAuthExpired(); return false; }
    const data=await response.json().catch(()=>({}));
    if(!response.ok || data.ok===false) throw new Error(data.error||"저장 실패");
    familySettings=data.settings||{geminiApiKey:value};
    return true;
  }catch(e){ alert(`API 키 저장 실패: ${e.message}`); return false; }
}

async function callGemini(apiKey, question, appRefs){
  const refBlock=appRefs.length?`[앱 데이터]\n${appRefs.map(r=>`- ${r.title}: ${r.note}`).join("\n")}\n[/앱 데이터]\n\n`:"";
  const history=aiMessages.slice(-7,-1).map(m=>({ role:m.role==="user"?"user":"model", parts:[{text:m.text.slice(0,1500)}] }));
  const body={
    system_instruction:{ parts:[{ text:AI_SYSTEM_PROMPT }] },
    contents:[...history, { role:"user", parts:[{ text:`${refBlock}질문: ${question}` }] }],
    tools:[{ google_search:{} }],
    generationConfig:{ temperature:0.4, maxOutputTokens:1024 },
  };
  let lastError=null;
  for(const model of GEMINI_MODELS){
    try{
      const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,{
        method:"POST",
        headers:{ "content-type":"application/json" },
        body:JSON.stringify(body),
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok){
        const message=data?.error?.message||`HTTP ${response.status}`;
        if(response.status===404||/not found|is not supported/i.test(message)){ lastError=new Error(message); continue; }
        throw new Error(message);
      }
      const candidate=data?.candidates?.[0];
      const text=(candidate?.content?.parts||[]).map(part=>part.text||"").join("").trim();
      if(!text) throw new Error("AI가 답변을 생성하지 못했어요. 다시 시도해 주세요.");
      const links=[];
      const seen=new Set();
      (candidate?.groundingMetadata?.groundingChunks||[]).forEach(chunk=>{
        const web=chunk?.web;
        if(web?.uri && !seen.has(web.uri)){ seen.add(web.uri); links.push({ uri:web.uri, title:web.title||web.uri }); }
      });
      return { text, links:links.slice(0,5) };
    }catch(e){ lastError=e; if(!/not found|is not supported/i.test(e.message||"")) throw e; }
  }
  throw lastError||new Error("사용 가능한 Gemini 모델을 찾지 못했습니다");
}

function aiMarkdown(text){
  return h(text)
    .replace(/\*\*([^*]+)\*\*/g,"<b>$1</b>")
    .replace(/^[*-]\s+/gm,"• ")
    .replace(/\n/g,"<br>");
}
function renderAiFab(){
  if(aiOpen) return "";
  return `<button class="ai-fab" data-action="open-ai" aria-label="AI 도우미">${icon("sparkles")}<span>AI</span></button>`;
}
function renderAiChat(){
  const hasKey=!!(familySettings?.geminiApiKey);
  const showSettings=aiSettingsOpen || (familySettingsLoaded && !hasKey);
  return `<div class="ai-backdrop ${aiOpen?'show':''}" data-action="close-ai"></div>
  <section class="ai-panel ${aiOpen?'open':''}" role="dialog" aria-label="AI 도우미">
    <header class="ai-head">
      <div class="ai-head-title">${icon("sparkles")}<div><b>AI 도우미</b><small>${hasKey?"앱 데이터 우선 + 구글 검색":"앱 데이터 검색 모드 (API 키 미설정)"}</small></div></div>
      <button class="icon-btn" data-action="ai-settings" title="API 키 설정">${icon("settings")}</button>
      <button class="icon-btn" data-action="ai-clear" title="대화 지우기">${icon("eraser")}</button>
      <button class="icon-btn" data-action="close-ai" title="닫기">${icon("x")}</button>
    </header>
    ${showSettings?`<div class="ai-settings">
      <p><b>Google AI Studio API 키</b> — <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener">aistudio.google.com</a>에서 무료 발급. 한 명이 저장하면 부부가 함께 사용합니다.</p>
      <form data-form="ai-key" class="ai-key-row">
        <input class="input" name="key" type="password" placeholder="AIza로 시작하는 키 붙여넣기" value="${h(familySettings?.geminiApiKey||"")}" autocomplete="off">
        <button class="btn btn-primary btn-sm" type="submit">저장</button>
      </form>
      <small>키는 가족 계정에만 서버 저장되며 GitHub 코드에는 들어가지 않아요.</small>
    </div>`:""}
    <div class="ai-log">
      ${aiMessages.length?aiMessages.map(m=>{
        if(m.role==="user") return `<div class="ai-msg user"><p>${aiMarkdown(m.text)}</p></div>`;
        return `<div class="ai-msg ai"><div class="ai-avatar">🤖</div><div class="ai-bubble"><p>${aiMarkdown(m.text)}</p>
          ${m.appRefs?.length?`<div class="ai-refs"><span class="ai-refs-label">📚 앱 데이터</span>${m.appRefs.slice(0,3).map(r=>`<span class="ai-ref-chip">${h(r.title)}</span>`).join("")}</div>`:""}
          ${m.sources?.length?`<div class="ai-links"><span class="ai-refs-label">🔗 관련 자료</span>${m.sources.map(s=>`<a href="${h(s.uri)}" target="_blank" rel="noopener">${h(s.title)}</a>`).join("")}</div>`:""}
        </div></div>`;
      }).join(""):`<div class="ai-empty"><div class="big">✨</div><p><b>무엇이든 물어보세요</b></p><p class="ai-hint">예: "부모급여 언제까지 신청해야 해?" · "지금 16주차인데 뭘 준비해야 해?" · "성남시 산후조리비 알려줘"</p><p class="ai-hint">앱에 정리된 자료에서 먼저 답하고, 없는 내용은 인터넷을 검색해 링크와 함께 알려드려요.</p></div>`}
      ${aiBusy?`<div class="ai-msg ai"><div class="ai-avatar">🤖</div><div class="ai-bubble ai-typing"><span></span><span></span><span></span></div></div>`:""}
    </div>
    <form data-form="ai" class="ai-input-row">
      <input class="input" name="q" placeholder="질문을 입력하세요" autocomplete="off" ${aiBusy?"disabled":""}>
      <button class="btn btn-primary ai-send" type="submit" ${aiBusy?"disabled":""}>${icon("send")}</button>
    </form>
  </section>`;
}
async function askAi(question){
  aiMessages.push({ role:"user", text:question });
  if(aiMessages.length>40) aiMessages=aiMessages.slice(-40);
  aiBusy=true; render();
  const appRefs=searchAppData(question);
  await loadFamilySettings();
  const key=familySettings?.geminiApiKey||"";
  if(!key){
    const text=appRefs.length
      ?`아직 AI 키가 설정되지 않아 앱 데이터 검색 결과만 보여드려요.\n\n${appRefs.map(r=>`• **${r.title}**\n${r.note}`).join("\n\n")}\n\n⚙️ 우측 상단 설정에서 Google AI Studio 키를 저장하면 자연어 답변과 인터넷 검색 링크까지 제공해요.`
      :"앱 데이터에서 관련 내용을 찾지 못했어요. ⚙️ 설정에서 Google AI Studio API 키를 저장하면 인터넷 검색으로 답을 찾아드릴 수 있어요.";
    aiMessages.push({ role:"ai", text, appRefs });
    aiBusy=false; render(); return;
  }
  try{
    const { text, links }=await callGemini(key, question, appRefs);
    aiMessages.push({ role:"ai", text, sources:links, appRefs:appRefs.slice(0,3) });
  }catch(e){
    aiMessages.push({ role:"ai", text:`⚠️ AI 호출에 실패했어요: ${e.message}\n\nAPI 키가 올바른지(⚙️ 설정) 또는 잠시 후 다시 시도해 주세요.`, appRefs });
  }
  aiBusy=false; render();
}

app.addEventListener("click", e=>{
  const btn=e.target.closest("[data-action]"); if(!btn) return;
  const a=btn.dataset.action;
  if(a==="toggle-fold"){
    const box=btn.closest("[data-fold-id]");
    if(box){ const id=box.dataset.foldId; foldState[id]=!box.classList.contains("folded"); box.classList.toggle("folded"); }
    return;
  }
  if(a==="info-tab"){ infoTab=btn.dataset.tab; render(); return; }
  if(a==="expand-info"){ btn.classList.toggle("clamp"); return; }
  if(a==="save-msg"){
    const target=state.diary.find(x=>String(x.id)===String(btn.dataset.id));
    if(target){ Object.assign(target, normalizeDiaryEntry(target)); target.saved=!target.saved; delete target.writer; saveState(); render(); }
    return;
  }
  if(a==="diary-filter"){ diaryFilter=btn.dataset.filter; render(); return; }
  if(a==="toggle-search"){ searchOpen=!searchOpen; if(!searchOpen){state.search="";} render(); if(searchOpen){const el=document.querySelector('[data-field="search"]'); el?.focus();} return; }
  if(a==="open-profile"){ profileOpen=true; profileError=""; state.moreOpen=false; render(); return; }
  if(a==="close-profile"){ profileOpen=false; render(); return; }
  if(a==="open-ai"){
    aiOpen=true; state.moreOpen=false; render();
    loadFamilySettings().then(()=>{ if(aiOpen) render(); });
    return;
  }
  if(a==="close-ai"){ aiOpen=false; aiSettingsOpen=false; render(); return; }
  if(a==="ai-settings"){ aiSettingsOpen=!aiSettingsOpen; render(); return; }
  if(a==="ai-clear"){ if(aiMessages.length===0 || confirm("AI 대화를 지울까요?")){ aiMessages=[]; render(); } return; }
  if(a==="open-mobile"||a==="open-more"){state.moreOpen=true;render();}
  if(a==="close-mobile"||a==="close-more"){state.moreOpen=false;render();}
  if(a==="logout"){logout();}
  if(a==="copy-code"){copyFamilyCode();}
  if(a==="auth-mode"){authMode=btn.dataset.mode;authError="";renderAuth();}
  if(a==="load-cloud"){state.moreOpen=false;loadRemoteState({force:true});}
  if(a==="health-check"){runHealthCheck();}
  if(a==="select-week"){state.selectedWeek=Number(btn.dataset.week); state.selectedTrimester=DATA.pregnancy.weeks.find(w=>w.week===state.selectedWeek).trimester; saveState(); render();}
  if(a==="select-stage"){state.selectedStageId=btn.dataset.stage; saveState(); render();}
  if(a==="toggle"){toggleCheck(btn.dataset.id);}
  if(a==="subsidy-filter"){state.subsidyFilter=btn.dataset.filter; saveState(); render();}
  if(a==="reset-checks"){if(confirm("모든 체크 완료 상태를 초기화할까요?")){state.checked={};saveState();render();}}
  if(a==="export-json"){exportBackup();}
  if(a==="delete-diary"){ if(confirm("이 메시지를 삭제할까요?")){ state.diary=state.diary.filter(d=>String(d.id)!==String(btn.dataset.id)); saveState(); render(); } }
});
app.addEventListener("input", e=>{
  const t=e.target;
  if(t.dataset.field!==undefined){state[t.dataset.field]=t.value; saveState(); if(t.dataset.field==="search"){render(); setTimeout(()=>{const el=document.querySelector('[data-field="search"]'); if(el){el.focus(); el.setSelectionRange(el.value.length, el.value.length);}},0);}}
  if(t.dataset.family!==undefined){state.family[t.dataset.family]=t.value; saveState();}
  if(t.dataset.comparison){const [group,ri,key]=t.dataset.comparison.split("."); state.comparisons[group][Number(ri)][key]=t.value; saveState();}
});
app.addEventListener("change", e=>{
  const t=e.target;
  if(t.dataset.field!==undefined){state[t.dataset.field]=t.value; saveState(); render();}
  if(t.dataset.family!==undefined){state.family[t.dataset.family]=t.value; if(t.dataset.family==="dueDate"){const pos=getPosition(); if(pos.week){state.selectedWeek=pos.week; state.selectedTrimester=DATA.pregnancy.weeks.find(w=>w.week===pos.week)?.trimester || state.selectedTrimester;}} saveState(); render();}
});
app.addEventListener("submit", e=>{
  if(e.target.dataset.form==="diary"){
    e.preventDefault(); const fd=new FormData(e.target); const text=String(fd.get("text")||"").trim(); if(!text) return;
    const role=authUser?.role==="wife"?"wife":"husband";
    state.diary.unshift({id:Date.now(), role, name:authUser?.name||ROLE_LABEL[role], text, ts:Date.now(), saved:false});
    if(state.diary.length>1000) state.diary=state.diary.slice(0,1000);
    e.target.reset(); saveState(); render();
    document.querySelector('.chat-send-row [name="text"]')?.focus();
  }
  if(e.target.dataset.form==="profile"){ e.preventDefault(); submitProfile(e.target); }
  if(e.target.dataset.form==="ai"){
    e.preventDefault();
    const q=String(new FormData(e.target).get("q")||"").trim();
    if(!q || aiBusy) return;
    e.target.reset();
    askAi(q);
  }
  if(e.target.dataset.form==="ai-key"){
    e.preventDefault();
    const key=String(new FormData(e.target).get("key")||"").trim();
    saveGeminiKey(key).then(ok=>{ if(ok){ aiSettingsOpen=false; render(); } });
  }
});
app.addEventListener("click", e=>{ const view=e.target.closest("[data-view]"); if(view){state.view=view.dataset.view; state.mobileOpen=false; state.moreOpen=false; saveState(); render(); document.querySelector(".main-content")?.scrollTo(0,0);}});
function exportBackup(){
  const blob=new Blob([JSON.stringify({state,dataVersion:DATA.meta},null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="mommyflow-backup.json"; a.click(); URL.revokeObjectURL(url);
}

/* ════════════════ 인증 ════════════════ */
function handleAuthExpired(){
  authToken=""; authUser=null;
  localStorage.removeItem(TOKEN_KEY);
  authError="세션이 만료되었습니다. 다시 로그인해 주세요.";
  renderAuth();
}
async function logout(){
  if(!confirm("로그아웃할까요? 데이터는 서버에 안전하게 보관됩니다.")) return;
  try{ await fetch(apiEndpoint("/api/logout"),{method:"POST",headers:authHeaders()}); }catch(e){}
  localStorage.removeItem(TOKEN_KEY);
  authToken=""; authUser=null; authError=""; authMode="login";
  familySettings=null; familySettingsLoaded=false;
  aiMessages=[]; aiOpen=false; aiSettingsOpen=false; profileOpen=false;
  state=createDefaultState();
  renderAuth();
}
function copyFamilyCode(){
  const code=authUser?.familyCode||"";
  if(!code){ alert("가족 코드를 불러오지 못했습니다."); return; }
  const message=`MommyFlow 가족 코드: ${code}\n회원가입 화면의 ‘가족 코드’란에 입력하면 같은 데이터를 함께 볼 수 있어요.`;
  if(navigator.clipboard?.writeText){
    navigator.clipboard.writeText(code).then(()=>alert(message)).catch(()=>prompt("아래 코드를 복사하세요", code));
  }else{
    prompt("아래 코드를 복사하세요", code);
  }
}
function renderSplash(){
  app.innerHTML=`<div class="auth-screen"><div class="splash"><span class="logo-icon" style="font-size:46px">🌸</span><div class="logo-text" style="font-size:26px">MommyFlow</div><div class="splash-spinner"></div><p>가족 데이터를 확인하는 중…</p></div></div>`;
}
function renderAuth(){
  const isSignup=authMode==="signup";
  app.innerHTML=`
  <div class="auth-screen">
    <div class="auth-card">
      <div class="auth-logo"><span class="logo-icon">🌸</span><div><div class="logo-text">MommyFlow</div><div class="logo-sub">우리 가족 임신·출산 로드맵</div></div></div>
      <div class="auth-tabs">
        <button class="auth-tab ${!isSignup?'active':''}" data-action="auth-mode" data-mode="login">로그인</button>
        <button class="auth-tab ${isSignup?'active':''}" data-action="auth-mode" data-mode="signup">회원가입</button>
      </div>
      <form data-form="auth" class="auth-form" autocomplete="on">
        ${isSignup?`<div class="field"><label>이름 (닉네임)</label><input class="input" name="name" placeholder="예: 튼튼맘" required maxlength="30" autocomplete="nickname"></div>
        <div class="field"><label>나는 누구인가요?</label><div class="role-picker"><label class="role-option"><input type="radio" name="role" value="husband" required><span>👨 남편</span></label><label class="role-option"><input type="radio" name="role" value="wife" required><span>👩 아내</span></label></div></div>`:""}
        <div class="field"><label>이메일</label><input class="input" type="email" name="email" placeholder="you@example.com" required autocomplete="${isSignup?'email':'username'}" inputmode="email" autocapitalize="off"></div>
        <div class="field"><label>비밀번호 <small>(8자 이상)</small></label><input class="input" type="password" name="password" required minlength="8" autocomplete="${isSignup?'new-password':'current-password'}"></div>
        ${isSignup?`<div class="field"><label>비밀번호 확인</label><input class="input" type="password" name="password2" required minlength="8" autocomplete="new-password"></div>
        <div class="field"><label>가족 코드 <small>(선택)</small></label><input class="input" name="familyCode" placeholder="배우자가 먼저 가입했다면 코드 입력" maxlength="6" autocapitalize="characters" style="text-transform:uppercase"><p class="field-hint">비워두면 새 가족 공간이 만들어지고, 내 가족 코드가 발급돼요.</p></div>`:""}
        ${authError?`<div class="auth-error">⚠️ ${h(authError)}</div>`:""}
        <button class="btn btn-primary auth-submit" type="submit" ${authBusy?"disabled":""}>${authBusy?"처리 중…":(isSignup?"가입하고 시작하기":"로그인")}</button>
      </form>
      <p class="auth-foot">${isSignup?"부부가 같은 데이터를 보려면 한 명이 먼저 가입한 뒤, 다른 한 명이 ‘가족 코드’로 가입하세요.":"계정이 없다면 회원가입 탭에서 1분 만에 만들 수 있어요."}</p>
    </div>
  </div>`;
  bindIcons();
}
async function submitAuth(form){
  if(authBusy) return;
  const fd=new FormData(form);
  const payload={ email:String(fd.get("email")||""), password:String(fd.get("password")||"") };
  if(authMode==="signup"){
    if(payload.password!==String(fd.get("password2")||"")){ authError="비밀번호가 서로 일치하지 않습니다."; renderAuth(); return; }
    payload.name=String(fd.get("name")||"");
    payload.role=String(fd.get("role")||"");
    if(!payload.role){ authError="남편/아내 중 역할을 선택해 주세요."; renderAuth(); return; }
    payload.familyCode=String(fd.get("familyCode")||"").trim().toUpperCase();
  }
  authBusy=true; authError=""; renderAuth();
  try{
    const response=await fetch(apiEndpoint(authMode==="signup"?"/api/signup":"/api/login"),{
      method:"POST",
      headers:{ "content-type":"application/json" },
      body:JSON.stringify(payload),
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok || data.ok===false) throw new Error(data.error||"요청에 실패했습니다");
    authToken=data.token; authUser=data.user;
    localStorage.setItem(TOKEN_KEY, authToken);
    authBusy=false; authError="";
    state=loadBackupState();
    initialCloudLoadDone=false; changedBeforeCloudLoad=false;
    syncStatus={loading:true,saving:false,source:"cloud",error:"",lastSavedAt:""};
    render();
    loadRemoteState();
  }catch(e){
    authBusy=false;
    authError=e.message||"오류가 발생했습니다";
    renderAuth();
  }
}
app.addEventListener("submit", e=>{
  if(e.target.dataset.form==="auth"){ e.preventDefault(); submitAuth(e.target); }
});

async function boot(){
  authToken=localStorage.getItem(TOKEN_KEY)||"";
  if(!authToken){ renderAuth(); return; }
  renderSplash();
  try{
    const response=await fetch(apiEndpoint("/api/me"),{headers:authHeaders({accept:"application/json"}),cache:"no-store"});
    const data=await response.json().catch(()=>({}));
    if(!response.ok || data.ok===false) throw new Error(data.error||"세션 만료");
    authUser=data.user;
    state=loadBackupState();
    render();
    loadRemoteState();
  }catch(e){
    localStorage.removeItem(TOKEN_KEY);
    authToken=""; authUser=null;
    renderAuth();
  }
}
if("serviceWorker" in navigator){
  window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}));
}
boot();
