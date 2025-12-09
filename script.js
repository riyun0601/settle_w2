document.querySelectorAll(".bottombar .tab-item").forEach(item => {
    item.addEventListener("click", function () {
        const link = this.dataset.target;
        if (link) window.location.href = link;
    });
});