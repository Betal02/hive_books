/**
 * State Management
 */
const State = {
    user: JSON.parse(localStorage.getItem('hive_user')),
    library: [],
    viewMode: 'table',
};

document.addEventListener('DOMContentLoaded', () => {
    console.log('[CLIENT] Hive Books Client Initialized');

    // Check Auth
    if (!State.user && !window.location.pathname.includes('login.html')) {
        window.location.href = 'login.html';
        return;
    }

    // Initialize Pages
    initAuth();
    initDashboard();
    initSearch();
    initDiscovery();
    initNewReleases();
    initAddBookModal();
    initEditModal();
});

/**
 * Auth Logic
 */
function initAuth() {
    const loginSection = document.getElementById('loginSection');
    const registerSection = document.getElementById('registerSection');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const showRegisterLinks = document.getElementById('showRegister');
    const showLoginLinks = document.getElementById('showLogin');

    // Section Toggles
    if (showRegisterLinks && showLoginLinks) {
        showRegisterLinks.addEventListener('click', (e) => {
            e.preventDefault();
            loginSection.classList.add('hidden');
            registerSection.classList.remove('hidden');
        });
        showLoginLinks.addEventListener('click', (e) => {
            e.preventDefault();
            registerSection.classList.add('hidden');
            loginSection.classList.remove('hidden');
        });
    }

    // Login Submission
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            try {
                const res = await fetch(`/api/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                if (!res.ok) {
                    const error = await res.json();
                    throw new Error(error.error || 'Invalid credentials');
                }

                const user = await res.json();
                localStorage.setItem('hive_user', JSON.stringify(user));
                window.location.href = 'index.html';
            } catch (err) {
                showToast('Failed to login. Unexpected error: ' + err.message, 'error');
            }
        });
    }

    // Register Submission
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('regName').value;
            const email = document.getElementById('regEmail').value;
            const password = document.getElementById('regPassword').value;

            try {
                const res = await fetch(`/api/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, password })
                });

                if (!res.ok) {
                    const error = await res.json();
                    throw new Error(error.error || 'Registration failed');
                }

                const user = await res.json();
                localStorage.setItem('hive_user', JSON.stringify(user));
                showToast('Account created successfully!');
                window.location.href = 'index.html';
            } catch (err) {
                showToast('Failed to register. Unexpected error: ' + err.message, 'error');
            }
        });
    }

    const logoutBtn = document.querySelector('a[href="login.html"]');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            localStorage.removeItem('hive_user');
        });
    }
}

/**
 * Dashboard Logic
 */
async function initDashboard() {
    const libraryContainer = document.getElementById('libraryContainer');
    if (!libraryContainer) return;

    initAddBookModal();

    // View Toggle
    const viewTableBtn = document.getElementById('viewTable');
    const viewGridBtn = document.getElementById('viewGrid');
    const gridView = document.getElementById('gridView');
    const tableView = document.getElementById('tableView');

    // Set initial view state
    if (State.viewMode === 'grid') {
        viewGridBtn.classList.add('view-btn-active');
        viewTableBtn.classList.remove('view-btn-active');
        gridView.classList.remove('hidden');
        tableView.classList.add('hidden');
    } else {
        viewTableBtn.classList.add('view-btn-active');
        viewGridBtn.classList.remove('view-btn-active');
        gridView.classList.add('hidden');
        tableView.classList.remove('hidden');
    }

    if (viewTableBtn && viewGridBtn) {
        viewTableBtn.addEventListener('click', () => {
            State.viewMode = 'table';
            viewTableBtn.classList.add('view-btn-active');
            viewGridBtn.classList.remove('view-btn-active');
            gridView.classList.add('hidden');
            tableView.classList.remove('hidden');
        });
        viewGridBtn.addEventListener('click', () => {
            State.viewMode = 'grid';
            viewGridBtn.classList.add('view-btn-active');
            viewTableBtn.classList.remove('view-btn-active');
            tableView.classList.add('hidden');
            gridView.classList.remove('hidden');
        });
    }

    // Fetch Library
    try {
        const res = await fetch(`/api/library`, {
            headers: { 'Authorization': `Bearer ${State.user.token}` }
        });
        const data = await res.json();

        if (res.status === 401 || res.status === 403) {
            localStorage.removeItem('hive_user');
            window.location.href = 'login.html';
            return;
        }

        if (!res.ok) throw new Error(data.message || 'Failed to fetch library');

        State.library = Array.isArray(data) ? data : [];
        renderLibrary();
    } catch (err) {
        showToast('Failed to fetch library. Unexpected error: ' + err.message, 'error');
    }
}

function renderLibrary() {
    const emptyMessage = document.getElementById('emptyMessage');
    const gridView = document.getElementById('gridView');
    const tableView = document.getElementById('tableView');
    const tableBody = document.getElementById('tableBody');

    if (State.library.length === 0) {
        emptyMessage.classList.remove('hidden');
        gridView.classList.add('hidden');
        tableView.classList.add('hidden');
        return;
    }

    emptyMessage.classList.add('hidden');

    if (State.viewMode === 'grid') {
        gridView.classList.remove('hidden');
        tableView.classList.add('hidden');
    } else {
        gridView.classList.add('hidden');
        tableView.classList.remove('hidden');
    }

    // Render Grid
    gridView.innerHTML = State.library.map(book => createBookCard(book, true)).join('');

    // Render Table /* line-clamp-1 */
    tableBody.innerHTML = State.library.map(book => `
        <tr class="border-b border-gray-800 hover:bg-gray-800 transition">
            <td class="py-3 px-2">
                ${renderThumbnail(book.thumbnail, 'w-12 h-16 rounded shadow')}
            </td>
            <td class="py-3 px-2 font-semibold ">${book.title}</td>
            <td class="py-3 px-2 text-gray-400 ">${book.author}</td>
            <td class="py-3 px-2 text-gray-500 font-mono text-xs">${book.isbn || 'N/A'}</td>
            <td class="py-3 px-2">
                <button onclick='openEditModal(${book.id})' class="text-indigo-400 hover:text-indigo-300 transition">
                    <i class="fas fa-edit"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

/**
 * Search Logic
 */
function initSearch() {
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchInput');
    const toggleOptionsBtn = document.getElementById('toggleOptionsBtn');
    const optionsPanel = document.getElementById('optionsPanel');

    if (!searchBtn) return;

    if (toggleOptionsBtn && optionsPanel) {
        toggleOptionsBtn.addEventListener('click', () => {
            optionsPanel.classList.toggle('hidden');
            toggleOptionsBtn.classList.toggle('text-indigo-400');
        });
    }

    // Search event listeners
    searchBtn.addEventListener('click', () => performSearch(searchInput.value));
    searchInput.addEventListener('keypress', (e) => e.key === 'Enter' && performSearch(searchInput.value));

    // Show popular books
    loadDiscovery('popularGrid');
}

async function performSearch(query) {
    const isbn = document.getElementById('filterIsbn')?.value.trim();
    const title = document.getElementById('filterTitle')?.value.trim();
    const author = document.getElementById('filterAuthor')?.value.trim();
    const sort = document.getElementById('filterSort')?.value || 'relevance';

    let q = query;
    if (isbn || title || author) {
        const parts = [];
        if (query) parts.push(query);
        if (isbn) parts.push(`isbn:${isbn}`);
        if (title) parts.push(`intitle:${title}`);
        if (author) parts.push(`inauthor:${author}`);
        q = parts.join(' ');
    }

    if (!q) return;

    const initialView = document.getElementById('initialView');
    const searchResultsView = document.getElementById('searchResultsView');
    const resultsList = document.getElementById('resultsList');

    initialView.classList.add('hidden');
    searchResultsView.classList.remove('hidden');

    // Show loading spinner
    resultsList.innerHTML = '<div class="text-center py-10"><i class="fas fa-spinner fa-spin text-3xl"></i></div>';

    const no_results_message = `<p class="text-gray-400">No results found for "${q}".</p>`;

    // Fetch and show search results
    try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&orderBy=${sort}`);
        const data = await res.json();

        if (!res.ok) throw new Error(data.message || 'Failed to perform search');

        const resultsArray = Array.isArray(data) ? data : [];

        resultsList.innerHTML = resultsArray.length === 0 ? no_results_message : resultsArray.map(book => `
            <div class="bg-gray-800 p-4 rounded-xl flex items-center border border-gray-700 hover:border-indigo-500 transition group">
                ${renderThumbnail(book.thumbnail, 'w-16 h-24 rounded shadow-lg mr-6')}
                <div class="flex-1 min-w-0">
                    <h4 class="font-bold text-lg truncate">${book.title ? (book.title.length > 24 ? book.title.slice(0, 24) + '...' : book.title) : 'Unknown Title'}</h4>
                    <p class="text-gray-400">${book.author || 'Unknown Author'}</p>
                    <p class="text-xs text-gray-500 mt-1">${book.genre || 'General'} • ${book.year || 'Unknown Publication Year'}</p>
                </div>
                <button onclick='handleCardAdd(this, ${JSON.stringify(book).replace(/'/g, "&apos;")})' 
                    class="action-add ml-4 bg-indigo-600 hover:bg-indigo-700 p-3 rounded-lg transition ${State.library.some(lb => lb.isbn === book.isbn) ? 'hidden' : ''}">
                    <i class="fas fa-plus"></i>
                </button>
                <button onclick='handleCardRemove(this, "${book.isbn}")' 
                    class="action-remove ml-4 bg-red-600 hover:bg-red-700 p-3 rounded-lg transition ${State.library.some(lb => lb.isbn === book.isbn) ? '' : 'hidden'}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
    } catch (err) {
        showToast('Failed to perform search. Unexpected error: ' + err.message, 'error');
        resultsList.innerHTML = no_results_message;
    }
}

/**
 * Discovery & New Releases
 */
async function initDiscovery() {
    const grid = document.getElementById('discoveryGrid');
    if (grid) loadDiscovery('discoveryGrid');
}

async function initNewReleases() {
    const grid = document.getElementById('newReleasesGrid');
    if (!grid) return;

    const no_results_message = '<p class="col-span-full text-center text-gray-500 py-10">No releases found for your favorite authors.</p>';

    //Fetch and show new releases books
    try {
        const res = await fetch(`/api/new-releases`, {
            headers: { 'Authorization': `Bearer ${State.user.token}` }
        });
        const data = await res.json();

        if (res.status === 401 || res.status === 403) return;

        if (!res.ok) throw new Error(data.message || 'Failed to fetch new releases');

        const booksArray = Array.isArray(data) ? data : [];
        grid.innerHTML = booksArray.map(book => createBookCard(book)).join('');
        if (booksArray.length === 0) grid.innerHTML = no_results_message;
    } catch (err) {
        showToast('Failed to fetch new releases. Unexpected error: ' + err.message, 'error');
        grid.innerHTML = no_results_message;
    }

    //Fetch and show last releases books
    const lastReleasesContainer = document.getElementById('lastReleasesContainer');
    if (!lastReleasesContainer) return;

    try {
        const res = await fetch(`/api/last-releases`, {
            headers: { 'Authorization': `Bearer ${State.user.token}` }
        });
        const lastReleasesMap = await res.json();

        const authors = Object.keys(lastReleasesMap);
        if (authors.length === 0) {
            lastReleasesContainer.innerHTML = no_results_message;
            return;
        }

        lastReleasesContainer.innerHTML = authors.map(author => {
            const releases = Array.isArray(lastReleasesMap[author]) ? lastReleasesMap[author] : [];
            return `
                <div class="author-section">
                    <h3 class="text-xl font-semibold mb-6 flex items-center">
                       <i class="fas fa-user text-indigo-400 mr-2"></i> ${author}'s Last Releases
                    </h3>
                    <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                        ${releases.map(book => createBookCard(book)).join('')}
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        showToast('Failed to fetch last releases. Unexpected error: ' + err.message, 'error');
        lastReleasesContainer.innerHTML = no_results_message;
    }
}

async function loadDiscovery(elementId) {
    const grid = document.getElementById(elementId);
    if (!grid) return;

    //Fetch and show recommended books
    try {
        const headers = State.user ? { 'Authorization': `Bearer ${State.user.token}` } : {};
        const res = await fetch(`/api/discovery`, { headers });
        const data = await res.json();

        if (res.status === 401 || res.status === 403) return;

        if (!res.ok) throw new Error(data.message || 'Failed to load discovery');

        let booksArray = Array.isArray(data) ? data : [];
        if (elementId === "popularGrid") {
            booksArray = booksArray.slice(0, 10);
        }
        grid.innerHTML = booksArray.map(book => createBookCard(book)).join('');
        if (booksArray.length === 0) grid.innerHTML = '<p class="col-span-full text-center text-gray-500 py-10">No books found for discovery.</p>';
    } catch (err) {
        showToast('Failed to load discovery. Unexpected error: ' + err.message, 'error');
    }
}

/**
 * Modal logic
 */
function initAddBookModal() {
    const openBtn = document.getElementById('openAddModalBtn');
    const modal = document.getElementById('addBookModal');
    if (!openBtn || !modal) return;

    // Prevent double init
    if (openBtn.dataset.initialized) return;
    openBtn.dataset.initialized = 'true';

    const closeBtns = modal.querySelectorAll('.closeModal');
    const addByIsbnBtn = document.getElementById('addByIsbnBtn');
    const manualCreateBtn = document.getElementById('manualCreateBtn');

    openBtn.addEventListener('click', () => modal.classList.remove('hidden'));

    const hideModal = () => {
        modal.classList.add('hidden');
        document.getElementById('addIsbnInput').value = '';
        document.getElementById('addTitleInput').value = '';
    };

    closeBtns.forEach(btn => btn.addEventListener('click', hideModal));
    modal.addEventListener('click', (e) => e.target === modal && hideModal());

    addByIsbnBtn.addEventListener('click', async () => {
        const isbn = document.getElementById('addIsbnInput').value.trim();
        if (!isbn) return showToast('Please enter an ISBN', 'warning');

        addByIsbnBtn.disabled = true;
        const originalText = addByIsbnBtn.textContent;
        addByIsbnBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        if (await addBook({ isbn })) {
            hideModal();
        }

        addByIsbnBtn.disabled = false;
        addByIsbnBtn.textContent = originalText;
    });

    manualCreateBtn.addEventListener('click', async () => {
        const title = document.getElementById('addTitleInput').value.trim();
        if (!title) return showToast('Please enter a title', 'warning');

        manualCreateBtn.disabled = true;
        const originalText = manualCreateBtn.textContent;
        manualCreateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        if (await addBook({ title })) {
            hideModal();
        }

        manualCreateBtn.disabled = false;
        manualCreateBtn.textContent = originalText;
    });
}

function initEditModal() {
    const modal = document.getElementById('editBookModal');
    const form = document.getElementById('editBookForm');
    const deleteBtn = document.getElementById('deleteFromEditBtn');

    if (!modal || !form) return;

    const closeBtns = modal.querySelectorAll('.closeModal');
    const hideModal = () => modal.classList.add('hidden');

    closeBtns.forEach(btn => btn.addEventListener('click', hideModal));
    modal.addEventListener('click', (e) => e.target === modal && hideModal());

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('editBookId').value;
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;

        const updatedData = {
            title: document.getElementById('editTitle').value,
            author: document.getElementById('editAuthor').value,
            genre: document.getElementById('editGenre').value,
            year: document.getElementById('editYear').value,
            description: document.getElementById('editDescription').value,
            isbn: document.getElementById('editIsbn').value,
            thumbnail: document.getElementById('editThumbnail').value
        };

        try {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Saving...';

            const res = await fetch(`/api/books/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${State.user.token}`
                },
                body: JSON.stringify(updatedData)
            });

            if (!res.ok) throw new Error('Failed to update book');

            showToast('Book updated successfully!');
            hideModal();

            // Refresh
            initDashboard();
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    });

    deleteBtn.addEventListener('click', async () => {
        const id = document.getElementById('editBookId').value;
        if (await removeBook(id)) {
            hideModal();
        }
    });
}

function openEditModal(bookId) {
    const book = State.library.find(b => b.id === bookId);
    if (!book) return showToast('Book not found in local state', 'error');

    document.getElementById('editBookId').value = book.id;
    document.getElementById('editTitle').value = book.title || '';
    document.getElementById('editAuthor').value = book.author || '';
    document.getElementById('editGenre').value = book.genre || '';
    document.getElementById('editYear').value = book.year || '';
    document.getElementById('editDescription').value = book.description || '';
    document.getElementById('editIsbn').value = book.isbn || '';
    document.getElementById('editThumbnail').value = book.thumbnail || '';

    const modal = document.getElementById('editBookModal');
    if (modal) modal.classList.remove('hidden');
}

/**
 * Actions
 */
async function addBook(book) {
    try {
        const res = await fetch(`/api/books/add`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${State.user.token}`
            },
            body: JSON.stringify(book)
        });

        if (!res.ok) throw new Error('Failed to add book');

        const newBook = await res.json();
        State.library.push(newBook);
        showToast('Book added to library!');

        // Refresh dashboard if we are there
        if (document.getElementById('libraryContainer')) {
            renderLibrary();
        }
        return true;
    } catch (err) {
        showToast('Failed to add book. Unexpected error: ' + err.message, 'error');
        return false;
    }
}

async function removeBook(bookId) {
    if (!await showConfirm({ title: 'Remove Book', message: 'Are you sure you want to remove this book from your library?' })) return false;

    try {
        const res = await fetch(`/api/books/${bookId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${State.user.token}` }
        });
        if (!res.ok) throw new Error('Delete failed');
        State.library = State.library.filter(b => String(b.id) !== String(bookId));

        showToast('Book removed from library!');

        // Refresh dashboard if we are there
        if (document.getElementById('libraryContainer')) {
            renderLibrary();
        }
        return true;
    } catch (err) {
        showToast('Failed to remove book. Unexpected error: ' + err.message, 'error');
        return false;
    }
}

/**
 * UI Components
 */
function createHiveBooksIcon() {
    return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
            <g fill="currentColor">
                <path
                    d="m555 338 85 50 43 25v197l-15 8-124 72-32 19-15-9-48-28-93-54-15-9V412l5-2 89-52 76-45zm-84 16-77 45-37 22-1 90v90l7 4 103 60 46 27 19-11 113-67 24-14v-89c0-88 0-89-2-91-10-7-154-90-155-89z" />
                <path
                    d="m561 379 69 40 21 13v158l-11 7-108 63-20 11-84-49-43-25-12-6V432l3-2 31-19 105-60zm-60-12-115 67-4 3v148l3 2 103 60 24 14 39-23 63-36 26-16 2-1V436l-7-3-38-23-57-33-25-15c-2-2-4-1-14 5" />
                <path
                    d="M455 433a128 128 0 0 1 51 30l6 6 5-5a135 135 0 0 1 49-30c14-5 13-5 13 8l1 11 6-1 8-2h3v10q0 11 2 9l8-1 6-1v80h-2l-11 1c-19 2-70 13-81 18q-7 4-13 0l-33-9c-18-4-38-8-52-9h-9l-1-40v-40h16v-18h3l13 3c2 0 2-1 2-11l1-12zm97 14q-16 9-29 21l-7 6v78l9-10a155 155 0 0 1 38-28l9-5v-70l-6 3zm-100 27v35l10 5q19 10 36 28l10 9 1-38v-37l-5-6a131 131 0 0 0-51-31zm131-15-4 1v54l-10 4a147 147 0 0 0-42 32l7-4c15-9 40-19 53-21l3-1v-34l-1-33zm-149 32v33l7 1a232 232 0 0 1 56 25 139 139 0 0 0-43-32l-9-5v-53l-5-1-5-1zm164-15-1 26v27l-6 1a219 219 0 0 0-58 24l2 1a364 364 0 0 1 60-13l10-1 1-34v-33l-3 1zm-180 32v33h3l13 2 43 8 13 3-16-8a197 197 0 0 0-41-16l-6-1v-54h-3l-5-1z" />
                <path
                    d="M625 570v3h-47c-43 0-48 0-49 2q-5 4-14 6c-6 0-15-2-19-5l-3-3h-94v-7h98l3 3c6 6 17 6 24 0l4-3h97z" />
            </g>
        </svg>
    `;
}

function createDefaultThumbnail(classes = 'w-full h-full', color = 'text-indigo-400') {
    return `
        <svg xmlns="http://www.w3.org/2000/svg" class="${classes} ${color} transition duration-500 group-hover:scale-105" version="1.0" viewBox="300 230 430 540">
            <g fill="currentColor">
                <path d="M349.2 250.7c-12.7 3-23.7 13.3-26.1 24.3-1.6 7.3-1.5 461.8 0 469.2a42.9 42.9 0 0 0 11.2 20.4c2.2 2 6.9 5 10.6 6.8l6.6 3.1 174.1.3c158.2.2 174.2.1 174.8-1.4.8-2.1 1-470 .1-471.3-.3-.6-2.4-1.1-4.6-1.1-4.7 0-7.5-2.4-11-9.1a32 32 0 0 1 3.7-32.5c3.9-5.1 4.1-6.4 1.6-8.7-1.7-1.6-14.7-1.7-168.3-1.6-143.5.1-167.3.3-172.7 1.6zm328.8 7.8-1.7 4-1.7 3.5H526.9c-133 0-147.9.2-149.3 1.6-1.9 1.8-2.1 4.5-.4 6.2.9.9 35.3 1.2 148.5 1.2H673v8.2l-39.7-.2c-21.9-.2-69.6-.2-106-.1-63.9.1-66.3.2-67.2 2-.8 1.4-.6 2.5 1 4.5l2 2.6H675l2 4c1.1 2.1 2 4.2 2 4.5 0 .3-73 .4-162.2.3-153.2-.3-162.6-.4-166.8-2.1a29.7 29.7 0 0 1-15.1-11.4c-7-11.1-.8-22.3 15.1-27.4 5.2-1.7 15.6-1.8 166.8-1.8 88.6-.1 161.2.1 161.2.4zm-344 41.1c2.5 2.9 9.7 6.4 16.9 8.2l7.1 1.8v455.9l-3.1-.3a30.9 30.9 0 0 1-15.6-8.4 36.3 36.3 0 0 1-5.5-8.3l-2.3-5-.3-222.8c-.1-129.3.2-222.7.7-222.7.5 0 1.4.7 2.1 1.6zM642 344c0 27.8-.3 35-1.2 34.4-.7-.5-4.6-3.4-8.6-6.6a57 57 0 0 0-8.1-5.8c-.5 0-4.7 2.9-9.3 6.5a79.5 79.5 0 0 1-9.2 6.5c-.7 0-.8-68.4-.1-69.2.3-.2 8.6-.5 18.5-.7l18-.2V344zm-46 9.5c0 23.9.2 43.5.5 43.5.4 0 16.5-11.8 26.3-19.3.9-.7 2.9.3 7 3.5 9.5 7.5 20.7 15.8 21.2 15.8.3 0 .4-19.6.2-43.5l-.3-43.5 20.8.2c11.4.2 20.7.6 20.6 1-.2.5-.3 102.9-.3 227.8v227H368V310h228v43.5z"/>
                <path d="m522.5 429.7-22.1 8.6c-.2.3-7.4 46.2-7.4 47.5a535 535 0 0 0 36.7 28.5c1.6.9 43.5-14.6 45.3-16.8 1-1.2 8.5-47.4 7.8-47.9-2.2-1.8-36.6-27.4-37.3-27.8-.5-.3-10.9 3.2-23 7.9zm35.8 12.8c10.7 7.9 14.7 11.5 14.6 13 0 1.1-1.2 9.6-2.7 19l-2.7 16.9-17.7 6.9-17.7 6.8-12.3-9.2c-6.8-5-13.4-10.2-14.8-11.5l-2.6-2.4 2.2-13.2 3-18.6.9-5.3 17-6.8c9.4-3.8 17.3-6.8 17.6-6.7.3 0 7.2 5 15.2 11.1zm-95.5 58.8a422.8 422.8 0 0 0-21.1 8.7 337 337 0 0 0-4.2 24l-3.7 23.4 3.8 3.1 19.2 14.6 15.5 11.6 10.1-3.9c29.7-11.4 33.9-13.3 34.7-15.3a430 430 0 0 0 6.6-45.9 306 306 0 0 0-38.5-28.5c-.9.1-11 3.8-22.4 8.2zm37 12.8 14.9 11.1-2.7 18.5c-1.5 10.1-3 18.6-3.2 18.8-1 1-34.4 13.5-35.4 13.3-.6-.2-7.5-5-15.3-10.8l-14.2-10.5.7-6c.3-3.3 1.5-11.9 2.7-19l2.2-13 16.5-6.7a332 332 0 0 1 17.8-6.7c.7-.1 7.9 4.9 16 11zm56.3.3a321.4 321.4 0 0 0-22.1 9.3c-.7.7-2.1 8-7.1 39.6-.8 5.1-.8 7.1.1 8.2.7.8 9.3 7.6 19.2 15.1l18 13.6 4.6-1.7a382.8 382.8 0 0 0 40.7-16.8c.3-.7 2-11.3 3.8-23.7 3.1-20.7 3.3-22.6 1.8-24.2-1.5-1.5-36.9-27.8-37.4-27.8l-21.6 8.4zm36.1 13.2 14.5 10.9c.4.3-5.3 37.5-5.8 37.8a296.6 296.6 0 0 1-36.4 12.8c-19.8-14.7-28.5-21.6-28.5-22.7 0-1.9 5.2-35.8 5.5-36.2 1-1.1 34.2-14 35.2-13.7.6.2 7.6 5.2 15.5 11.1zm-95.1 58a375.4 375.4 0 0 0-22.2 9.1c-.3.5-2 10.2-3.8 21.8l-3.6 23.2c-.4 1.8 1.1 3.5 8.7 9.6 16.5 13 28.4 21.7 30 21.7 2.3 0 41.9-15.7 43.3-17.2a412 412 0 0 0 7.7-45.3c.3-2.8-.8-3.8-18.6-17.3a335.5 335.5 0 0 0-19.5-14.1c-.3 0-10.3 3.9-22 8.5zm35.6 12.6 15.1 11.4c.9.6-5.3 37-6.5 38a234.8 234.8 0 0 1-34.9 13c-.6-.2-7.5-5.3-15.4-11.2-12.7-9.7-14.1-11.1-13.7-13.4l2.7-17.5a158 158 0 0 1 2.9-16.4c.4-.8 8.3-4.4 17.6-8.1l17.2-6.9c.2-.1 6.9 4.9 15 11.1z"/>
            </g>
        </svg>
    `;
}

function renderThumbnail(thumbnail, classes = 'w-full h-full', color = 'text-indigo-400') {
    if (!thumbnail) return createDefaultThumbnail(classes, color);

    const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(thumbnail)}`;

    return `
        <div class="relative ${classes} overflow-hidden bg-gray-800 flex items-center justify-center">
            <div class="absolute inset-0 flex items-center justify-center opacity-20">
                ${createDefaultThumbnail('w-1/2 h-1/2')}
            </div>
            <img src="${proxyUrl}" 
                 class="absolute inset-0 w-full h-full object-cover transition-opacity duration-500 opacity-0"
                 onload="this.classList.remove('opacity-0')"
                 onerror="console.error('[CLIENT] Failed to load thumbnail:', this.src); this.parentElement.classList.add('border', 'border-red-500')"
                 loading="lazy">
        </div>
    `;
}

function createBookCard(book, isLibraryCard = false) {
    // Determine if book is already in library (for external recommendations)
    const inLibrary = isLibraryCard || State.library.some(lb => lb.isbn === book.isbn && book.isbn);
    const libBook = inLibrary ? State.library.find(lb => lb.isbn === book.isbn && book.isbn) : null;
    const finalId = libBook ? libBook.id : book.id;

    return `
        <div class="bg-gray-800 rounded-xl overflow-hidden border border-gray-700 hover:border-indigo-500 transition duration-300 group flex flex-col h-full" id="card-${book.id || book.isbn}">
            <div class="aspect-[2/3] bg-gray-700 relative overflow-hidden">
                ${renderThumbnail(book.thumbnail, 'w-full h-full')}
                <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition duration-300 flex items-center justify-center">
                    <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition duration-300">
                        ${isLibraryCard ? `
                            <button onclick='openEditModal(${book.id})' class="bg-indigo-600 p-3 w-16 h-16 rounded-full shadow-xl hover:scale-110 transition">
                                <i class="fas fa-edit text-2xl"></i>
                            </button>
                        ` : `
                            <button onclick='handleCardAdd(this, ${JSON.stringify(book).replace(/'/g, "&apos;")})' 
                                class="action-add bg-indigo-600 p-3 w-16 h-16 rounded-full shadow-xl hover:scale-110 transition ${inLibrary ? 'hidden' : ''}">
                                <i class="fas fa-plus text-2xl"></i>
                            </button>
                            <button onclick='handleCardRemove(this, "${book.isbn}")' 
                                class="action-remove bg-red-600 p-3 w-16 h-16 rounded-full shadow-xl hover:scale-110 transition ${inLibrary ? '' : 'hidden'}">
                                <i class="fas fa-trash text-2xl"></i>
                            </button>
                        `}
                    </div>
                </div>
            </div>
            <div class="p-4 flex-1 flex flex-col justify-between">
                <div>
                    <h4 class="font-bold text-base line-clamp-2">${book.title || 'Unknown Title'}</h4>
                    <p class="text-gray-400 text-xs truncate mt-1">${book.author || 'Unknown Author'}</p>
                </div>
                <div class="flex justify-between items-center mt-3">
                    <span class="text-[10px] bg-gray-700 px-2 py-1 rounded text-gray-300">${book.genre || 'General'}</span>
                    <span class="text-[10px] text-gray-500">${book.year || 'Unknown Publication Year'}</span>
                </div>
            </div>
        </div>
    `;
}

/**
 * Card Action Handlers
 */
async function handleCardAdd(btn, book) {
    const actions = btn.parentElement;
    const addBtn = actions.querySelector('.action-add');
    const removeBtn = actions.querySelector('.action-remove');

    try {
        addBtn.disabled = true;
        addBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        if (await addBook(book)) {
            // Update UI
            addBtn.classList.add('hidden');
            removeBtn.classList.remove('hidden');
        }
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        addBtn.disabled = false;
        addBtn.innerHTML = '<i class="fas fa-plus"></i>';
    }
}

async function handleCardRemove(btn, isbn) {
    const libBook = State.library.find(b => b.isbn === isbn);
    if (!libBook) return showToast('Book not found in library', 'error');

    const actions = btn.parentElement;
    const addBtn = actions.querySelector('.action-add');
    const removeBtn = actions.querySelector('.action-remove');

    if (await removeBook(libBook.id)) {
        removeBtn.classList.add('hidden');
        addBtn.classList.remove('hidden');
    }
}

/**
 * Toast and Modals
 */

function showToast(message, type = "success", duration = 4000) {
    const container = document.getElementById("toastContainer");

    // Toast type styling
    let wrapper = "bg-green-50 border-green-400 text-green-800";
    let icon = "fas fa-circle-check text-green-500";
    if (type === "error") {
        wrapper = "bg-red-50 border-red-400 text-red-800";
        icon = "fas fa-circle-xmark text-red-500";
    } else if (type === "warning") {
        wrapper = "bg-yellow-50 border-yellow-400 text-yellow-800";
        icon = "fas fa-circle-exclamation text-yellow-500";
    } else if (type === "info") {
        wrapper = "bg-blue-50 border-blue-400 text-blue-800";
        icon = "fas fa-circle-info text-blue-500";
    } else if (type !== "success") {
        wrapper = "bg-gray-50 border-gray-400 text-gray-800";
        icon = "fas fa-circle-question text-gray-500";
    }

    // Create toast
    const toast = document.createElement("div");
    toast.innerHTML = `
        <div class="pointer-events-auto w-80 border-l-4 ${wrapper} shadow-lg rounded-lg p-4 flex items-start gap-3 animate-fade-in transition">
            <i class="${icon} mt-1"></i>
            <div class="flex-1 text-sm font-medium">
                ${message}
            </div>
            <button class="ml-2 text-gray-400 hover:text-gray-600">
                <i class="fas fa-xmark"></i>
            </button>
        </div>
    `;
    container.appendChild(toast);

    // Manual close
    toast.querySelector("button").onclick = () => {
        toast.remove();
    };

    // Automatic close
    setTimeout(() => {
        toast.remove();
    }, duration);
}

function showConfirm({
    title = "Are you sure?",
    message = "This action cannot be undone. Do you want to proceed?",
}) {
    return new Promise((resolve) => {
        const modal = document.getElementById("confirmModal");
        const titleEl = document.getElementById("confirmTitle");
        const messageEl = document.getElementById("confirmMessage");
        const confirmBtn = document.getElementById("confirmAccept");
        const cancelBtn = document.getElementById("confirmCancel");

        titleEl.textContent = title;
        messageEl.textContent = message;

        modal.classList.remove("hidden");
        modal.classList.add("flex");

        function close(result) {
            modal.classList.add("hidden");
            modal.classList.remove("flex");

            confirmBtn.removeEventListener("click", onConfirm);
            cancelBtn.removeEventListener("click", onCancel);

            resolve(result);
        }

        function onConfirm() { close(true); }
        function onCancel() { close(false); }

        confirmBtn.addEventListener("click", onConfirm);
        cancelBtn.addEventListener("click", onCancel);
    });
}

/**
 *  Table actions
 */

function sortTable(tableId, n) {
    var table, rows, switching, i, x, y, shouldSwitch, dir, switchcount = 0;
    table = document.getElementById(tableId);
    switching = true;
    dir = "asc";
    while (switching) {
        switching = false;
        rows = table.rows;
        for (i = 1; i < (rows.length - 1); i++) {
            shouldSwitch = false;
            x = rows[i].getElementsByTagName("TD")[n];
            y = rows[i + 1].getElementsByTagName("TD")[n];
            if (dir == "asc") {
                if (x.innerHTML.toLowerCase() > y.innerHTML.toLowerCase()) {
                    shouldSwitch = true;
                    break;
                }
            } else if (dir == "desc") {
                if (x.innerHTML.toLowerCase() < y.innerHTML.toLowerCase()) {
                    shouldSwitch = true;
                    break;
                }
            }
        }
        if (shouldSwitch) {
            rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
            switching = true;
            switchcount++;
        } else {
            if (switchcount == 0 && dir == "asc") {
                dir = "desc";
                switching = true;
            }
        }
    }
}

// Global onclick handlers
window.addBook = addBook;
window.removeBook = removeBook;
window.openEditModal = openEditModal;
window.handleCardAdd = handleCardAdd;
window.handleCardRemove = handleCardRemove;
window.sortTable = sortTable;
