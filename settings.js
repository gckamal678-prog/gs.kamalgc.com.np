const SETTINGS_KEY = "gs_settings";

const DATA_KEYS = [
    "gs_products",
    "gs_purchases",
    "gs_sales",
    "gs_customers",
    "gs_suppliers",
    "gs_finance",
    "gs_settings"
];


const storeName = document.getElementById("storeName");
const ownerName = document.getElementById("ownerName");
const storePhone = document.getElementById("storePhone");
const storeEmail = document.getElementById("storeEmail");
const storeAddress = document.getElementById("storeAddress");
const taxType = document.getElementById("taxType");
const taxNumber = document.getElementById("taxNumber");

const currency = document.getElementById("currency");
const dateFormat = document.getElementById("dateFormat");
const invoicePrefix = document.getElementById("invoicePrefix");
const purchasePrefix = document.getElementById("purchasePrefix");

const saveProfileBtn = document.getElementById("saveProfileBtn");
const saveSystemBtn = document.getElementById("saveSystemBtn");

const exportBtn = document.getElementById("exportBtn");
const restoreFile = document.getElementById("restoreFile");
const restoreBtn = document.getElementById("restoreBtn");
const clearDataBtn = document.getElementById("clearDataBtn");

const profileStatus = document.getElementById("profileStatus");
const systemStatus = document.getElementById("systemStatus");
const backupStatus = document.getElementById("backupStatus");


function getSettings() {

    try {

        return JSON.parse(
            localStorage.getItem(SETTINGS_KEY)
        ) || {};

    } catch (error) {

        return {};

    }

}


function showStatus(element, message, type) {

    element.textContent = message;

    element.className =
        "status " + type;

}


function loadSettings() {

    const settings = getSettings();


    storeName.value =
        settings.storeName || "";

    ownerName.value =
        settings.ownerName || "";

    storePhone.value =
        settings.storePhone || "";

    storeEmail.value =
        settings.storeEmail || "";

    storeAddress.value =
        settings.storeAddress || "";

    taxType.value =
        settings.taxType || "NON_TAX";

    taxNumber.value =
        settings.taxNumber || "";


    currency.value =
        settings.currency || "NPR";

    dateFormat.value =
        settings.dateFormat || "YYYY-MM-DD";

    invoicePrefix.value =
        settings.invoicePrefix || "INV";

    purchasePrefix.value =
        settings.purchasePrefix || "PUR";

}


function saveProfile() {

    const oldSettings = getSettings();


    const settings = {

        ...oldSettings,

        storeName:
            storeName.value.trim(),

        ownerName:
            ownerName.value.trim(),

        storePhone:
            storePhone.value.trim(),

        storeEmail:
            storeEmail.value.trim(),

        storeAddress:
            storeAddress.value.trim(),

        taxType:
            taxType.value,

        taxNumber:
            taxNumber.value.trim()

    };


    localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify(settings)
    );


    showStatus(
        profileStatus,
        "Store Profile save भयो।",
        "success"
    );

}


function saveSystem() {

    const oldSettings = getSettings();


    const settings = {

        ...oldSettings,

        currency:
            currency.value,

        dateFormat:
            dateFormat.value,

        invoicePrefix:
            invoicePrefix.value.trim() || "INV",

        purchasePrefix:
            purchasePrefix.value.trim() || "PUR"

    };


    localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify(settings)
    );


    showStatus(
        systemStatus,
        "System Settings save भयो।",
        "success"
    );

}


function collectBackupData() {

    const backup = {

        app:
            "General Store Management System",

        version:
            "1.0",

        exportedAt:
            new Date().toISOString(),

        data: {}

    };


    DATA_KEYS.forEach(key => {

        const value =
            localStorage.getItem(key);

        if (value !== null) {

            try {

                backup.data[key] =
                    JSON.parse(value);

            } catch (error) {

                backup.data[key] =
                    value;

            }

        } else {

            backup.data[key] = [];

        }

    });


    return backup;

}


function exportBackup() {

    const backup =
        collectBackupData();


    const json =
        JSON.stringify(
            backup,
            null,
            2
        );


    const blob =
        new Blob(
            [json],
            {
                type:
                    "application/json"
            }
        );


    const url =
        URL.createObjectURL(blob);


    const link =
        document.createElement("a");


    const date =
        new Date()
            .toISOString()
            .slice(0, 10);


    link.href = url;

    link.download =
        `general-store-backup-${date}.json`;


    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);


    showStatus(
        backupStatus,
        "Backup file download भयो।",
        "success"
    );

}


function restoreBackup() {

    const file =
        restoreFile.files[0];


    if (!file) {

        showStatus(
            backupStatus,
            "पहिले JSON backup file छान्नुहोस्।",
            "error"
        );

        return;
    }


    if (
        !confirm(
            "Backup restore गर्दा हालको data replace हुन सक्छ। Continue?"
        )
    ) {
        return;
    }


    const reader =
        new FileReader();


    reader.onload =
        function(event) {

            try {

                const backup =
                    JSON.parse(
                        event.target.result
                    );


                if (
                    !backup ||
                    !backup.data
                ) {

                    throw new Error(
                        "Invalid backup"
                    );

                }


                DATA_KEYS.forEach(key => {

                    if (
                        Object.prototype.hasOwnProperty.call(
                            backup.data,
                            key
                        )
                    ) {

                        localStorage.setItem(
                            key,
                            JSON.stringify(
                                backup.data[key]
                            )
                        );

                    }

                });


                loadSettings();


                showStatus(
                    backupStatus,
                    "Backup restore भयो। Page refresh गर्नुहोस्।",
                    "success"
                );


            } catch (error) {

                showStatus(
                    backupStatus,
                    "Backup file valid छैन।",
                    "error"
                );

            }

        };


    reader.readAsText(file);

}


function clearAllData() {

    const firstConfirm =
        confirm(
            "सबै store data हटाउने हो?"
        );


    if (!firstConfirm) {
        return;
    }


    const secondConfirm =
        confirm(
            "यो काम Undo गर्न सकिँदैन। पहिले Backup लिएको छ?"
        );


    if (!secondConfirm) {
        return;
    }


    DATA_KEYS.forEach(key => {

        localStorage.removeItem(key);

    });


    loadSettings();


    showStatus(
        backupStatus,
        "सबै store data हटाइयो।",
        "success"
    );

}


saveProfileBtn.addEventListener(
    "click",
    saveProfile
);


saveSystemBtn.addEventListener(
    "click",
    saveSystem
);


exportBtn.addEventListener(
    "click",
    exportBackup
);


restoreBtn.addEventListener(
    "click",
    restoreBackup
);


clearDataBtn.addEventListener(
    "click",
    clearAllData
);


loadSettings();
