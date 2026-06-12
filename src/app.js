const STORAGE_KEY = "eumdi-parent-planner-v1";
const DAY_MS = 24 * 60 * 60 * 1000;

const baseCategories = [
  { id: "medical", name: "검진·건강", color: "#2f6f6d" },
  { id: "admin", name: "행정·서류", color: "#466a9f" },
  { id: "benefit", name: "지원금", color: "#b7791f" },
  { id: "insurance", name: "보험", color: "#7357a8" },
  { id: "hospital", name: "병원", color: "#d96c4b" },
  { id: "carecenter", name: "조리원", color: "#4d7c3f" },
  { id: "supplies", name: "육아용품", color: "#8a5f2d" },
  { id: "birth", name: "출산준비", color: "#b84a62" },
  { id: "partner", name: "아빠역할", color: "#59667d" },
  { id: "postpartum", name: "산후·신생아", color: "#2f7665" },
  { id: "budget", name: "예산", color: "#8b6f21" },
  { id: "family", name: "가족메모", color: "#4f5ba6" },
];

const stages = [
  {
    id: "w4-8",
    label: "4~8주",
    title: "임신 확인 직후",
    phase: "임신 초기",
    startWeek: 4,
    endWeek: 8,
    summary: "임신 확인, 기본 등록, 건강 루틴을 가장 먼저 정리합니다.",
  },
  {
    id: "w8-12",
    label: "8~12주",
    title: "임신 초기 검사",
    phase: "임신 초기",
    startWeek: 8,
    endWeek: 12,
    summary: "산전검사와 선택검사, 회사 제도 검토를 시작합니다.",
  },
  {
    id: "w12-16",
    label: "12~16주",
    title: "보험과 가족 정보",
    phase: "임신 중기",
    startWeek: 12,
    endWeek: 16,
    summary: "태아보험, 임산부 배지, 태명처럼 가족 기록의 뼈대를 잡습니다.",
  },
  {
    id: "w16-20",
    label: "16~20주",
    title: "중기 건강 관리",
    phase: "임신 중기",
    startWeek: 16,
    endWeek: 20,
    summary: "철분제, 태동, 성별 확인과 함께 조리원 후보를 넓혀 봅니다.",
  },
  {
    id: "w20-24",
    label: "20~24주",
    title: "정밀 확인과 비교",
    phase: "임신 중기",
    startWeek: 20,
    endWeek: 24,
    summary: "정밀초음파, 태교여행, 병원·조리원 비교가 겹치는 구간입니다.",
  },
  {
    id: "w24-28",
    label: "24~28주",
    title: "출산 병원 결정",
    phase: "임신 중기",
    startWeek: 24,
    endWeek: 28,
    summary: "임신성 당뇨 검사와 출산병원 결정을 마무리합니다.",
  },
  {
    id: "w28-32",
    label: "28~32주",
    title: "조리원 예약",
    phase: "임신 후기",
    startWeek: 28,
    endWeek: 32,
    summary: "조리원 예약, 카시트·유모차 조사, 지원 신청 시기를 체크합니다.",
  },
  {
    id: "w32-36",
    label: "32~36주",
    title: "출산 준비 집중",
    phase: "임신 후기",
    startWeek: 32,
    endWeek: 36,
    summary: "출산가방, 서류, 육아용품, 휴가 일정을 실제로 준비합니다.",
  },
  {
    id: "w36-40",
    label: "36~40주",
    title: "출산 전 최종 점검",
    phase: "임신 후기",
    startWeek: 36,
    endWeek: 40,
    summary: "응급 동선, 연락망, 출산가방, 주 1회 검진을 최종 확인합니다.",
  },
  {
    id: "birth-day",
    label: "출산 당일",
    title: "병원 이동과 입원",
    phase: "출산",
    minPostpartumDay: -1,
    maxPostpartumDay: 0,
    summary: "진통 간격 기록부터 입원 수속까지 당일 행동만 모았습니다.",
  },
  {
    id: "post-birth",
    label: "출생~1개월",
    title: "출산 직후 행정",
    phase: "출산 후",
    minPostpartumDay: 0,
    maxPostpartumDay: 31,
    summary: "출생신고, 건강보험, 지원금 신청, 예방접종 일정을 놓치지 않습니다.",
  },
  {
    id: "post-0-3",
    label: "0~3개월",
    title: "산후 100일",
    phase: "출산 후",
    minPostpartumMonth: 0,
    maxPostpartumMonth: 3,
    summary: "밤수유, 기저귀, 산모 회복, 예방접종을 가족 단위로 운영합니다.",
  },
  {
    id: "post-4-6",
    label: "4~6개월",
    title: "이유식 준비",
    phase: "육아",
    minPostpartumMonth: 4,
    maxPostpartumMonth: 6,
    summary: "수면 패턴과 이유식 준비, 발달 체크를 함께 봅니다.",
  },
  {
    id: "post-7-12",
    label: "7~12개월",
    title: "돌 전 준비",
    phase: "육아",
    minPostpartumMonth: 7,
    maxPostpartumMonth: 12,
    summary: "이유식 확대, 안전, 돌잔치, 책과 장난감 준비가 이어집니다.",
  },
  {
    id: "post-13-24",
    label: "13~24개월",
    title: "어린이집과 장기 계획",
    phase: "육아",
    minPostpartumMonth: 13,
    maxPostpartumMonth: 24,
    summary: "어린이집, 언어 발달, 안전교육, 둘째 계획까지 정리합니다.",
  },
];

const tasks = [
  task("t-confirm-ob", "w4-8", "산부인과 방문 및 자궁내 임신 확인", "medical", "공동", "필수", "첫 방문에서 임신 위치와 기본 상태를 확인합니다."),
  task("t-heartbeat", "w4-8", "심장박동과 출산예정일 확인", "medical", "공동", "필수", "예정일은 이후 모든 일정 계산의 기준이 됩니다."),
  task("t-pregnancy-doc", "w4-8", "임신확인서 발급", "admin", "엄마", "필수", "국민행복카드와 회사 제도 신청에 자주 필요합니다."),
  task("t-national-card", "w4-8", "국민행복카드 신청", "benefit", "공동", "필수", "단태아 기준 100만원 지원을 받을 수 있습니다."),
  task("t-folic", "w4-8", "엽산 복용 시작", "medical", "엄마", "필수", "복용 중인 약이 있으면 담당의와 함께 점검합니다."),
  task("t-seongnam-register", "w4-8", "성남시 보건소 임산부 등록", "admin", "엄마", "권장", "엽산·철분 지원과 교육 안내를 함께 확인합니다."),
  task("t-health-rules", "w4-8", "금주·금연·카페인 200mg 이하 원칙 정하기", "medical", "공동", "필수", "가족 생활 루틴으로 같이 정하면 유지하기 쉽습니다."),
  task("t-medication-check", "w4-8", "복용 중 약물과 영양제 점검", "medical", "엄마", "필수", "임의 중단 대신 담당의나 약사에게 확인합니다."),

  task("t-prenatal-lab", "w8-12", "산전 기본검사 받기", "medical", "엄마", "필수", "혈액형, 빈혈, 풍진, 간염, 매독, HIV, 소변 검사를 포함합니다."),
  task("t-nipt", "w8-12", "NIPT·유전자 검사 여부 결정", "medical", "공동", "선택", "비용과 필요성을 병원 상담 후 결정합니다."),
  task("t-work-policy", "w8-12", "회사 임신 사실 공유와 근로시간 단축 검토", "admin", "공동", "권장", "업무 특성과 건강 상태에 맞춰 시기를 정합니다."),
  task("t-insurance-research", "w8-12", "태아보험 비교 시작", "insurance", "아빠", "권장", "선천성 질환, NICU, 입원비, 수술비를 우선 봅니다."),
  task("t-emergency-draft", "w8-12", "가족 비상연락처 초안 작성", "family", "공동", "권장", "산부인과, 응급실, 배우자, 부모님 연락처를 모읍니다."),

  task("t-fetal-insurance", "w12-16", "태아보험 가입 또는 보장 최종 선택", "insurance", "공동", "필수", "22주 이전 가입을 권장합니다."),
  task("t-badge", "w12-16", "임산부 배지 수령", "admin", "엄마", "권장", "대중교통과 공공장소 이용 시 도움이 됩니다."),
  task("t-taemyeong", "w12-16", "태명 결정", "family", "공동", "권장", "가족 목표 관리에 기록해 둡니다."),
  task("t-parenting-info", "w12-16", "육아 정보 수집 시작", "family", "공동", "권장", "검증된 병원·공공기관 자료를 우선 모읍니다."),
  task("t-health-supply", "w12-16", "성남시 엽산·철분 지원 확인", "benefit", "엄마", "권장", "보건소 등록 상태와 수령 방법을 확인합니다."),

  task("t-iron", "w16-20", "철분제 복용 시작", "medical", "엄마", "필수", "복용 방법과 변비 대응을 함께 확인합니다."),
  task("t-gender", "w16-20", "성별 확인 여부 결정", "medical", "공동", "선택", "알고 싶은 시점과 가족 공유 범위를 정합니다."),
  task("t-movement", "w16-20", "태동 확인과 기록 시작", "medical", "엄마", "권장", "평소와 다른 변화가 있으면 병원에 문의합니다."),
  task("t-carecenter-longlist", "w16-20", "조리원 후보 조사 시작", "carecenter", "아빠", "권장", "거리, 비용, 신생아실, 면회정책을 같이 봅니다."),
  task("t-mid-routine", "w16-20", "수면·식사·가벼운 운동 루틴 정리", "medical", "공동", "권장", "무리한 운동은 담당의와 상의합니다."),

  task("t-detail-ultrasound", "w20-24", "정밀초음파 예약 및 검사", "medical", "공동", "필수", "검사 전후 궁금한 점을 메모해 갑니다."),
  task("t-babymoon", "w20-24", "태교여행 계획 또는 대체 일정 확정", "family", "공동", "선택", "이동 거리, 보험, 병원 접근성을 함께 고려합니다."),
  task("t-carecenter-visit", "w20-24", "조리원 상담 예약", "carecenter", "아빠", "권장", "1인실, 신생아실, 마사지, 식사, 거리 기준으로 비교합니다."),
  task("t-hospital-compare", "w20-24", "출산병원 후보 비교", "hospital", "공동", "필수", "집에서 30분 이내, 24시간 대응, 응급분만 가능 여부를 봅니다."),
  task("t-insurance-final-check", "w20-24", "태아보험 보장 최종 점검", "insurance", "공동", "권장", "가입 전 누락된 특약과 면책 조건을 확인합니다."),

  task("t-diabetes", "w24-28", "임신성 당뇨 검사", "medical", "엄마", "필수", "검사 안내에 맞춰 식사와 방문 시간을 준비합니다."),
  task("t-preterm-risk", "w24-28", "조산 위험과 주의 증상 확인", "medical", "공동", "권장", "복통, 출혈, 양수 의심 증상을 가족이 같이 숙지합니다."),
  task("t-birth-hospital-final", "w24-28", "출산병원 최종 결정", "hospital", "공동", "필수", "야간진료, 주차, 응급대응, 비용을 함께 확정합니다."),
  task("t-budget-draft", "w24-28", "출산 예산 초안 작성", "budget", "공동", "권장", "임신기간 450만원, 출산준비 700만원을 기준점으로 조정합니다."),

  task("t-carecenter-book", "w28-32", "산후조리원 예약 완료", "carecenter", "공동", "필수", "계약금, 취소규정, 면회정책을 기록합니다."),
  task("t-car-seat-research", "w28-32", "카시트 조사", "supplies", "아빠", "필수", "출산 후 퇴원 이동을 위해 우선순위가 높습니다."),
  task("t-stroller-research", "w28-32", "유모차 조사", "supplies", "공동", "권장", "차량 크기와 생활 동선에 맞춰 고릅니다."),
  task("t-supplies-list", "w28-32", "육아용품 구매 목록 정리", "supplies", "공동", "권장", "수면, 수유, 위생, 이동 카테고리로 나눕니다."),
  task("t-care-service-window", "w28-32", "산모·신생아 건강관리 신청 시기 확인", "benefit", "아빠", "권장", "출산예정일 40일 전부터 출산 후 60일 사이를 확인합니다."),

  task("t-birth-bag", "w32-36", "출산가방 준비", "birth", "공동", "필수", "산모수첩, 신분증, 충전기, 수유브라, 세면도구를 포함합니다."),
  task("t-baby-name", "w32-36", "아기 이름 후보 선정", "family", "공동", "권장", "출생신고 전에 후보를 좁혀 둡니다."),
  task("t-car-seat-buy", "w32-36", "카시트 구매와 설치 계획", "supplies", "아빠", "필수", "차량 설치 방식과 신생아 사용 가능 여부를 확인합니다."),
  task("t-stroller-buy", "w32-36", "유모차 구매", "supplies", "공동", "권장", "생활권과 보관 공간에 맞춰 결정합니다."),
  task("t-leave-plan", "w32-36", "출산휴가·육아휴직 일정 정리", "admin", "공동", "필수", "회사 제출 서류와 시작일을 확인합니다."),
  task("t-documents", "w32-36", "임신 중·출산 후 서류 준비", "admin", "아빠", "권장", "신분증, 임신확인서, 등본, 가족관계증명서, 통장사본을 모읍니다."),

  task("t-emergency-route", "w36-40", "병원 연락망과 응급 이동 경로 확인", "hospital", "아빠", "필수", "야간 이동, 주차, 택시 대안까지 정합니다."),
  task("t-labor-signs", "w36-40", "진통·양수 파수 대응 숙지", "birth", "공동", "필수", "출혈, 태동 감소, 고열, 심한 복통은 즉시 병원에 연락합니다."),
  task("t-weekly-check", "w36-40", "주 1회 검진 일정 관리", "medical", "엄마", "필수", "막달 검진 일정을 달력에 고정합니다."),
  task("t-bag-final", "w36-40", "출산가방 최종 점검", "birth", "아빠", "필수", "퇴원복, 배냇저고리, 속싸개, 충전기를 다시 봅니다."),
  task("t-home-ready", "w36-40", "집 정리와 생활용품 보충", "partner", "아빠", "권장", "냉장고, 세탁, 기저귀·분유 보관 공간을 정리합니다."),

  task("t-contraction", "birth-day", "진통 간격 기록", "birth", "공동", "필수", "간격과 강도를 기록해 병원 안내에 맞춰 이동합니다."),
  task("t-call-hospital", "birth-day", "병원 연락 후 이동", "hospital", "아빠", "필수", "양수 파수나 선홍색 출혈은 바로 연락합니다."),
  task("t-admission", "birth-day", "입원 수속과 보호자 등록", "admin", "아빠", "필수", "신분증과 필요 서류를 바로 꺼낼 수 있게 둡니다."),
  task("t-parking", "birth-day", "차량 이동·주차·가족 연락", "partner", "아빠", "권장", "주차 위치와 가족 연락 순서를 정해 둡니다."),

  task("t-birth-register", "post-birth", "출생신고", "admin", "아빠", "필수", "출생 후 1개월 이내 처리합니다."),
  task("t-health-insurance", "post-birth", "주민등록과 건강보험 피부양자 등록", "admin", "아빠", "필수", "출생신고 후 이어서 처리하면 편합니다."),
  task("t-first-voucher", "post-birth", "첫만남이용권 신청", "benefit", "아빠", "필수", "출생신고 후 즉시 신청을 권장합니다."),
  task("t-parent-pay", "post-birth", "부모급여 신청", "benefit", "아빠", "필수", "복지로 또는 주민센터 신청 경로를 확인합니다."),
  task("t-child-allowance", "post-birth", "아동수당 신청", "benefit", "아빠", "필수", "만 8세까지 지급되는 월 10만원 수당입니다."),
  task("t-vaccine-schedule", "post-birth", "예방접종 일정 등록", "postpartum", "공동", "필수", "B형간염, BCG, DTaP, IPV, 폐렴구균, MMR을 관리합니다."),
  task("t-postpartum-support", "post-birth", "산후조리비·경기도 추가지원 확인", "benefit", "공동", "권장", "성남시와 경기도 기준을 최신 안내로 확인합니다."),
  task("t-carecenter-entry", "post-birth", "조리원 입소 물품과 면회정책 확인", "carecenter", "공동", "권장", "신생아실 운영, 모자동실, 1인실 여부도 함께 봅니다."),

  task("t-night-feeding", "post-0-3", "밤수유와 기저귀 분담표 만들기", "partner", "공동", "필수", "산모 회복 시간을 일정에 명시합니다."),
  task("t-baby-appointments", "post-0-3", "소아과 예약과 예방접종 동행", "postpartum", "공동", "필수", "야간진료와 예방접종 가능 여부를 미리 확인합니다."),
  task("t-inventory", "post-0-3", "분유·기저귀·물티슈 재고관리", "postpartum", "아빠", "권장", "월별 육아 예산과 함께 관리합니다."),
  task("t-bath-sleep", "post-0-3", "목욕과 재우기 루틴 정하기", "postpartum", "공동", "권장", "같은 방식으로 반복할수록 가족 부담이 줄어듭니다."),
  task("t-mom-recovery", "post-0-3", "산모 식사와 회복 시간 확보", "partner", "아빠", "필수", "방문객 조율과 식사 준비를 함께 맡습니다."),
  task("t-care-service-use", "post-0-3", "산모·신생아 건강관리 서비스 이용", "benefit", "공동", "권장", "신청 결과와 이용 기간을 가족 메모에 기록합니다."),

  task("t-baby-food-ready", "post-4-6", "이유식 준비", "postpartum", "공동", "권장", "도구, 보관 용기, 식재료 계획을 세웁니다."),
  task("t-sleep-pattern", "post-4-6", "수면 패턴과 뒤집기 발달 체크", "postpartum", "공동", "권장", "발달 변화는 소아과 상담 때 함께 이야기합니다."),
  task("t-regular-check", "post-4-6", "소아과 정기 체크", "hospital", "공동", "권장", "예방접종과 성장 상태를 같이 확인합니다."),

  task("t-food-expand", "post-7-12", "이유식 확대", "postpartum", "공동", "권장", "알레르기 반응과 식단을 기록합니다."),
  task("t-home-safety", "post-7-12", "기기 시작 전 안전교육과 집 정리", "postpartum", "공동", "필수", "모서리, 콘센트, 바닥 물건을 먼저 점검합니다."),
  task("t-first-birthday", "post-7-12", "돌잔치 준비", "family", "공동", "선택", "9개월부터 장소, 촬영, 답례품을 비교합니다."),
  task("t-books-toys", "post-7-12", "장난감과 유아책 구매 계획", "supplies", "공동", "권장", "출산 후 구매 우선순위로 천천히 준비합니다."),

  task("t-daycare", "post-13-24", "어린이집 검토", "family", "공동", "필수", "거리, 운영시간, CCTV, 식단을 비교합니다."),
  task("t-language", "post-13-24", "언어 발달 체크", "postpartum", "공동", "권장", "정기 검진에서 발달 상태를 상담합니다."),
  task("t-second-child", "post-13-24", "둘째 계획 체크", "family", "공동", "선택", "첫째 어린이집, 차량 크기, 육아휴직, 주거환경을 봅니다."),
  task("t-monthly-budget", "post-13-24", "월 육아 예산 재조정", "budget", "공동", "권장", "6~24개월 예상 30~80만원/월을 기준으로 조정합니다."),
];

const benefits = [
  money("b-national-card", "국민행복카드", "100만원", "임신 확인 즉시", "w4-8", "임신확인서 필요. 산부인과, 약국, 일부 산후관리 사용처 확인."),
  money("b-folic-iron", "성남시 엽산·철분 지원", "물품 지원", "임산부 등록 후", "w4-8", "관할 보건소 등록과 수령 방법을 확인합니다."),
  money("b-fetal-insurance", "태아보험", "개별 가입", "22주 이전 권장", "w12-16", "선천성 질환, NICU, 입원비, 수술비 보장 여부를 비교합니다."),
  money("b-mother-baby", "산모·신생아 건강관리", "조건별 상이", "예정일 40일 전~출산 후 60일", "w28-32", "복지로 신청 가능 여부와 성남시 추가 기준을 확인합니다."),
  money("b-first-meeting", "첫만남이용권", "첫째 200만원", "출생신고 후", "post-birth", "둘째 이상은 300만원 기준으로 별도 확인합니다."),
  money("b-parent-pay", "부모급여", "0세 월 100만원, 1세 월 50만원", "출생신고 후", "post-birth", "0~1세 합산 연 1,800만원 기준입니다."),
  money("b-child-allowance", "아동수당", "월 10만원", "출생신고 후", "post-birth", "만 8세까지 지급되는 수당입니다."),
  money("b-postpartum-cost", "산후조리비 지원", "지역 기준 확인", "출생 후 6개월 이내 확인", "post-birth", "성남시와 경기도 공지 기준을 최신으로 확인합니다."),
];

const comparisonConfig = {
  hospitals: {
    title: "산부인과 비교",
    rows: ["병원 A", "병원 B", "병원 C"],
    fields: [
      ["name", "이름"],
      ["distance", "거리"],
      ["naturalCost", "자연분만 비용"],
      ["cSectionCost", "제왕절개 비용"],
      ["parking", "주차"],
      ["nightCare", "야간진료"],
      ["emergency", "응급대응"],
      ["notes", "메모"],
    ],
  },
  centers: {
    title: "산후조리원 비교",
    rows: ["조리원 A", "조리원 B", "조리원 C"],
    fields: [
      ["name", "이름"],
      ["cost", "비용"],
      ["privateRoom", "1인실"],
      ["newbornRoom", "신생아실"],
      ["massage", "마사지"],
      ["meal", "식사"],
      ["visiting", "면회규정"],
      ["distance", "거리"],
      ["notes", "메모"],
    ],
  },
};

const familyFields = [
  ["dueDate", "출산예정일", "date"],
  ["babyNickname", "태명", "text"],
  ["babyName", "아기 이름 후보", "text"],
  ["hospital", "산부인과", "text"],
  ["carecenter", "조리원", "text"],
  ["pediatrician", "소아과", "text"],
  ["insurance", "태아보험", "text"],
  ["totalBudget", "총 육아예산", "text"],
  ["monthlyBudget", "월 육아예산", "text"],
  ["emergencyContact", "비상연락처", "text"],
];

const app = document.querySelector("#app");
let state = loadState();

render();

app.addEventListener("click", (event) => {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) {
    state.view = viewButton.dataset.view;
    saveState();
    render();
    return;
  }

  const action = event.target.closest("[data-action]");
  if (!action) return;

  if (action.dataset.action === "reset-checks") {
    if (window.confirm("완료 체크를 모두 초기화할까요?")) {
      state.checked = {};
      saveState();
      render();
    }
  }
});

app.addEventListener("change", (event) => {
  const target = event.target;

  if (target.matches("[data-task-id]")) {
    state.checked[target.dataset.taskId] = target.checked;
    saveState();
    render();
    return;
  }

  if (target.matches("[data-benefit-id]")) {
    state.checked[target.dataset.benefitId] = target.checked;
    saveState();
    render();
    return;
  }

  if (target.matches("[data-category-id]")) {
    state.selectedCategories[target.dataset.categoryId] = target.checked;
    saveState();
    render();
    return;
  }

  if (target.matches("[data-current-stage]")) {
    state.selectedStage = target.value;
    saveState();
    render();
    return;
  }

  if (target.matches("[data-family='dueDate']")) {
    state.family.dueDate = target.value;
    saveState();
    render();
  }
});

app.addEventListener("input", (event) => {
  const target = event.target;

  if (target.matches("#searchBox")) {
    state.search = target.value;
    saveState();
    render("searchBox");
    return;
  }

  if (target.matches("[data-family]")) {
    state.family[target.dataset.family] = target.value;
    saveState();
    return;
  }

  if (target.matches("[data-comparison]")) {
    const [group, rowIndex, key] = target.dataset.comparison.split(".");
    state.comparisons[group][Number(rowIndex)][key] = target.value;
    saveState();
  }
});

app.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.target;

  if (form.matches("[data-form='category']")) {
    const formData = new FormData(form);
    const name = String(formData.get("name") || "").trim();
    const color = String(formData.get("color") || "#2f6f6d");
    if (!name) return;
    const id = `custom-${slugify(name)}-${Date.now()}`;
    state.customCategories.push({ id, name, color });
    state.selectedCategories[id] = true;
    saveState();
    render();
    return;
  }

  if (form.matches("[data-form='task']")) {
    const formData = new FormData(form);
    const title = String(formData.get("title") || "").trim();
    if (!title) return;
    state.customTasks.push({
      id: `custom-task-${Date.now()}`,
      title,
      stageId: String(formData.get("stageId")),
      categoryId: String(formData.get("categoryId")),
      owner: String(formData.get("owner") || "공동"),
      priority: String(formData.get("priority") || "맞춤"),
      note: String(formData.get("note") || "").trim(),
      custom: true,
    });
    saveState();
    render();
  }
});

function render(focusId) {
  const position = getTimelinePosition();
  const activeStageId = state.selectedStage || position.activeStageId;

  app.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <div class="topbar-inner">
          <div class="brand">
            <h1 class="brand-title">성남시 예비 부모 타임라인</h1>
            <p class="brand-subtitle">임신 확인부터 출산 후 24개월까지, 필요한 일만 시기별로 체크</p>
          </div>
          <div class="toolbar">
            <label class="field">
              <span>출산예정일</span>
              <input class="input" type="date" data-family="dueDate" value="${escapeAttr(state.family.dueDate)}" />
            </label>
            <label class="field">
              <span>현재 기준</span>
              <select class="select" data-current-stage>
                <option value="">예정일 기준 자동</option>
                ${stages.map((stage) => `<option value="${stage.id}" ${activeStageId === stage.id && state.selectedStage ? "selected" : ""}>${stage.label} ${stage.title}</option>`).join("")}
              </select>
            </label>
            <button class="button ghost" type="button" data-action="reset-checks">완료 초기화</button>
          </div>
        </div>
      </header>

      <div class="layout">
        ${renderSidebar(activeStageId)}
        <main>
          ${renderMetrics(position, activeStageId)}
          ${renderTabs()}
          ${renderActiveView(activeStageId)}
        </main>
      </div>
    </div>
  `;

  if (focusId) {
    const focusTarget = document.getElementById(focusId);
    if (focusTarget) {
      focusTarget.focus();
      const length = focusTarget.value.length;
      focusTarget.setSelectionRange(length, length);
    }
  }
}

function renderSidebar(activeStageId) {
  const categories = getCategories();
  return `
    <aside class="side-panel">
      <div class="search-row">
        <label class="field">
          <span>검색</span>
          <input id="searchBox" class="input" type="search" value="${escapeAttr(state.search)}" placeholder="지원금, 조리원, 카시트..." />
        </label>
      </div>

      <h2 class="section-title">카테고리</h2>
      <div class="filter-list">
        ${categories.map((category) => renderCategoryToggle(category)).join("")}
      </div>

      <form class="add-box" data-form="category">
        <h2 class="section-title">맞춤 카테고리</h2>
        <input class="input" name="name" type="text" placeholder="예: 회사, 산후운동" />
        <select class="select" name="color">
          <option value="#2f6f6d">청록</option>
          <option value="#d96c4b">코럴</option>
          <option value="#466a9f">블루</option>
          <option value="#7357a8">보라</option>
          <option value="#8a5f2d">브라운</option>
        </select>
        <button class="button primary" type="submit">카테고리 추가</button>
      </form>

      <div class="add-box">
        <h2 class="section-title">전체 흐름</h2>
        <div class="stage-map">
          ${stages.map((stage) => renderMiniStage(stage, activeStageId)).join("")}
        </div>
      </div>
    </aside>
  `;
}

function renderCategoryToggle(category) {
  const count = getAllTasks().filter((item) => item.categoryId === category.id).length;
  return `
    <label class="category-toggle">
      <input type="checkbox" data-category-id="${category.id}" ${isCategorySelected(category.id) ? "checked" : ""} />
      <span><span class="dot" style="background:${category.color}"></span> ${escapeHtml(category.name)}</span>
      <span class="count-pill">${count}</span>
    </label>
  `;
}

function renderMiniStage(stage, activeStageId) {
  const percent = getStagePercent(stage.id);
  return `
    <div class="mini-stage ${stage.id === activeStageId ? "active" : ""}">
      <div class="mini-stage-title">${escapeHtml(stage.label)}</div>
      <div class="mini-bar" style="--progress:${percent}%"><span></span></div>
      <div class="count-pill">${percent}%</div>
    </div>
  `;
}

function renderMetrics(position, activeStageId) {
  const allItems = [...getAllTasks(), ...benefits];
  const checkedCount = allItems.filter((item) => isDone(item.id)).length;
  const totalCount = allItems.length;
  const activeTasks = getAllTasks().filter((item) => item.stageId === activeStageId);
  const activeDone = activeTasks.filter((item) => isDone(item.id)).length;
  const activeStage = getStage(activeStageId);
  const benefitTotal = "2,340만원";

  return `
    <section class="metric-grid" aria-label="요약">
      <div class="metric">
        <div class="metric-label">현재 위치</div>
        <div class="metric-value">${escapeHtml(position.label)}</div>
        <div class="metric-caption">${escapeHtml(position.caption)}</div>
      </div>
      <div class="metric">
        <div class="metric-label">현재 구간</div>
        <div class="metric-value">${escapeHtml(activeStage.label)}</div>
        <div class="metric-caption">${escapeHtml(activeStage.title)}</div>
      </div>
      <div class="metric">
        <div class="metric-label">전체 완료</div>
        <div class="metric-value">${checkedCount}/${totalCount}</div>
        <div class="metric-caption">${Math.round((checkedCount / Math.max(totalCount, 1)) * 100)}% 진행</div>
      </div>
      <div class="metric">
        <div class="metric-label">24개월 지원 기준</div>
        <div class="metric-value">${benefitTotal}</div>
        <div class="metric-caption">출생~24개월 예상 수령액</div>
      </div>
    </section>
    <section class="panel" style="margin-bottom: 14px;">
      <strong>${escapeHtml(activeStage.title)}</strong>
      <span class="fineprint">현재 구간 체크 ${activeDone}/${activeTasks.length}. 지원 기준과 금액은 신청 전 공식 안내로 다시 확인하세요.</span>
    </section>
  `;
}

function renderTabs() {
  const tabs = [
    ["timeline", "타임라인"],
    ["checklist", "체크리스트"],
    ["benefits", "지원금"],
    ["compare", "병원·조리원"],
    ["family", "가족 노트"],
  ];

  return `
    <nav class="tabs" aria-label="화면 선택">
      ${tabs.map(([id, label]) => `<button class="tab ${state.view === id ? "active" : ""}" type="button" data-view="${id}">${label}</button>`).join("")}
    </nav>
  `;
}

function renderActiveView(activeStageId) {
  if (state.view === "checklist") return renderChecklist();
  if (state.view === "benefits") return renderBenefits();
  if (state.view === "compare") return renderComparisons();
  if (state.view === "family") return renderFamily();
  return renderTimeline(activeStageId);
}

function renderTimeline(activeStageId) {
  return `
    <section class="timeline">
      ${stages.map((stage) => renderStage(stage, activeStageId)).join("")}
    </section>
  `;
}

function renderStage(stage, activeStageId) {
  const stageTasks = getAllTasks()
    .filter((item) => item.stageId === stage.id)
    .filter(matchesFilters);
  const percent = getStagePercent(stage.id);

  return `
    <article class="stage-card ${stage.id === activeStageId ? "active" : ""}">
      <div class="stage-head">
        <div>
          <div class="stage-kicker">
            <span>${escapeHtml(stage.phase)}</span>
            <span>${escapeHtml(stage.label)}</span>
          </div>
          <h2 class="stage-title">${escapeHtml(stage.title)}</h2>
          <p class="stage-summary">${escapeHtml(stage.summary)}</p>
        </div>
        <div class="progress-ring" style="--progress:${percent}%">
          <span>${percent}%</span>
        </div>
      </div>
      <div class="task-list">
        ${stageTasks.length ? stageTasks.map(renderTask).join("") : `<div class="empty-state">선택한 카테고리나 검색어에 맞는 항목이 없습니다.</div>`}
      </div>
    </article>
  `;
}

function renderChecklist() {
  const categories = getCategories();
  const groups = categories
    .map((category) => ({
      category,
      items: getAllTasks()
        .filter((item) => item.categoryId === category.id)
        .filter(matchesFilters),
    }))
    .filter((group) => group.items.length);

  return `
    <section class="timeline">
      <article class="panel">
        <h2 class="section-title">맞춤 항목 추가</h2>
        <form class="form-grid three" data-form="task">
          <input class="input" name="title" type="text" placeholder="체크할 일" required />
          <select class="select" name="stageId">${stages.map((stage) => `<option value="${stage.id}">${stage.label} ${stage.title}</option>`).join("")}</select>
          <select class="select" name="categoryId">${categories.map((category) => `<option value="${category.id}">${escapeHtml(category.name)}</option>`).join("")}</select>
          <input class="input" name="owner" type="text" placeholder="담당: 공동" />
          <select class="select" name="priority">
            <option value="맞춤">맞춤</option>
            <option value="필수">필수</option>
            <option value="권장">권장</option>
            <option value="선택">선택</option>
          </select>
          <input class="input" name="note" type="text" placeholder="메모" />
          <button class="button primary" type="submit">항목 추가</button>
        </form>
      </article>

      ${groups.length ? groups.map((group) => `
        <article class="stage-card">
          <div class="stage-head">
            <div>
              <div class="stage-kicker">
                <span class="dot" style="background:${group.category.color}"></span>
                <span>${escapeHtml(group.category.name)}</span>
              </div>
              <h2 class="stage-title">${escapeHtml(group.category.name)} 체크리스트</h2>
            </div>
            <div class="count-pill">${group.items.filter((item) => isDone(item.id)).length}/${group.items.length}</div>
          </div>
          <div class="task-list">${group.items.map(renderTask).join("")}</div>
        </article>
      `).join("") : `<div class="empty-state">표시할 체크리스트가 없습니다.</div>`}
    </section>
  `;
}

function renderTask(item) {
  const category = getCategory(item.categoryId);
  const stage = getStage(item.stageId);
  const done = isDone(item.id);
  return `
    <label class="task-item">
      <input type="checkbox" data-task-id="${item.id}" ${done ? "checked" : ""} />
      <span>
        <span class="task-title ${done ? "done" : ""}">${escapeHtml(item.title)}</span>
        ${item.note ? `<span class="task-note">${escapeHtml(item.note)}</span>` : ""}
        <span class="task-meta">
          <span class="tag" style="background:${category.color}">${escapeHtml(category.name)}</span>
          <span class="owner-pill">${escapeHtml(item.owner)}</span>
          <span class="priority-pill ${item.priority === "필수" ? "must" : ""}">${escapeHtml(item.priority)}</span>
          <span class="owner-pill">${escapeHtml(stage.label)}</span>
        </span>
      </span>
    </label>
  `;
}

function renderBenefits() {
  return `
    <section class="money-grid">
      ${benefits.map((item) => {
        const stage = getStage(item.stageId);
        return `
          <article class="money-card">
            <div class="money-title">
              <span>${escapeHtml(item.title)}</span>
              <input type="checkbox" data-benefit-id="${item.id}" ${isDone(item.id) ? "checked" : ""} />
            </div>
            <div class="money-amount">${escapeHtml(item.amount)}</div>
            <div class="money-meta">
              신청 시기: ${escapeHtml(item.timing)}<br />
              타임라인: ${escapeHtml(stage.label)} ${escapeHtml(stage.title)}
            </div>
            <div class="fineprint">${escapeHtml(item.note)}</div>
          </article>
        `;
      }).join("")}
      <article class="money-card">
        <div class="money-title">예상 총액</div>
        <div class="money-amount">출생~24개월 약 2,340만원</div>
        <div class="money-meta">국민행복카드 100만원 + 첫만남이용권 200만원 + 부모급여 1,800만원 + 아동수당 240만원</div>
        <div class="fineprint">출생~만 8세 기준 예상 총액은 약 3,060만원입니다.</div>
      </article>
    </section>
  `;
}

function renderComparisons() {
  return `
    <section>
      ${renderComparisonTable("hospitals")}
      ${renderComparisonTable("centers")}
    </section>
  `;
}

function renderComparisonTable(group) {
  const config = comparisonConfig[group];
  const rows = state.comparisons[group];
  return `
    <article class="panel" style="margin-bottom: 14px;">
      <h2 class="section-title">${config.title}</h2>
      <div class="table-wrap">
        <table class="comparison-table">
          <thead>
            <tr>${config.fields.map(([, label]) => `<th>${label}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${rows.map((row, rowIndex) => `
              <tr>
                ${config.fields.map(([key]) => `
                  <td>
                    <input value="${escapeAttr(row[key] || "")}" data-comparison="${group}.${rowIndex}.${key}" placeholder="${escapeAttr(row.label || "")}" />
                  </td>
                `).join("")}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </article>
  `;
}

function renderFamily() {
  return `
    <section class="note-panel">
      <h2 class="section-title">가족 목표 관리</h2>
      <div class="form-grid">
        ${familyFields.map(([key, label, type]) => `
          <label class="field">
            <span>${label}</span>
            <input class="input" type="${type}" data-family="${key}" value="${escapeAttr(state.family[key] || "")}" />
          </label>
        `).join("")}
      </div>
      <label class="field" style="margin-top: 12px;">
        <span>메모</span>
        <textarea class="textarea" data-family="memo">${escapeHtml(state.family.memo || "")}</textarea>
      </label>
    </section>
  `;
}

function task(id, stageId, title, categoryId, owner, priority, note) {
  return { id, stageId, title, categoryId, owner, priority, note };
}

function money(id, title, amount, timing, stageId, note) {
  return { id, title, amount, timing, stageId, note, categoryId: "benefit" };
}

function loadState() {
  const defaults = createDefaultState();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      ...defaults,
      ...saved,
      family: { ...defaults.family, ...(saved.family || {}) },
      checked: { ...defaults.checked, ...(saved.checked || {}) },
      selectedCategories: {
        ...defaults.selectedCategories,
        ...(saved.selectedCategories || {}),
      },
      comparisons: {
        hospitals: mergeRows(defaults.comparisons.hospitals, saved.comparisons?.hospitals),
        centers: mergeRows(defaults.comparisons.centers, saved.comparisons?.centers),
      },
      customCategories: Array.isArray(saved.customCategories) ? saved.customCategories : [],
      customTasks: Array.isArray(saved.customTasks) ? saved.customTasks : [],
    };
  } catch {
    return defaults;
  }
}

function createDefaultState() {
  return {
    view: "timeline",
    search: "",
    selectedStage: "",
    checked: {},
    customCategories: [],
    customTasks: [],
    selectedCategories: Object.fromEntries(baseCategories.map((category) => [category.id, true])),
    family: {
      dueDate: "",
      babyNickname: "",
      babyName: "",
      hospital: "",
      carecenter: "",
      pediatrician: "",
      insurance: "",
      totalBudget: "",
      monthlyBudget: "",
      emergencyContact: "",
      memo: "",
    },
    comparisons: {
      hospitals: createRows(comparisonConfig.hospitals),
      centers: createRows(comparisonConfig.centers),
    },
  };
}

function createRows(config) {
  return config.rows.map((label) => {
    const row = { label };
    config.fields.forEach(([key]) => {
      row[key] = key === "name" ? label : "";
    });
    return row;
  });
}

function mergeRows(defaultRows, savedRows) {
  if (!Array.isArray(savedRows)) return defaultRows;
  return defaultRows.map((row, index) => ({ ...row, ...(savedRows[index] || {}) }));
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getCategories() {
  return [...baseCategories, ...state.customCategories];
}

function getAllTasks() {
  return [...tasks, ...state.customTasks];
}

function getCategory(id) {
  return getCategories().find((category) => category.id === id) || baseCategories[0];
}

function getStage(id) {
  return stages.find((stage) => stage.id === id) || stages[0];
}

function isDone(id) {
  return Boolean(state.checked[id]);
}

function isCategorySelected(id) {
  return state.selectedCategories[id] !== false;
}

function matchesFilters(item) {
  if (!isCategorySelected(item.categoryId)) return false;
  const query = state.search.trim().toLowerCase();
  if (!query) return true;
  const stage = getStage(item.stageId);
  const category = getCategory(item.categoryId);
  return [item.title, item.note, item.owner, item.priority, stage.label, stage.title, category.name]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function getStagePercent(stageId) {
  const stageTasks = getAllTasks().filter((item) => item.stageId === stageId);
  if (!stageTasks.length) return 0;
  return Math.round((stageTasks.filter((item) => isDone(item.id)).length / stageTasks.length) * 100);
}

function getTimelinePosition() {
  const dueDate = parseDate(state.family.dueDate);
  if (!dueDate) {
    return {
      label: "예정일 미입력",
      caption: "상단에서 예정일을 넣거나 구간을 직접 선택하세요.",
      activeStageId: state.selectedStage || "w4-8",
    };
  }

  const today = startOfDay(new Date());
  const daysUntilDue = Math.ceil((dueDate - today) / DAY_MS);

  if (daysUntilDue >= 0) {
    const week = clamp(40 - Math.floor(daysUntilDue / 7), 1, 40);
    const activeStage = stages.find((stage) => stage.startWeek && week >= stage.startWeek && week <= stage.endWeek) || stages[0];
    return {
      label: `임신 ${week}주`,
      caption: daysUntilDue === 0 ? "오늘이 출산예정일입니다." : `출산예정일까지 D-${daysUntilDue}`,
      activeStageId: activeStage.id,
    };
  }

  const daysAfter = Math.abs(daysUntilDue);
  const monthsAfter = Math.floor(daysAfter / 30.4375);
  const dayStage = stages.find((stage) => stage.minPostpartumDay !== undefined && daysAfter >= stage.minPostpartumDay && daysAfter <= stage.maxPostpartumDay);
  const monthStage = stages.find((stage) => stage.minPostpartumMonth !== undefined && monthsAfter >= stage.minPostpartumMonth && monthsAfter <= stage.maxPostpartumMonth);
  const activeStage = dayStage || monthStage || stages[stages.length - 1];

  return {
    label: `출산 후 ${monthsAfter}개월`,
    caption: `출산예정일 기준 +${daysAfter}일`,
    activeStageId: activeStage.id,
  };
}

function parseDate(value) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return startOfDay(new Date(year, month - 1, day));
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24) || "category";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
