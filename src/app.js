const DATA = window.MOMMYFLOW_DATA;
const STORE_KEY = "mommyflow-integrated-v1";
const DAY_MS = 24 * 60 * 60 * 1000;
const VIEWS = [
  ["timeline", "calendar-days", "주차별 타임라인", "1~40주 태아·산모 변화"],
  ["roadmap", "route", "통합 로드맵", "임신 확인~24개월"],
  ["checklist", "list-checks", "전체 체크리스트", "모든 자료 통합"],
  ["subsidies", "gift", "지원금 & 혜택", "국가·성남시·휴직"],
  ["gear", "baby", "준비물 · 출산가방", "아기용품·조리원"],
  ["compare", "table-properties", "병원 · 조리원 비교", "직접 비교표"],
  ["budget", "calculator", "총액 계산표", "비용·지원금 계산"],
  ["diary", "message-square", "부부 태교 일기장", "아빠·엄마 메모"],
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
function loadState(){
  const defaults=createDefaultState();
  try{
    const saved=JSON.parse(localStorage.getItem(STORE_KEY)||"{}");
    return {
      ...defaults, ...saved,
      family:{...defaults.family, ...(saved.family||{})},
      comparisons:{...defaults.comparisons, ...(saved.comparisons||{})},
      budget:{expenses:saved.budget?.expenses||defaults.budget.expenses, benefits:saved.budget?.benefits||defaults.budget.benefits},
      checked:saved.checked||{}, diary:saved.diary||[]
    };
  }catch(e){return defaults;}
}
let state = loadState();
const app = document.querySelector("#app");
let catalogCache = null;

function saveState(){ localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
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
      <div class="sidebar-footer"><span>LocalStorage 저장</span><span>GitHub Pages 가능</span></div>
    </aside>
    <main class="main-content">
      <header class="content-header">
        <div class="header-left">
          <button class="mobile-menu" data-action="open-mobile">${icon("menu")}</button>
          <div class="header-titles"><h1>${viewTitle()}</h1><p class="view-subtitle">${viewSubtitle(p,currentWeek)}</p></div>
        </div>
        <div class="header-right">
          <label class="search-box">${icon("search")}<input data-field="search" value="${h(state.search)}" placeholder="검색: 카시트, 부모급여, 조리원, BCG" /></label>
          <button class="btn" data-action="export-json">${icon("download")}백업</button>
          <button class="btn btn-danger" data-action="reset-checks">${icon("rotate-ccw")}체크 초기화</button>
        </div>
      </header>
      <div class="scroll-area">
        ${renderNotice()}
        ${renderActiveView(p,currentWeek)}
      </div>
    </main>
  </div>`;
  bindIcons();
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
  if(state.view==="budget") return "지출 예상액과 지원금 예상액을 직접 수정해 총액 계산";
  return "브라우저에 자동 저장됩니다";
}
function renderNotice(){
  return `<div class="notice">${icon("info")}<div><strong>자료 확인 안내</strong><br>지원금·휴가·보건소 사업은 정책 변경 가능성이 있으므로 실제 신청 전 복지로, 고용24, 성남시 또는 관할 보건소 공지로 최종 확인하세요.</div></div>`;
}
function renderActiveView(p, currentWeek){
  const map={timeline:()=>renderTimeline(p,currentWeek), roadmap:()=>renderRoadmap(p), checklist:()=>renderChecklist(), subsidies:()=>renderSubsidies(), gear:()=>renderGear(), compare:()=>renderCompare(), budget:()=>renderBudget(), diary:()=>renderDiary(), family:()=>renderFamily()};
  return (map[state.view]||map.timeline)();
}

function renderTimeline(p, weekData){
  const shownTrimester = weekData.trimester;
  const tasks=buildCatalog().filter(t=>t.view==="timeline" && t.week===weekData.week);
  const s=getTaskStats(t=>t.view==="timeline" && t.week===weekData.week);
  return `
    <div class="panel">
      <div class="tabs">${[1,2,3].map(n=>`<button class="tab ${shownTrimester===n?'active':''}" data-action="trimester" data-trimester="${n}">${n}분기 ${n===1?'(1~12주)':n===2?'(13~27주)':'(28~40주)'}</button>`).join("")}</div>
      <div class="week-row">${DATA.pregnancy.weeks.filter(w=>w.trimester===shownTrimester).map(w=>`<button class="week-badge ${w.week===weekData.week?'active':''} ${w.week===p.week?'current':''}" data-action="select-week" data-week="${w.week}">${w.week}주</button>`).join("")}</div>
    </div>
    <div class="baby-message"><div class="baby-face">👶</div><div><small>${h(state.family.babyNickname||"아기")}가 엄마에게</small><p>“${h(weekData.babyMessage)}”</p></div></div>
    <div class="info-grid">
      <div class="info-card"><div class="icon">👶</div><h3>태아의 변화</h3><p>${h(weekData.baby)}</p></div>
      <div class="info-card"><div class="icon">💜</div><h3>엄마의 변화</h3><p>${h(weekData.mom)}</p></div>
      <div class="info-card"><div class="icon">💡</div><h3>이번 주 팁</h3><p>${h(weekData.tips)}</p></div>
    </div>
    <div class="panel"><h2 class="section-title">${icon("list-checks")} ${weekData.week}주차 체크리스트 <span class="tag">${s.done}/${s.total} 완료</span></h2>${renderTaskList(tasks)}</div>`;
}
function renderRoadmap(p){
  const cur=currentRoadmapStage();
  const selected=DATA.standalone.STAGES.find(s=>s.id===state.selectedStageId) || cur;
  const st=getTaskStats(t=>t.view==="roadmap" && t.stageId===selected.id);
  return `<div class="panel"><div class="chip-row">${DATA.standalone.STAGES.map(s=>`<button class="chip ${selected.id===s.id?'active':''}" data-action="select-stage" data-stage="${s.id}">${s.icon} ${s.name}</button>`).join("")}</div></div>
  <div class="stage-card"><div class="stage-head"><div><div class="stage-period">${h(selected.period)}${cur.id===selected.id?' · 현재 단계':''}</div><div class="stage-title">${selected.icon} ${h(selected.name)}</div><p class="stage-summary">${h(selected.desc)}</p></div><div class="stage-stat">${st.done}/${st.total} 완료</div></div>
  ${selected.sections.map((sec,si)=>`<div class="road-section"><h3 class="road-section-title">${h(sec.name)}</h3>${sec.tip?`<div class="tip">💡<div>${sec.tip}</div></div>`:""}${renderTaskList(buildCatalog().filter(t=>t.view==="roadmap" && t.stageId===selected.id && t.stage.includes(sec.name)))}</div>`).join("")}</div>`;
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
function renderTaskList(tasks){
  if(!tasks.length) return `<div class="empty"><div class="big">✓</div><p>표시할 항목이 없습니다.</p></div>`;
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
  return `${DATA.standalone.GEAR_GROUPS.map(group=>`<div class="panel"><h2 class="section-title">${icon("package-check")} ${h(group.g)}</h2><div class="gear-grid">${group.list.map(card=>`<article class="gear-card"><div class="gear-head"><div class="round-icon">${card.icon||"🍼"}</div><div><h3>${h(card.name)}</h3>${card.tip?`<p class="task-note">${h(stripHtml(card.tip))}</p>`:""}</div></div>${renderTaskList(card.items.map((it,ii)=>({id:`gear-${card.id}-${ii}`,title:it[0],note:it[1]||"",category:"준비물",stage:card.name,source:group.g})))}</article>`).join("")}</div></div>`).join("")}
  ${Object.entries(DATA.pregnancy.timelineStages).map(([key,stage])=>`<div class="panel"><h2 class="section-title">${icon("luggage")} ${h(stage.title)}</h2><p class="section-desc">${h(stage.description)}</p>${renderTaskList(stage.checklist.map(item=>({id:`legacy-${key}-${item.id}`,title:item.text,category:"출산/조리원",source:stage.title})))}</div>`).join("")}`;
}
function renderCompare(){
  return `<div class="grid">${Object.entries(DATA.planner.comparisonConfig).map(([group,config])=>`<div class="comparison-card panel"><h2 class="section-title">${icon(group==='hospitals'?'hospital':'home')} ${h(config.title)}</h2><div class="table-wrap"><table><thead><tr><th>구분</th>${config.fields.map(([_,label])=>`<th>${h(label)}</th>`).join("")}</tr></thead><tbody>${(state.comparisons[group]||[]).map((row,ri)=>`<tr><th>${h(row.label)}</th>${config.fields.map(([key])=>`<td><input data-comparison="${group}.${ri}.${key}" value="${h(row[key]||"")}" placeholder="입력"></td>`).join("")}</tr>`).join("")}</tbody></table></div></div>`).join("")}</div>`;
}
function renderBudget(){
  const expenseTotal=state.budget.expenses.reduce((a,x)=>a+Number(x.amount||0),0);
  const benefitTotal=state.budget.benefits.reduce((a,x)=>a+Number(x.amount||0),0);
  return `<div class="grid grid-2"><div class="budget-card panel"><h2 class="section-title">${icon("minus-circle")} 예상 지출</h2>${renderBudgetRows("expenses",state.budget.expenses)}<button class="btn" data-action="add-budget" data-group="expenses">${icon("plus")}지출 항목 추가</button></div><div class="budget-card panel"><h2 class="section-title">${icon("plus-circle")} 예상 지원금</h2>${renderBudgetRows("benefits",state.budget.benefits)}<button class="btn" data-action="add-budget" data-group="benefits">${icon("plus")}지원금 항목 추가</button></div></div><div class="panel"><h2 class="section-title">${icon("calculator")} 총액 계산</h2><div class="total-box"><div class="total-pill"><div class="label">예상 지출</div><div class="value">${money(expenseTotal)}</div></div><div class="total-pill"><div class="label">예상 지원금</div><div class="value">${money(benefitTotal)}</div></div><div class="total-pill"><div class="label">차감 후 예상 부담</div><div class="value">${money(expenseTotal-benefitTotal)}</div></div></div><p class="source-note">기본 금액은 업로드된 자료의 대표 항목을 바탕으로 한 입력값입니다. 실제 금액은 직접 수정해서 사용하세요.</p></div>`;
}
function renderBudgetRows(group,rows){
  return rows.map((row,i)=>`<div class="budget-row"><input class="input" data-budget-name="${group}.${i}" value="${h(row.name)}"><input class="input" type="number" data-budget-amount="${group}.${i}" value="${Number(row.amount||0)}"><button class="btn btn-sm btn-danger" data-action="remove-budget" data-group="${group}" data-index="${i}">삭제</button></div>`).join("");
}
function renderDiary(){
  return `<div class="panel"><h2 class="section-title">${icon("message-square")} 부부 태교 일기장</h2><form data-form="diary" class="form-grid"><div class="field"><label>작성자</label><select class="select" name="writer"><option>엄마</option><option>아빠</option><option>공동</option></select></div><div class="field"><label>제목</label><input class="input" name="title" placeholder="오늘의 기록"></div><div class="field full"><label>내용</label><textarea class="textarea" name="text" placeholder="아기에게 전하고 싶은 말, 산모 컨디션, 남편이 챙길 일 등을 기록"></textarea></div><div class="field full"><button class="btn btn-primary" type="submit">${icon("plus")}일기 추가</button></div></form></div><div class="diary-list">${state.diary.length?state.diary.map(d=>`<article class="diary-card"><div class="diary-meta"><span>${h(d.writer)} · ${h(d.title||"제목 없음")}</span><span>${h(d.date)}</span></div><p>${h(d.text)}</p><button class="btn btn-sm btn-danger" data-action="delete-diary" data-id="${d.id}" style="margin-top:12px">삭제</button></article>`).join(""):`<div class="empty"><div class="big">📝</div><p>아직 작성된 일기가 없습니다.</p></div>`}</div>`;
}
function renderFamily(){
  const fields=[
    ["dueDate","출산예정일","date"],["babyNickname","태명","text"],["babyName","아기 이름 후보","text"],["hospital","산부인과/출산병원","text"],["hospitalTel","분만실 직통번호","tel"],["carecenter","산후조리원","text"],["carecenterTel","조리원 연락처","tel"],["pediatrician","소아과","text"],["pediatricianTel","소아과 연락처","tel"],["insurance","태아보험/증권번호","text"],["emergencyContact","비상연락처","text"]
  ];
  return `<div class="panel"><h2 class="section-title">${icon("users")} 가족 정보</h2><div class="form-grid">${fields.map(([key,label,type])=>`<div class="field"><label>${h(label)}</label><input class="input" type="${type}" data-family="${key}" value="${h(state.family[key]||"")}"></div>`).join("")}<div class="field full"><label>가족 메모</label><textarea class="textarea" data-family="memo">${h(state.family.memo||"")}</textarea></div></div></div><div class="panel"><h2 class="section-title">${icon("siren")} 즉시 병원 연락이 필요한 상황</h2><ul class="warning-list"><li>양수 파수 의심: 양과 관계없이 병원 연락 후 이동</li><li>선홍색 출혈, 심한 복통, 고열, 심한 두통 또는 시야 이상</li><li>태동이 평소보다 현저히 줄거나 느껴지지 않는 경우</li><li>규칙적인 진통이 점점 짧아지고 강해지는 경우</li></ul></div>`;
}

app.addEventListener("click", e=>{
  const btn=e.target.closest("[data-action]"); if(!btn) return;
  const a=btn.dataset.action;
  if(a==="open-mobile"){state.mobileOpen=true;render();}
  if(a==="close-mobile"){state.mobileOpen=false;render();}
  if(a==="trimester"){state.selectedTrimester=Number(btn.dataset.trimester); const first=DATA.pregnancy.weeks.find(w=>w.trimester===state.selectedTrimester); state.selectedWeek=first.week; saveState(); render();}
  if(a==="select-week"){state.selectedWeek=Number(btn.dataset.week); state.selectedTrimester=DATA.pregnancy.weeks.find(w=>w.week===state.selectedWeek).trimester; saveState(); render();}
  if(a==="select-stage"){state.selectedStageId=btn.dataset.stage; saveState(); render();}
  if(a==="toggle"){toggleCheck(btn.dataset.id);}
  if(a==="subsidy-filter"){state.subsidyFilter=btn.dataset.filter; saveState(); render();}
  if(a==="reset-checks"){if(confirm("모든 체크 완료 상태를 초기화할까요?")){state.checked={};saveState();render();}}
  if(a==="export-json"){exportBackup();}
  if(a==="add-budget"){state.budget[btn.dataset.group].push({name:"새 항목",amount:0}); saveState(); render();}
  if(a==="remove-budget"){state.budget[btn.dataset.group].splice(Number(btn.dataset.index),1); saveState(); render();}
  if(a==="delete-diary"){state.diary=state.diary.filter(d=>String(d.id)!==String(btn.dataset.id)); saveState(); render();}
});
app.addEventListener("input", e=>{
  const t=e.target;
  if(t.dataset.field!==undefined){state[t.dataset.field]=t.value; saveState(); if(t.dataset.field==="search"){render(); setTimeout(()=>{const el=document.querySelector('[data-field="search"]'); if(el){el.focus(); el.setSelectionRange(el.value.length, el.value.length);}},0);}}
  if(t.dataset.family!==undefined){state.family[t.dataset.family]=t.value; saveState();}
  if(t.dataset.comparison){const [group,ri,key]=t.dataset.comparison.split("."); state.comparisons[group][Number(ri)][key]=t.value; saveState();}
  if(t.dataset.budgetName){const [group,i]=t.dataset.budgetName.split("."); state.budget[group][Number(i)].name=t.value; saveState();}
  if(t.dataset.budgetAmount){const [group,i]=t.dataset.budgetAmount.split("."); state.budget[group][Number(i)].amount=Number(t.value||0); saveState();}
});
app.addEventListener("change", e=>{
  const t=e.target;
  if(t.dataset.field!==undefined){state[t.dataset.field]=t.value; saveState(); render();}
  if(t.dataset.family!==undefined){state.family[t.dataset.family]=t.value; if(t.dataset.family==="dueDate"){const pos=getPosition(); if(pos.week){state.selectedWeek=pos.week; state.selectedTrimester=DATA.pregnancy.weeks.find(w=>w.week===pos.week)?.trimester || state.selectedTrimester;}} saveState(); render();}
  if(t.dataset.budgetAmount){const [group,i]=t.dataset.budgetAmount.split("."); state.budget[group][Number(i)].amount=Number(t.value||0); saveState(); render();}
});
app.addEventListener("submit", e=>{
  if(e.target.dataset.form==="diary"){
    e.preventDefault(); const fd=new FormData(e.target); const text=String(fd.get("text")||"").trim(); if(!text) return;
    state.diary.unshift({id:Date.now(),writer:fd.get("writer"),title:fd.get("title"),text,date:new Date().toLocaleString("ko-KR")}); saveState(); render();
  }
});
app.addEventListener("click", e=>{ const view=e.target.closest("[data-view]"); if(view){state.view=view.dataset.view; state.mobileOpen=false; saveState(); render();}});
function exportBackup(){
  const blob=new Blob([JSON.stringify({state,dataVersion:DATA.meta},null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="mommyflow-backup.json"; a.click(); URL.revokeObjectURL(url);
}
render();
