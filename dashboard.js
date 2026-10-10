
/* =====================================================
   GENERAL STORE MANAGEMENT SYSTEM
   Dashboard JavaScript
   ===================================================== */

(function () {
    "use strict";

    const sidebar = document.getElementById("sidebar");
    const menuBtn = document.getElementById("menuBtn");
    const overlay = document.getElementById("overlay");
    const searchInput = document.getElementById("searchInput");

    const menuItems = document.querySelectorAll(".menu-item");
    const quickActions = document.querySelectorAll(".quick-action");

    const primaryBtn = document.querySelector(".primary-btn");
    const aiBtn = document.querySelector(".ai-btn");
    const notificationBtn = document.querySelector(".notification-btn");

    /* MOBILE SIDEBAR */

    function openMobileSidebar() {
        if (sidebar) sidebar.classList.add("open");
        if (overlay) overlay.classList.add("show");
    }

    function closeMobileSidebar() {
        if (sidebar) sidebar.classList.remove("open");
        if (overlay) overlay.classList.remove("show");
    }

    if (menuBtn && sidebar && overlay) {
        menuBtn.addEventListener("click", openMobileSidebar);
    }

    if (overlay) {
        overlay.addEventListener("click", closeMobileSidebar);
    }

    /* NAVIGATION HELPERS */

    function isRealLink(link) {
        if (!link) return false;

        const trimmed = link.trim();

        return (
            trimmed !== "" &&
            trimmed !== "#" &&
            !trimmed.startsWith("#") &&
            !trimmed.toLowerCase().startsWith("javascript:")
        );
    }

    /* SIDEBAR NAVIGATION */

    menuItems.forEach(function (item) {
        item.addEventListener("click", function (event) {
            const link = this.getAttribute("href");

            if (isRealLink(link)) {
                closeMobileSidebar();
                return;
            }

            event.preventDefault();

            const menuName = this.querySelector("span:last-child");

            if (menuName) {
                alert(
                    menuName.textContent.trim() +
                    " module अर्को चरणमा तयार गरिनेछ।"
                );
            }

            closeMobileSidebar();
        });
    });

    /* TODAY'S DATE */

    function showTodayDate() {
        const dateElement = document.getElementById("todayDate");

        if (!dateElement) return;

        const today = new Date();

        dateElement.textContent = today.toLocaleDateString("ne-NP", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
        });
    }

    showTodayDate();

    /* SEARCH */

    if (searchInput) {
        searchInput.addEventListener("keydown", function (event) {
            if (event.key !== "Enter") return;

            const searchValue = searchInput.value.trim();

            if (!searchValue) {
                alert("कृपया खोज्नको लागि केही लेख्नुहोस्।");
                return;
            }

            alert(
                "Search system तयार हुँदैछ।\n\n" +
                "तपाईंले खोज्नुभएको: " +
                searchValue
            );
        });
    }

    /* NEW SALE BUTTON */

    if (primaryBtn) {
        primaryBtn.addEventListener("click", function (event) {
            const link = this.getAttribute("href");

            if (isRealLink(link)) return;

            event.preventDefault();
            alert("New Sale module अर्को चरणमा तयार गरिनेछ।");
        });
    }

    /* QUICK ACTIONS */

    quickActions.forEach(function (action) {
        action.addEventListener("click", function (event) {
            const link = this.getAttribute("href");

            if (isRealLink(link)) return;

            event.preventDefault();

            const actionName = this.querySelector("strong");

            if (actionName) {
                alert(
                    actionName.textContent.trim() +
                    " module अर्को चरणमा तयार गरिनेछ।"
                );
            }
        });
    });

    /* AI ASSISTANT */

    if (aiBtn) {
        aiBtn.addEventListener("click", function (event) {
            const link = this.getAttribute("href");

            if (isRealLink(link)) return;

            event.preventDefault();
            alert("AI Shop Assistant अर्को चरणमा तयार गरिनेछ।");
        });
    }

    /* NOTIFICATIONS */

    if (notificationBtn) {
        notificationBtn.addEventListener("click", function () {
            alert("अहिले कुनै नयाँ notification छैन।");
        });
    }

    /* ATTENTION VIEW BUTTONS */

    document.querySelectorAll(".attention-item button").forEach(
        function (button) {
            button.addEventListener("click", function () {
                const parent = this.closest(".attention-item");
                if (!parent) return;

                const title = parent.querySelector("strong");

                if (title) {
                    alert(
                        title.textContent.trim() +
                        " details अर्को चरणमा देखाइनेछ।"
                    );
                }
            });
        }
    );

    /* ATTENTION LINKS */

    document.querySelectorAll(".attention-item a").forEach(
        function (link) {
            link.addEventListener("click", function (event) {
                const href = this.getAttribute("href");

                if (isRealLink(href)) return;

                event.preventDefault();
            });
        }
    );

    /* SALES PERIOD */

    const salesPeriod = document.getElementById("salesPeriod");

    if (salesPeriod) {
        salesPeriod.addEventListener("change", function () {
            alert(
                "Sales chart data system अर्को चरणमा जोडिनेछ.\n\n" +
                "Selected: " +
                this.value
            );
        });
    }

    /* DASHBOARD INITIAL STATE */

    function initializeDashboard() {
        const values = [
            "todaySales",
            "grossProfit",
            "expenses",
            "netProfit",
            "customerReceivable",
            "supplierPayable",
            "stockValue",
            "availableBalance"
        ];

        values.forEach(function (id) {
            const element = document.getElementById(id);

            if (element) {
                element.textContent = "0";
            }
        });
    }

    initializeDashboard();

    /* DASHBOARD LOCK BUTTON
       Actual MPIN verification is not implemented here.
       Do not treat this as a security lock. */

    const lockBtn = document.getElementById("lockBtn");

    if (lockBtn) {
        lockBtn.addEventListener("click", function () {
            alert(
                "Dashboard MPIN lock सुविधा Settings सँग जोडेर " +
                "अर्को चरणमा सक्रिय गरिनेछ।"
            );
        });
    }

    console.log(
        "General Store Management System dashboard loaded."
    );
})();
