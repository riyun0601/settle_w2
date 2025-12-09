// calendar.js
$(function () {
    moment.locale("ko");

    let current = moment();
    let selectedDate = moment().format("YYYY-MM-DD");
    let employees = [];
    const extraSchedules = {}; // 날짜별 추가 근무

    // 🔥 캘린더 모드 상태
    let weekModeHeight = null;
    let calendarMode = "month";     // "month" | "week"
    let calendarMonthHeight = null; // 월간 모드 높이 저장

    // 직원 JSON 로드 후 초기 렌더
    $.getJSON("employees.json", function (data) {
        employees = data || [];
        renderCalendar();
        renderSchedule(selectedDate);
        buildWorkPopup();   // 팝업 생성
        initContentDrag();  // 🔥 모든 드래그는 content 기준

        updateCalendarViewMode(); // 초기 month 모드 반영
    });

    // ===== 달력 이전 / 다음 =====
    $("#prev-month").on("click", function () {
        const currentDate = current.format("YYYY-MM-DD");
        current = moment(currentDate).subtract(1, "month");
        renderCalendar();
        renderSchedule(selectedDate);
    });

    $("#next-month").on("click", function () {
        const currentDate = current.format("YYYY-MM-DD");
        current = moment(currentDate).add(1, "month");
        renderCalendar();
        renderSchedule(selectedDate);
    });

    // ================= 캘린더 =================
    function renderCalendar() {
        $("#month-title").text(current.format("YYYY년 MM월"));

        const grid = $("#calendar-grid");
        grid.empty();

        const currentDate   = current.format("YYYY-MM-DD");
        const monthStart    = moment(currentDate).startOf("month");
        const monthEnd      = moment(currentDate).endOf("month");
        const gridStart     = moment(monthStart.format("YYYY-MM-DD")).startOf("week");
        const gridEnd       = moment(monthEnd.format("YYYY-MM-DD")).endOf("week");
        const totalDays     = gridEnd.diff(gridStart, "days") + 1;
        const rowCount      = totalDays / 7;

        grid.css("grid-template-rows", `repeat(${rowCount}, 1fr)`);

        const todayKey        = moment().format("YYYY-MM-DD");
        const currentMonthKey = current.format("YYYY-MM");
        const gridStartKey    = gridStart.format("YYYY-MM-DD");
        const weekdayNames    = ["일", "월", "화", "수", "목", "금", "토"];

        for (let i = 0; i < totalDays; i++) {
            const day     = moment(gridStartKey).add(i, "days");
            const dateKey = day.format("YYYY-MM-DD");
            const monthKey= day.format("YYYY-MM");
            const weekKey = day.day(); // 0~6

            const cell = $("<div>")
                .addClass("calendar-day")
                .attr("date", dateKey)
                .attr("weekday", weekdayNames[weekKey])
                .html(`<span class="date-number">${day.date()}</span>`);

            if (monthKey !== currentMonthKey) {
                cell.addClass("other-month");
            }
            if (weekKey === 0) cell.addClass("sunday");
            if (weekKey === 6) cell.addClass("saturday");

            if (dateKey === todayKey) cell.addClass("today");
            if (dateKey === selectedDate) cell.addClass("selected");

            cell.on("click", function () {
                // 다른 달 누르면 달 이동
                if (cell.hasClass("other-month")) {
                    current      = moment(dateKey);
                    selectedDate = dateKey;
                    renderCalendar();
                    renderSchedule(selectedDate);
                    return;
                }
                // 같은 달이면 날짜만 변경
                selectedDate = dateKey;
                renderCalendar();
                renderSchedule(selectedDate);
            });

            grid.append(cell);
        }

        updateCalendarViewMode();
    }

    function setCalendarMode(mode) {
        if (mode !== "month" && mode !== "week") return;
        if (calendarMode === mode) return;

        calendarMode = mode;
        updateCalendarViewMode();
    }

    function updateCalendarViewMode() {
        const $container = $(".calendar-container");
        const $grid      = $("#calendar-grid");
        const $days      = $grid.find(".calendar-day");

        if (!$container.length || !$grid.length || !$days.length) return;

        // 월간 모드 높이 한번만 저장
        if (calendarMonthHeight == null) {
            calendarMonthHeight = $container.height();
        }

        // 기본 상태로 되돌리기
        $days.removeClass("week-hidden");

        if (calendarMode === "week") {
            const $selected     = $grid.find(".calendar-day.selected");
            const allDays       = $grid.find(".calendar-day");
            const selectedIndex = allDays.index($selected);
            const rowCount      = allDays.length / 7;
            const gridHeight    = $grid.height();
            const rowHeight     = gridHeight / rowCount;

            // 선택된 셀이 없으면 0번 주
            const weekIndex = selectedIndex >= 0 ? Math.floor(selectedIndex / 7) : 0;

            // 선택된 주 이외의 셀 전부 접기
            allDays.each(function (idx) {
                const r = Math.floor(idx / 7);
                if (r !== weekIndex) {
                    $(this).addClass("week-hidden");
                }
            });

            const headerH   = $(".calendar-header").outerHeight(true)   || 0;
            const weekdaysH = $(".calendar-weekdays").outerHeight(true) || 0;

            // 🔥 주간 높이는 최초 1회만 계산해서 고정
            if (weekModeHeight == null) {
                const visibleRowH = rowHeight;
                weekModeHeight = headerH + weekdaysH + visibleRowH;
            }

            $container.css("height", weekModeHeight + "px");
        } else {
            // 월간 모드
            if (calendarMonthHeight != null) {
                $container.css("height", calendarMonthHeight + "px");
            }
        }
    }

    // ================= 출근표 =================
    function renderSchedule(dateStr) {
        if (!employees.length) return;

        const weekdayNames = ["일", "월", "화", "수", "목", "금", "토"];
        const dayIndex     = moment(dateStr).day();
        const dayName      = weekdayNames[dayIndex];

        const $profile  = $(".profile");
        const $timeline = $(".timeline");
        const $grid     = $(".sheet-grid");

        $profile.empty();
        $timeline.empty();
        $grid.empty();

        let minHour = Infinity;
        let maxHour = -Infinity;

        // 직원별 오늘 인터벌 수집
        const rows = employees.map(emp => {
            const weekly = (emp.schedule || []).find(s => s.day === dayName);
            const extraForDate =
                (extraSchedules[dateStr] && extraSchedules[dateStr][emp.name]) || [];

            const intervals = [];

            if (weekly) {
                intervals.push({
                    type: "base",
                    start: weekly.start,
                    end:   weekly.end
                });
                const sh = timeToHour(weekly.start);
                const eh = timeToHour(weekly.end);
                if (sh < minHour) minHour = sh;
                if (eh > maxHour) maxHour = eh;
            }

            extraForDate.forEach(e => {
                intervals.push({
                    type: "extra",
                    start: e.start,
                    end:   e.end
                });
                const sh = timeToHour(e.start);
                const eh = timeToHour(e.end);
                if (sh < minHour) minHour = sh;
                if (eh > maxHour) maxHour = eh;
            });

            return { employee: emp, intervals };
        });

        // ====== 타임라인/그리드 시간 영역 설정 ======
        if (!isFinite(minHour) || !isFinite(maxHour)) {
            minHour = 9;
            maxHour = 18;
        }

        // 🔹 타임라인은 항상 09:00부터 시작
        minHour = 9;

        // 종료시간은 데이터 기준으로, 최소 18시, 최대 24시
        if (maxHour < 18 || !isFinite(maxHour)) {
            maxHour = 18;
        }
        maxHour = Math.min(24, Math.ceil(maxHour));

        const totalCols = maxHour - minHour; // 1시간 단위
        const hourWidth = 32;               // 1시간당 가로 간격

        // ---- 왼쪽 직원 프로필 ----
        const rowHeight = 64;

        rows.forEach(row => {
            const emp  = row.employee;
            const $row = $("<div>").addClass("profile-row");

            const $avatar = $("<div>")
                .addClass("profile-avatar")
                .text(emp.name.charAt(0));

            const $name = $("<div>")
                .addClass("profile-name")
                .text(emp.name);

            $row.append($avatar, $name);
            $profile.append($row);
        });

        // ---- 상단 타임라인 (09:00부터) ----
        $timeline
            .css("display", "grid")
            .css("grid-template-columns", `repeat(${totalCols}, ${hourWidth}px)`);

        for (let i = 0; i < totalCols; i++) {
            const $cell = $("<div>").addClass("timeline-cell");
            const hour  = minHour + i; // 09, 10, 11 ...
            const label = String(hour).padStart(2, "0") + ":00";
            $cell.text(label);
            $timeline.append($cell);
        }

        // ---- 시트 그리드 (1시간 단위 셀) ----
        const rowCount = rows.length || 1;

        $grid
            .css("display", "grid")
            .css("grid-template-columns", `repeat(${totalCols}, 32px)`)
            .css("grid-template-rows", `repeat(${rowCount}, ${rowHeight}px)`);

        rows.forEach(row => {
            const slotType = new Array(totalCols).fill(0); // 0:없음, 1:기본, 2:추가

            row.intervals.forEach(interval => {
                const startHour = timeToHour(interval.start);
                const endHour   = timeToHour(interval.end);

                const startIdx = Math.max(0, Math.floor(startHour - minHour));
                const endIdx   = Math.min(totalCols, Math.ceil(endHour - minHour));
                const typeNum  = interval.type === "extra" ? 2 : 1;

                for (let i = startIdx; i < endIdx; i++) {
                    if (typeNum === 2 || slotType[i] === 0) {
                        slotType[i] = typeNum;
                    }
                }
            });

            for (let i = 0; i < totalCols; i++) {
                const $cell = $("<div>").addClass("sheet-cell");

                $cell.addClass("hour-line");

                if (slotType[i] === 1) $cell.addClass("work-normal");
                if (slotType[i] === 2) $cell.addClass("work-added");

                $grid.append($cell);
            }
        });
    }

    function timeToHour(timeStr) {
        const [h, m] = timeStr.split(":").map(Number);
        return h + m / 60;
    }

    // =============== "13:10" 직입력용 헬퍼 ===============
    function normalizeTimeString(raw) {
        if (!raw) return null;
        raw = raw.trim();

        // 숫자+콜론 아닌 건 제거
        raw = raw.replace(/[^\d:]/g, "");

        // 콜론 없으면 HHMM 형태로 처리
        if (!raw.includes(":")) {
            if (raw.length <= 2) {
                // "9" -> "9:0" (임시)
                raw = raw + ":0";
            } else {
                const h = raw.slice(0, raw.length - 2);
                const m = raw.slice(-2);
                raw = h + ":" + m;
            }
        }

        const match = raw.match(/^(\d{1,2}):(\d{1,2})$/);
        if (!match) return null;

        let h = parseInt(match[1], 10);
        let m = parseInt(match[2], 10);

        if (isNaN(h) || isNaN(m)) return null;
        // 시: 0~24, 분: 0~59
        if (h < 0 || h > 24) return null;
        if (m < 0 || m > 59) return null;
        // 24:00만 허용, 24:xx는 불가
        if (h === 24 && m !== 0) return null;

        const hh = String(h).padStart(2, "0");
        const mm = String(m).padStart(2, "0");
        return `${hh}:${mm}`;
    }

    function attachTimeInputBehaviour($input) {
        // 입력 중: 숫자/콜론만 허용, 길이 제한
        $input.on("input", function () {
            let v = $(this).val();
            v = v.replace(/[^\d:]/g, "");

            const colonIndex = v.indexOf(":");
            if (colonIndex !== -1) {
                const before = v.slice(0, colonIndex + 1);
                const after  = v.slice(colonIndex + 1).replace(/:/g, "");
                v = before + after;
            }

            if (v.length > 5) v = v.slice(0, 5);
            $(this).val(v);
        });

        // 포커스 아웃 시 "HH:MM" 형식으로 정규화
        $input.on("blur", function () {
            const normalized = normalizeTimeString($(this).val());
            if (normalized) {
                $(this).val(normalized);
            }
        });
    }

    // ================= 근무 추가 팝업 (텍스트 입력 버전) =================
    function buildWorkPopup() {
        const $phone = $(".phone");
        if (!$phone.length) return;

        const popupHtml = `
        <div class="work-overlay hidden">
            <div class="work-popup">
                <h2 class="work-popup-title">근무 추가</h2>

                <div class="work-popup-row">
                    <label for="work-employee">직원</label>
                    <select id="work-employee"></select>
                </div>

                <div class="work-time-row" style="margin-top:12px; display:flex; gap:12px;">
                    <div class="time-field" style="flex:1; display:flex; flex-direction:column;">
                        <label for="work-start-time">시작 시간</label>
                        <input
                            id="work-start-time"
                            class="time-input"
                            type="text"
                            inputmode="numeric"
                            placeholder="예: 09:00 또는 930"
                        />
                    </div>
                    <div class="time-field" style="flex:1; display:flex; flex-direction:column;">
                        <label for="work-end-time">종료 시간</label>
                        <input
                            id="work-end-time"
                            class="time-input"
                            type="text"
                            inputmode="numeric"
                            placeholder="예: 18:30"
                        />
                    </div>
                </div>

                <div class="work-popup-buttons">
                    <button type="button" class="btn-popup-cancel">취소</button>
                    <button type="button" class="btn-popup-confirm">확인</button>
                </div>
            </div>
        </div>`;

        $phone.append(popupHtml);

        // 직원 셀렉트 채우기
        const $empSelect = $("#work-employee");
        employees.forEach(emp => {
            $("<option>").val(emp.name).text(emp.name).appendTo($empSelect);
        });

        const $startInput = $("#work-start-time");
        const $endInput   = $("#work-end-time");

        attachTimeInputBehaviour($startInput);
        attachTimeInputBehaviour($endInput);

        // 기본값: 시작 09:00, 종료 18:00
        $startInput.val("09:00");
        $endInput.val("18:00");

        // 팝업 열기
        $(".work-create").on("click", function () {
            $(".work-overlay").removeClass("hidden");
        });

        // 취소
        $(document).on("click", ".btn-popup-cancel", function () {
            $(".work-overlay").addClass("hidden");
        });

        // 확인 → extraSchedules에 저장 후 리렌더
        $(document).on("click", ".btn-popup-confirm", function () {
            const name = $("#work-employee").val();
            if (!name) return;

            const startRaw = $("#work-start-time").val();
            const endRaw   = $("#work-end-time").val();

            const start24 = normalizeTimeString(startRaw);
            const end24   = normalizeTimeString(endRaw);

            if (!start24 || !end24) {
                alert("시간 형식이 올바르지 않습니다.\n예: 09:00, 930, 21:30");
                return;
            }

            if (start24 >= end24) {
                alert("종료 시간은 시작 시간보다 늦어야 합니다.");
                return;
            }

            if (!extraSchedules[selectedDate]) extraSchedules[selectedDate] = {};
            if (!extraSchedules[selectedDate][name]) {
                extraSchedules[selectedDate][name] = [];
            }
            extraSchedules[selectedDate][name].push({ start: start24, end: end24 });

            $(".work-overlay").addClass("hidden");
            renderSchedule(selectedDate);
        });
    }

    // ================= content 기준 드래그 제스처 =================
    function initContentDrag() {
        const $content = $(".content");
        const $sheet   = $(".sheet-container");

        let isDragging      = false;
        let startX          = 0;
        let startY          = 0;
        let startScrollX    = 0;
        let startScrollY    = 0;
        let dragDirection   = null;   // "h" | "v"

        function getPos(e) {
            if (e.originalEvent && e.originalEvent.touches && e.originalEvent.touches[0]) {
                return {
                    x: e.originalEvent.touches[0].pageX,
                    y: e.originalEvent.touches[0].pageY
                };
            }
            return { x: e.pageX, y: e.pageY };
        }

        $content.on("wheel", function (e) {
            e.preventDefault();
        });

        $content.on("mousedown touchstart", function (e) {
            if ($(e.target).closest(".work-popup, .work-overlay, input, select, textarea").length) {
                return;
            }

            const pos = getPos(e);

            isDragging      = true;
            startX          = pos.x;
            startY          = pos.y;
            startScrollX    = $sheet[0].scrollLeft;
            startScrollY    = $sheet[0].scrollTop;
            dragDirection   = null;

            $(".worksheet").addClass("dragging");
        });

        $(window).on("mouseup touchend touchcancel", function () {
            isDragging     = false;
            dragDirection  = null;
            $(".worksheet").removeClass("dragging");
        });

        $content.on("mousemove touchmove", function (e) {
            if (!isDragging) return;

            const pos = getPos(e);
            const dx  = pos.x - startX;
            const dy  = pos.y - startY;

            if (!dragDirection && Math.abs(dx) < 5 && Math.abs(dy) < 5) {
                return;
            }

            if (!dragDirection) {
                dragDirection = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
            }

            e.preventDefault();

            if (dragDirection === "h") {
                $sheet[0].scrollLeft = startScrollX - dx;
                return;
            }

            if (calendarMode === "month") {
                if (dy < -40) {
                    setCalendarMode("week");
                    isDragging    = false;
                    dragDirection = null;
                    $(".worksheet").removeClass("dragging");
                }
                return;
            }

            if (calendarMode === "week") {
                const isDraggingDown = dy > 0;
                const sheetAtTop     = ($sheet[0].scrollTop <= 0);

                if (sheetAtTop && isDraggingDown) {
                    if (dy > 40) {
                        setCalendarMode("month");
                        isDragging    = false;
                        dragDirection = null;
                        $(".worksheet").removeClass("dragging");
                    }
                    return;
                }

                const newScrollY = Math.max(0, startScrollY - dy);
                $sheet[0].scrollTop = newScrollY;
            }
        });
    }
});