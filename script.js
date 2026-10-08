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

const notificationBtn =
document.querySelector(".notification-btn");

/* =====================================================
MOBILE SIDEBAR
===================================================== */

if (menuBtn && sidebar && overlay) {

menuBtn.addEventListener("click", function () {

    sidebar.classList.add("open");
    overlay.classList.add("show");

});

}

/* =====================================================
CLOSE MOBILE SIDEBAR
===================================================== */

if (overlay && sidebar) {

overlay.addEventListener("click", function () {

    sidebar.classList.remove("open");
    overlay.classList.remove("show");

});

}

/* =====================================================
CLOSE SIDEBAR FUNCTION
===================================================== */

function closeMobileSidebar() {

if (sidebar) {
    sidebar.classList.remove("open");
}

if (overlay) {
    overlay.classList.remove("show");
}

}

/* =====================================================
REAL PAGE CHECK
===================================================== */

function isRealLink(link) {

if (!link) {
    return false;
}

if (link === "#") {
    return false;
}

if (link.trim() === "") {
    return false;
}

if (link.startsWith("javascript:")) {
    return false;
}

return true;

}

/* =====================================================
SIDEBAR NAVIGATION
===================================================== */

menuItems.forEach(function (item) {

item.addEventListener("click", function (event) {

    const link =
        this.getAttribute("href");


    /*
     * REAL PAGE
     *
     * Example:
     * index.html
     * sale.html
     * purchase.html
     * inventory.html
     * customers.html
     * suppliers.html
     * finance.html
     * reports.html
     * whatsapp.html
     * ai.html
     * settings.html
     *
     * Let the browser open the page normally.
     */

    if (isRealLink(link)) {

        closeMobileSidebar();

        return;

    }


    /*
     * FUTURE MODULE
     *
     * Only "#" links come here.
     */

    event.preventDefault();


    const menuName =
        this.querySelector("span:last-child");


    if (menuName) {

        alert(
            menuName.textContent.trim() +
            " module अर्को चरणमा तयार गरिनेछ।"
        );

    }


    closeMobileSidebar();

});

});

/* =====================================================
TODAY DATE
===================================================== */

function showTodayDate() {

const dateElement =
    document.getElementById("todayDate");


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


const dateText =
    today.toLocaleDateString(
        "ne-NP",
        options
    );


dateElement.textContent =
    dateText;

}

showTodayDate();

/* =====================================================
SEARCH
===================================================== */

if (searchInput) {

searchInput.addEventListener(
    "keydown",
    function (event) {

        if (event.key !== "Enter") {
            return;
        }


        const searchValue =
            searchInput.value.trim();


        if (searchValue === "") {

            alert(
                "कृपया खोज्नको लागि केही लेख्नुहोस्।"
            );

            return;

        }


        alert(
            "Search system तयार हुँदैछ।\n\n" +
            "तपाईंले खोज्नुभएको: " +
            searchValue
        );

    }
);

}

/* =====================================================
TOP NEW SALE BUTTON
===================================================== */

if (primaryBtn) {

primaryBtn.addEventListener(
    "click",
    function (event) {

        /*
         * If the button is actually an <a>
         * with a real href, allow navigation.
         */

        const link =
            this.getAttribute("href");


        if (isRealLink(link)) {

            return;

        }


        /*
         * Current dashboard button is not linked yet.
         */

        event.preventDefault();

        alert(
            "New Sale module अर्को चरणमा तयार गरिनेछ।"
        );

    }
);

}

/* =====================================================
QUICK ACTIONS
===================================================== */

quickActions.forEach(function (action) {

action.addEventListener(
    "click",
    function (event) {

        /*
         * IMPORTANT:
         *
         * If this Quick Action has a real href,
         * do NOT show placeholder alert.
         *
         * Example:
         * purchase.html
         * inventory.html
         * customers.html
         */

        const link =
            this.getAttribute("href");


        if (isRealLink(link)) {

            return;

        }


        /*
         * Future module using "#"
         */

        event.preventDefault();


        const actionName =
            this.querySelector("strong");


        if (actionName) {

            alert(
                actionName.textContent.trim() +
                " module अर्को चरणमा तयार गरिनेछ।"
            );

        }

    }
);

});

/* =====================================================
AI ASSISTANT
===================================================== */

if (aiBtn) {

aiBtn.addEventListener(
    "click",
    function (event) {

        const link =
            this.getAttribute("href");


        /*
         * If AI page is connected,
         * allow normal navigation.
         */

        if (isRealLink(link)) {

            return;

        }


        event.preventDefault();


        alert(
            "AI Shop Assistant अर्को चरणमा तयार गरिनेछ।"
        );

    }
);

}

/* =====================================================
NOTIFICATION
===================================================== */

if (notificationBtn) {

notificationBtn.addEventListener(
    "click",
    function () {

        alert(
            "अहिले कुनै नयाँ notification छैन।"
        );

    }
);

}

/* =====================================================
ATTENTION VIEW BUTTONS
===================================================== */

const viewButtons =
document.querySelectorAll(
".attention-item button"
);

viewButtons.forEach(function (button) {

button.addEventListener(
    "click",
    function () {

        const parent =
            this.closest(".attention-item");


        if (!parent) {
            return;
        }


        const title =
            parent.querySelector("strong");


        if (title) {

            alert(
                title.textContent.trim() +
                " details अर्को चरणमा देखाइनेछ।"
            );

        }

    }
);

});

/* =====================================================
ATTENTION PAGE LINKS
===================================================== */

const attentionLinks =
document.querySelectorAll(
".attention-item a"
);

attentionLinks.forEach(function (link) {

link.addEventListener(
    "click",
    function () {

        /*
         * Real href → normal browser navigation.
         */

        const href =
            this.getAttribute("href");


        if (isRealLink(href)) {

            return;

        }

    }
);

});

/* =====================================================
SALES PERIOD
===================================================== */

const salesPeriod =
document.getElementById("salesPeriod");

if (salesPeriod) {

salesPeriod.addEventListener(
    "change",
    function () {

        alert(
            "Sales chart data system अर्को चरणमा जोडिनेछ.\n\n" +
            "Selected: " +
            this.value
        );

    }
);

}

/* =====================================================
DASHBOARD INITIAL STATE
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
