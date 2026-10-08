/* =====================================================
   GENERAL STORE MANAGEMENT SYSTEM
   INVENTORY MODULE
   ===================================================== */

const PRODUCT_KEY = "gs_products";


/* =====================================================
   DOM ELEMENTS
   ===================================================== */

const addProductBtn = document.getElementById("addProductBtn");

const productModal = document.getElementById("productModal");

const closeProductModal =
    document.getElementById("closeProductModal");

const cancelProductBtn =
    document.getElementById("cancelProductBtn");

const productForm =
    document.getElementById("productForm");


const productSearch =
    document.getElementById("productSearch");

const inventorySearch =
    document.getElementById("inventorySearch");


const categoryFilter =
    document.getElementById("categoryFilter");

const stockFilter =
    document.getElementById("stockFilter");


const productTableBody =
    document.getElementById("productTableBody");

const totalProducts =
    document.getElementById("totalProducts");

const inStockProducts =
    document.getElementById("inStockProducts");

const lowStockProducts =
    document.getElementById("lowStockProducts");

const stockValue =
    document.getElementById("stockValue");

const inventoryMenuBtn =
    document.getElementById("inventoryMenuBtn");


/* =====================================================
   GET PRODUCTS
   ===================================================== */

function getProducts() {

    try {

        const data =
            localStorage.getItem(PRODUCT_KEY);

        if (!data) {
            return [];
        }

        const products = JSON.parse(data);

        return Array.isArray(products)
            ? products
            : [];

    } catch (error) {

        console.error(
            "Product data read error:",
            error
        );

        return [];
    }
}


/* =====================================================
   SAVE PRODUCTS
   ===================================================== */

function saveProducts(products) {

    try {

        localStorage.setItem(
            PRODUCT_KEY,
            JSON.stringify(products)
        );

        return true;

    } catch (error) {

        console.error(
            "Product save error:",
            error
        );

        alert(
            "Product save हुन सकेन। Browser storage check गर्नुहोस्।"
        );

        return false;
    }
}


/* =====================================================
   FORMAT MONEY
   ===================================================== */

function formatMoney(value) {

    const number = Number(value) || 0;

    return number.toLocaleString(
        "en-IN",
        {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    );
}


/* =====================================================
   STOCK STATUS
   ===================================================== */

function getStockStatus(product) {

    const stock = Number(product.stock) || 0;

    const minStock =
        Number(product.minStock) || 0;


    if (stock <= 0) {

        return {
            key: "out",
            label: "Out of Stock"
        };

    }


    if (stock <= minStock) {

        return {
            key: "low",
            label: "Low Stock"
        };

    }


    return {
        key: "in",
        label: "In Stock"
    };
}


/* =====================================================
   UPDATE SUMMARY
   ===================================================== */

function updateSummary(products) {

    const total =
        products.length;


    let inStock = 0;

    let lowStock = 0;

    let value = 0;


    products.forEach(function (product) {

        const stock =
            Number(product.stock) || 0;

        const purchasePrice =
            Number(product.purchasePrice) || 0;


        const status =
            getStockStatus(product);


        if (status.key === "in") {
            inStock++;
        }


        if (status.key === "low") {
            lowStock++;
        }


        value +=
            stock * purchasePrice;

    });


    if (totalProducts) {
        totalProducts.textContent = total;
    }


    if (inStockProducts) {
        inStockProducts.textContent = inStock;
    }


    if (lowStockProducts) {
        lowStockProducts.textContent = lowStock;
    }


    if (stockValue) {
        stockValue.textContent =
            formatMoney(value);
    }

}


/* =====================================================
   ESCAPE HTML
   ===================================================== */

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =====================================================
   RENDER PRODUCTS
   ===================================================== */

function renderProducts() {

    if (!productTableBody) {
        return;
    }


    const allProducts =
        getProducts();


    updateSummary(allProducts);


    const searchValue =
        (
            productSearch?.value ||
            inventorySearch?.value ||
            ""
        )
        .trim()
        .toLowerCase();


    const categoryValue =
        categoryFilter?.value || "";


    const stockValueFilter =
        stockFilter?.value || "";


    const filteredProducts =
        allProducts.filter(function (product) {


            /* SEARCH */

            const searchableText = [

                product.name,
                product.brand,
                product.category,
                product.size,
                product.unit

            ]
                .join(" ")
                .toLowerCase();


            if (
                searchValue &&
                !searchableText.includes(searchValue)
            ) {

                return false;

            }


            /* CATEGORY */

            if (
                categoryValue &&
                product.category !== categoryValue
            ) {

                return false;

            }


            /* STOCK */

            if (stockValueFilter) {

                const status =
                    getStockStatus(product);

                if (
                    status.key !==
                    stockValueFilter
                ) {

                    return false;

                }

            }


            return true;

        });


    /* EMPTY */

    if (filteredProducts.length === 0) {

        productTableBody.innerHTML = `

            <tr>

                <td
                    colspan="8"
                    class="empty-inventory"
                >

                    <div>📦</div>

                    <strong>
                        ${
                            allProducts.length === 0
                                ? "अहिलेसम्म Product छैन"
                                : "Product भेटिएन"
                        }
                    </strong>

                    <span>
                        ${
                            allProducts.length === 0
                                ? 'सुरु गर्न "Add Product" थिच्नुहोस्।'
                                : "Search वा filter परिवर्तन गर्नुहोस्।"
                        }
                    </span>

                </td>

            </tr>

        `;

        return;
    }


    /* TABLE ROWS */

    productTableBody.innerHTML =
        filteredProducts
            .map(function (product) {

                const status =
                    getStockStatus(product);


                const stock =
                    Number(product.stock) || 0;


                const purchasePrice =
                    Number(product.purchasePrice) || 0;


                const salePrice =
                    Number(product.salePrice) || 0;


                return `

                    <tr>

                        <td>

                            <div class="product-name-cell">

                                <strong>
                                    ${escapeHTML(product.name)}
                                </strong>

                                ${
                                    product.brand
                                        ? `<small>${escapeHTML(product.brand)}</small>`
                                        : ""
                                }

                            </div>

                        </td>


                        <td>
                            ${escapeHTML(product.category)}
                        </td>


                        <td>

                            ${escapeHTML(product.unit)}

                            ${
                                product.size
                                    ? `<small> / ${escapeHTML(product.size)}</small>`
                                    : ""
                            }

                        </td>


                        <td>
                            Rs. ${formatMoney(purchasePrice)}
                        </td>


                        <td>
                            Rs. ${formatMoney(salePrice)}
                        </td>


                        <td>
                            ${stock}
                        </td>


                        <td>

                            <span
                                class="stock-status ${status.key}"
                            >
                                ${status.label}
                            </span>

                        </td>


                        <td>

                            <button
                                type="button"
                                class="table-action-btn"
                                onclick="viewProduct('${product.id}')"
                            >
                                View
                            </button>

                        </td>

                    </tr>

                `;

            })
            .join("");

}


/* =====================================================
   OPEN MODAL
   ===================================================== */

function openProductModal() {

    if (!productModal) {
        return;
    }


    productModal.classList.add("show");


    setTimeout(function () {

        const nameInput =
            document.getElementById("productName");

        if (nameInput) {
            nameInput.focus();
        }

    }, 100);

}


/* =====================================================
   CLOSE MODAL
   ===================================================== */

function closeProductModalFunc() {

    if (!productModal) {
        return;
    }


    productModal.classList.remove("show");


    if (productForm) {
        productForm.reset();
    }

}


/* =====================================================
   ADD PRODUCT
   ===================================================== */

function addProduct(event) {

    event.preventDefault();


    /* GET FORM VALUES */

    const name =
        document
            .getElementById("productName")
            .value
            .trim();


    const category =
        document
            .getElementById("productCategory")
            .value;


    const brand =
        document
            .getElementById("productBrand")
            .value
            .trim();


    const size =
        document
            .getElementById("productSize")
            .value
            .trim();


    const unit =
        document
            .getElementById("productUnit")
            .value;


    const purchasePrice =
        Number(
            document
                .getElementById("purchasePrice")
                .value
        );


    const salePrice =
        Number(
            document
                .getElementById("salePrice")
                .value
        );


    const minStock =
        Number(
            document
                .getElementById("minStock")
                .value
        ) || 0;


    const targetStock =
        Number(
            document
                .getElementById("targetStock")
                .value
        ) || 0;


    const expiryApplicable =
        document
            .getElementById("expiryApplicable")
            .checked;


    /* VALIDATION */

    if (!name) {

        alert(
            "Product Name राख्नुहोस्।"
        );

        return;
    }


    if (!unit) {

        alert(
            "Unit select गर्नुहोस्।"
        );

        return;
    }


    if (
        Number.isNaN(purchasePrice) ||
        purchasePrice < 0
    ) {

        alert(
            "Purchase Price सही राख्नुहोस्।"
        );

        return;
    }


    if (
        Number.isNaN(salePrice) ||
        salePrice < 0
    ) {

        alert(
            "Sale Price सही राख्नुहोस्।"
        );

        return;
    }


    /* PRODUCT OBJECT */

    const product = {

        id:
            "P-" +
            Date.now() +
            "-" +
            Math.floor(
                Math.random() * 10000
            ),

        name: name,

        category:
            category || "Other",

        brand: brand,

        size: size,

        unit: unit,

        purchasePrice:
            purchasePrice,

        salePrice:
            salePrice,

        minStock:
            minStock,

        targetStock:
            targetStock,

        expiryApplicable:
            expiryApplicable,

        /*
         * New product को stock
         * Purchase module आएसम्म 0 रहनेछ।
         */

        stock: 0,

        active: true,

        createdAt:
            new Date().toISOString()

    };


    /* GET EXISTING PRODUCTS */

    const products =
        getProducts();


    /* ADD */

    products.push(product);


    /* SAVE */

    const saved =
        saveProducts(products);


    if (!saved) {
        return;
    }


    /* CLOSE MODAL */

    closeProductModalFunc();


    /* REFRESH TABLE */

    renderProducts();


    /* SUCCESS */

    alert(
        "Product successfully save भयो।"
    );


    console.log(
        "Product saved:",
        product
    );

}


/* =====================================================
   VIEW PRODUCT
   ===================================================== */

function viewProduct(productId) {

    const products =
        getProducts();


    const product =
        products.find(function (item) {

            return item.id === productId;

        });


    if (!product) {

        alert(
            "Product भेटिएन।"
        );

        return;
    }


    const status =
        getStockStatus(product);


    alert(

        "Product: " +
        product.name +
        "\n\n" +

        "Category: " +
        product.category +
        "\n" +

        "Brand: " +
        (product.brand || "-") +
        "\n" +

        "Size: " +
        (product.size || "-") +
        "\n" +

        "Unit: " +
        product.unit +
        "\n" +

        "Purchase Price: Rs. " +
        formatMoney(product.purchasePrice) +
        "\n" +

        "Sale Price: Rs. " +
        formatMoney(product.salePrice) +
        "\n" +

        "Stock: " +
        product.stock +
        "\n" +

        "Status: " +
        status.label

    );

}


/* =====================================================
   SEARCH
   ===================================================== */

function setupSearch() {

    if (productSearch) {

        productSearch.addEventListener(
            "input",
            function () {

                if (inventorySearch) {
                    inventorySearch.value =
                        productSearch.value;
                }

                renderProducts();

            }
        );

    }


    if (inventorySearch) {

        inventorySearch.addEventListener(
            "input",
            function () {

                if (productSearch) {
                    productSearch.value =
                        inventorySearch.value;
                }

                renderProducts();

            }
        );

    }

}


/* =====================================================
   FILTERS
   ===================================================== */

function setupFilters() {

    if (categoryFilter) {

        categoryFilter.addEventListener(
            "change",
            renderProducts
        );

    }


    if (stockFilter) {

        stockFilter.addEventListener(
            "change",
            renderProducts
        );

    }

}


/* =====================================================
   MODAL EVENTS
   ===================================================== */

function setupModal() {

    if (addProductBtn) {

        addProductBtn.addEventListener(
            "click",
            openProductModal
        );

    }


    if (closeProductModal) {

        closeProductModal.addEventListener(
            "click",
            closeProductModalFunc
        );

    }


    if (cancelProductBtn) {

        cancelProductBtn.addEventListener(
            "click",
            closeProductModalFunc
        );

    }


    if (productForm) {

        productForm.addEventListener(
            "submit",
            addProduct
        );

    }


    /* CLICK OUTSIDE MODAL */

    if (productModal) {

        productModal.addEventListener(
            "click",
            function (event) {

                if (
                    event.target ===
                    productModal
                ) {

                    closeProductModalFunc();

                }

            }
        );

    }

}


/* =====================================================
   MOBILE SIDEBAR
   ===================================================== */

function setupMobileSidebar() {

    const sidebar =
        document.querySelector(".sidebar");


    if (!sidebar || !inventoryMenuBtn) {
        return;
    }


    let overlay =
        document.querySelector(
            ".mobile-overlay"
        );


    if (!overlay) {

        overlay =
            document.createElement("div");

        overlay.className =
            "mobile-overlay";

        document.body.appendChild(
            overlay
        );

    }


    inventoryMenuBtn.addEventListener(
        "click",
        function () {

            sidebar.classList.toggle(
                "open"
            );

            overlay.classList.toggle(
                "show"
            );

        }
    );


    overlay.addEventListener(
        "click",
        function () {

            sidebar.classList.remove(
                "open"
            );

            overlay.classList.remove(
                "show"
            );

        }
    );

}


/* =====================================================
   SIDEBAR LINK HANDLING
   ===================================================== */

function setupSidebarLinks() {

    const menuItems =
        document.querySelectorAll(
            ".sidebar .menu-item"
        );


    menuItems.forEach(
        function (item) {

            item.addEventListener(
                "click",
                function (event) {

                    const href =
                        this.getAttribute(
                            "href"
                        );


                    /*
                     * Real page link भए
                     * browser लाई normally
                     * navigate गर्न दिने।
                     */

                    if (
                        href &&
                        href !== "#" &&
                        href !== ""
                    ) {

                        return;

                    }


                    event.preventDefault();

                }
            );

        }
    );

}


/* =====================================================
   INITIALIZE
   ===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        setupSearch();

        setupFilters();

        setupModal();

        setupMobileSidebar();

        setupSidebarLinks();

        renderProducts();


        console.log(
            "Inventory module loaded successfully."
        );

    }
);
