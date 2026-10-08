// ==========================================
// GENERAL STORE MANAGEMENT SYSTEM
// INVENTORY MODULE
// ==========================================

const PRODUCT_KEY = "gs_products";

// -------------------------------
// DOM Elements
// -------------------------------

const addProductBtn = document.getElementById("addProductBtn");
const productModal = document.getElementById("productModal");
const closeProductModal = document.getElementById("closeProductModal");
const cancelProductBtn = document.getElementById("cancelProductBtn");
const productForm = document.getElementById("productForm");

const productSearch = document.getElementById("productSearch");
const inventorySearch = document.getElementById("inventorySearch");

const categoryFilter = document.getElementById("categoryFilter");
const stockFilter = document.getElementById("stockFilter");

const productTableBody = document.getElementById("productTableBody");
const emptyInventory = document.getElementById("emptyInventory");

const totalProducts = document.getElementById("totalProducts");
const inStockProducts = document.getElementById("inStockProducts");
const lowStockProducts = document.getElementById("lowStockProducts");
const stockValue = document.getElementById("stockValue");

// Mobile menu
const inventoryMenuBtn = document.getElementById("inventoryMenuBtn");


// -------------------------------
// Load Products
// -------------------------------

function getProducts() {
    try {
        return JSON.parse(localStorage.getItem(PRODUCT_KEY)) || [];
    } catch (error) {
        console.error("Product data error:", error);
        return [];
    }
}


// -------------------------------
// Save Products
// -------------------------------

function saveProducts(products) {
    localStorage.setItem(PRODUCT_KEY, JSON.stringify(products));
}


// -------------------------------
// Currency Format
// -------------------------------

function formatMoney(amount) {
    return Number(amount || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}


// -------------------------------
// Stock Status
// -------------------------------

function getStockStatus(product) {
    const stock = Number(product.stock || 0);
    const minStock = Number(product.minStock || 0);

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


// -------------------------------
// Update Summary Cards
// -------------------------------

function updateSummary(products) {

    const total = products.length;

    let inStock = 0;
    let lowStock = 0;
    let totalStockValue = 0;

    products.forEach(product => {

        const status = getStockStatus(product);

        if (status.key === "in") {
            inStock++;
        }

        if (status.key === "low") {
            lowStock++;
        }

        const stock = Number(product.stock || 0);
        const purchasePrice = Number(product.purchasePrice || 0);

        totalStockValue += stock * purchasePrice;
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
        stockValue.textContent = "Rs. " + formatMoney(totalStockValue);
    }
}


// -------------------------------
// Render Products
// -------------------------------

function renderProducts() {

    const products = getProducts();

    updateSummary(products);

    let searchText = "";

    if (productSearch && productSearch.value.trim()) {
        searchText = productSearch.value.trim().toLowerCase();
    }

    if (inventorySearch && inventorySearch.value.trim()) {
        searchText = inventorySearch.value.trim().toLowerCase();
    }

    const selectedCategory = categoryFilter
        ? categoryFilter.value
        : "all";

    const selectedStock = stockFilter
        ? stockFilter.value
        : "all";


    const filteredProducts = products.filter(product => {

        // Search
        const searchableText = [
            product.name,
            product.brand,
            product.category,
            product.size,
            product.unit
        ]
            .join(" ")
            .toLowerCase();

        const matchesSearch =
            !searchText ||
            searchableText.includes(searchText);


        // Category
        const matchesCategory =
            selectedCategory === "all" ||
            product.category === selectedCategory;


        // Stock
        const stockStatus = getStockStatus(product);

        const matchesStock =
            selectedStock === "all" ||
            stockStatus.key === selectedStock;


        return (
            matchesSearch &&
            matchesCategory &&
            matchesStock
        );
    });


    // Empty state
    if (filteredProducts.length === 0) {

        productTableBody.innerHTML = "";

        if (emptyInventory) {
            emptyInventory.style.display = "block";
        }

        return;
    }


    if (emptyInventory) {
        emptyInventory.style.display = "none";
    }


    // Table
    productTableBody.innerHTML = filteredProducts
        .map(product => {

            const status = getStockStatus(product);

            return `
                <tr>

                    <td>
                        <div class="product-name-cell">
                            <div class="product-icon">📦</div>

                            <div>
                                <strong>${escapeHTML(product.name)}</strong>

                                ${
                                    product.brand
                                        ? `<small>${escapeHTML(product.brand)}</small>`
                                        : ""
                                }

                                ${
                                    product.size
                                        ? `<small>${escapeHTML(product.size)}</small>`
                                        : ""
                                }
                            </div>
                        </div>
                    </td>


                    <td>
                        ${escapeHTML(product.category || "-")}
                    </td>


                    <td>
                        ${escapeHTML(product.unit || "-")}
                    </td>


                    <td>
                        Rs. ${formatMoney(product.purchasePrice)}
                    </td>


                    <td>
                        Rs. ${formatMoney(product.salePrice)}
                    </td>


                    <td>
                        <strong>${Number(product.stock || 0)}</strong>
                    </td>


                    <td>
                        <span class="stock-status ${status.key}">
                            ${status.label}
                        </span>
                    </td>


                    <td>
                        <button
                            class="table-action-btn"
                            onclick="viewProduct('${product.id}')"
                            title="View Product"
                        >
                            👁️
                        </button>
                    </td>

                </tr>
            `;

        })
        .join("");
}


// -------------------------------
// Escape HTML
// -------------------------------

function escapeHTML(value) {

    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// -------------------------------
// Open Modal
// -------------------------------

function openProductModal() {

    if (!productModal) {
        return;
    }

    productModal.classList.add("show");

    document.body.style.overflow = "hidden";

    const firstInput = document.getElementById("productName");

    if (firstInput) {
        setTimeout(() => {
            firstInput.focus();
        }, 100);
    }
}


// -------------------------------
// Close Modal
// -------------------------------

function closeProductModalFunc() {

    if (!productModal) {
        return;
    }

    productModal.classList.remove("show");

    document.body.style.overflow = "";

    if (productForm) {
        productForm.reset();
    }
}


// -------------------------------
// Add Product
// -------------------------------

function addProduct(event) {

    event.preventDefault();

    const name = document.getElementById("productName").value.trim();
    const category = document.getElementById("productCategory").value;
    const brand = document.getElementById("productBrand").value.trim();
    const size = document.getElementById("productSize").value.trim();
    const unit = document.getElementById("productUnit").value;
    const purchasePrice = Number(
        document.getElementById("purchasePrice").value
    );
    const salePrice = Number(
        document.getElementById("salePrice").value
    );
    const minStock = Number(
        document.getElementById("minStock").value || 0
    );
    const targetStock = Number(
        document.getElementById("targetStock").value || 0
    );

    const expiryApplicable =
        document.getElementById("expiryApplicable").checked;


    // Validation
    if (!name) {
        alert("Please enter product name.");
        return;
    }

    if (!unit) {
        alert("Please select product unit.");
        return;
    }

    if (purchasePrice < 0 || salePrice < 0) {
        alert("Price cannot be negative.");
        return;
    }


    // Create Product
    const product = {

        id:
            "P-" +
            Date.now() +
            "-" +
            Math.floor(Math.random() * 1000),

        name: name,

        category: category || "Other",

        brand: brand,

        size: size,

        unit: unit,

        purchasePrice: purchasePrice,

        salePrice: salePrice,

        minStock: minStock,

        targetStock: targetStock,

        expiryApplicable: expiryApplicable,

        // Stock will come from Purchase module
        stock: 0,

        active: true,

        createdAt: new Date().toISOString()
    };


    // Existing products
    const products = getProducts();

    products.push(product);

    saveProducts(products);


    // Close modal
    closeProductModalFunc();


    // Refresh table
    renderProducts();


    alert(
        "Product added successfully.\n\n" +
        product.name +
        "\n\nOpening stock will be added through the Purchase module."
    );
}


// -------------------------------
// View Product
// -------------------------------

function viewProduct(productId) {

    const products = getProducts();

    const product = products.find(
        item => item.id === productId
    );

    if (!product) {
        return;
    }

    const status = getStockStatus(product);

    const message =
        "Product Details\n\n" +

        "Name: " + product.name + "\n" +

        "Category: " + product.category + "\n" +

        "Brand: " + (product.brand || "-") + "\n" +

        "Size: " + (product.size || "-") + "\n" +

        "Unit: " + product.unit + "\n\n" +

        "Purchase Price: Rs. " +
        formatMoney(product.purchasePrice) +
        "\n" +

        "Sale Price: Rs. " +
        formatMoney(product.salePrice) +
        "\n\n" +

        "Stock: " +
        product.stock +
        "\n" +

        "Status: " +
        status.label;


    alert(message);
}


// -------------------------------
// Search
// -------------------------------

function setupSearch() {

    if (productSearch) {

        productSearch.addEventListener("input", () => {

            if (inventorySearch) {
                inventorySearch.value =
                    productSearch.value;
            }

            renderProducts();
        });
    }


    if (inventorySearch) {

        inventorySearch.addEventListener("input", () => {

            if (productSearch) {
                productSearch.value =
                    inventorySearch.value;
            }

            renderProducts();
        });
    }
}


// -------------------------------
// Filters
// -------------------------------

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


// -------------------------------
// Modal Events
// -------------------------------

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


    // Click outside modal
    if (productModal) {

        productModal.addEventListener(
            "click",
            event => {

                if (
                    event.target === productModal
                ) {
                    closeProductModalFunc();
                }

            }
        );
    }


    // ESC key
    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape" &&
                productModal &&
                productModal.classList.contains("show")
            ) {
                closeProductModalFunc();
            }

        }
    );
}


// -------------------------------
// Mobile Sidebar
// -------------------------------

function setupMobileSidebar() {

    const sidebar =
        document.querySelector(".sidebar");

    if (!sidebar || !inventoryMenuBtn) {
        return;
    }


    let overlay =
        document.querySelector(".overlay");


    // Create overlay if missing
    if (!overlay) {

        overlay = document.createElement("div");

        overlay.className = "overlay";

        document.body.appendChild(overlay);
    }


    inventoryMenuBtn.addEventListener(
        "click",
        () => {

            sidebar.classList.toggle("open");

            overlay.classList.toggle("show");
        }
    );


    overlay.addEventListener(
        "click",
        () => {

            sidebar.classList.remove("open");

            overlay.classList.remove("show");
        }
    );


    // Close sidebar after menu click
    const menuLinks =
        sidebar.querySelectorAll("a");

    menuLinks.forEach(link => {

        link.addEventListener(
            "click",
            () => {

                sidebar.classList.remove("open");

                overlay.classList.remove("show");
            }
        );

    });
}


// -------------------------------
// Initial Load
// -------------------------------

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupSearch();

        setupFilters();

        setupModal();

        setupMobileSidebar();

        renderProducts();

        console.log(
            "Inventory module loaded successfully."
        );

    }
);
