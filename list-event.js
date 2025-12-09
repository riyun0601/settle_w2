function getRoleClass(position) {
    switch (position) {
        case '매니저':
            return 'manager';
        case '직원':
            return 'employee';
        case '수습생':
            return 'trainer';
        default:
            return '';
    }
}

function createEmployeeListItem(employee) {
    const roleClass = getRoleClass(employee.position);

    return `
        <li class="employee-item" data-id="${employee.id}">
            <img class="profile-icon" src="icon/face.png" alt="프로필 아이콘" />
            <div class="info-group">
                <div class="name-badge-group">
                    <span class="employee-name">${employee.name}</span>
                    <span class="role-badge ${roleClass}">${employee.position}</span>
                </div>
            </div>
            <button class="view-details" data-id="${employee.id}">정보 보기</button>
        </li>
    `;
}

function setupViewDetailsListeners() {
    const detailButtons = document.querySelectorAll('.view-details');

    detailButtons.forEach((button) => {
        const employeeId = button.getAttribute('data-id'); 

        if (employeeId) {
            button.addEventListener('click', () => {
                const detailPagePath = '../emp_info.html'; 
                const url = `${detailPagePath}?id=${employeeId}`;

                window.location.href = url;
            });
        }
    });
}

function renderEmployeeList() {
    const employeeListContainer = document.querySelector('.employee-list');
    const listTitleSpan = document.querySelector('.list-title span');

    if (!employeeListContainer || typeof employeeData === 'undefined') {
        console.error("Employee list container or data (list.js) not found.");
        return;
    }

    employeeListContainer.innerHTML = '';

    const listHtml = employeeData.map(createEmployeeListItem).join('');
    employeeListContainer.innerHTML = listHtml;

    if (listTitleSpan) {
        listTitleSpan.textContent = employeeData.length;
    }

    setupViewDetailsListeners();
}

document.addEventListener('DOMContentLoaded', renderEmployeeList);