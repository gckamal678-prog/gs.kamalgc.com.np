/* =====================================================
   GENERAL STORE MANAGEMENT SYSTEM
   Dashboard JavaScript
   ===================================================== */


/* =====================================================
   ELEMENTS
   ===================================================== */

const sidebar = document.getElementById("sidebar");
const menuBtn = document.getElementById("menuBtn");
const overlay = document.getElementById("overlay");

const searchInput = document.getElementById("searchInput");

const menuItems = document.querySelectorAll(".menu-item");
const quickActions = document.querySelectorAll(".quick-action");

const primaryBtn = document.querySelector(".primary-btn");
const aiBtn = document.querySelector(".ai-btn");
const notificationBtn = document.querySelector(".notification-btn");


/* =====================================================
   MOBILE SIDEBAR
   ===================================================== */

if (menuBtn) {

    menuBtn.addEventListener("click", function () {

        sidebar.classList.add("open");

        overlay.classList.add("show");

    });

}


if (overlay) {

    overlay.addEventListener("click", function () {

        sidebar.classList.remove("open");

        overlay.classList.remove("show");

    });

}


/* =====================================================
   CLOSE SIDEBAR AFTER MENU CLICK
   ===================================================== */

menuItems.forEach(function (item) {

    item.addEventListener("click", function () {

        menuItems.forEach(function (menu) {
            menu.classList.remove("active");
        });

        this.classList.add("active");

        sidebar.classList.remove("open");

        overlay.classList.remove("show");

    });

});


/* =====================================================
   TODAY DATE
   ===================================================== */

function showTodayDate() {

    const dateElement = document.getElementById("todayDate");

    if (!dateElement) {
        return;
    }

    const today = new Date();

    const options = {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
    };

    const dateText = today.toLocaleDateString(
        "ne-NP",
        options
    );

    dateElement.textContent = dateText;

}

showTodayDate();


/* =====================================================
   SEARCH
   ===================================================== */

if (searchInput) {

    searchInput.addEventListener("keydown", function (event) {

        if (event.key === "Enter") {

            const searchValue =
                searchInput.value.trim();

            if (searchValue === "") {

                alert("कृपया खोज्नको लागि केही लेख्नुहोस्।");

                return;

            }

            alert(
                "Search system तयार हुँदैछ।\n\n" +
                "तपाईंले खोज्नुभएको: " +
                searchValue
            );

        }

    });

}


/* =====================================================
   NEW SALE BUTTON
   ===================================================== */

if (primaryBtn) {

    primaryBtn.addEventListener("click", function () {

        alert(
            "New Sale module अर्को चरणमा तयार गरिनेछ।"
        );

    });

}


/* =====================================================
   QUICK ACTIONS
   ===================================================== */

quickActions.forEach(function (button) {

    button.addEventListener("click", function () {

        const actionName =
            this.querySelector("strong");

        if (actionName) {

            alert(
                actionName.textContent +
                " module अर्को चरणमा तयार गरिनेछ।"
            );

        }

    });

});


/* =====================================================
   AI ASSISTANT
   ===================================================== */

if (aiBtn) {

    aiBtn.addEventListener("click", function () {

        alert(
            "AI Shop Assistant अर्को चरणमा तयार गरिनेछ।"
        );

    });

}


/* =====================================================
   NOTIFICATION
   ===================================================== */

if (notificationBtn) {

    notificationBtn.addEventListener("click", function () {

        alert(
            "अहिले कुनै नयाँ notification छैन।"
        );

    });

}


/* =====================================================
   VIEW BUTTONS
   ===================================================== */

const viewButtons =
    document.querySelectorAll(
        ".attention-item button"
    );


viewButtons.forEach(function (button) {

    button.addEventListener("click", function () {

        const parent =
            this.closest(".attention-item");

        if (!parent) {
            return;
        }

        const title =
            parent.querySelector("strong");

        if (title) {

            alert(
                title.textContent +
                " details अर्को चरणमा देखाइनेछ।"
            );

        }

    });

});


/* =====================================================
   SALES PERIOD
   ===================================================== */

const salesPeriod =
    document.getElementById("salesPeriod");


if (salesPeriod) {

    salesPeriod.addEventListener("change", function () {

        alert(
            "Sales chart data system अर्को चरणमा जोडिनेछ।\n\n" +
            "Selected: " +
            this.value
        );

    });

}


/* =====================================================
   INITIAL DASHBOARD STATE
   ===================================================== */

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

        const element =
            document.getElementById(id);

        if (element) {
            element.textContent = "0";
        }

    });

}


initializeDashboard();


/* =====================================================
   CONSOLE MESSAGE
   ===================================================== */

console.log(
    "General Store Management System loaded successfully."
);
