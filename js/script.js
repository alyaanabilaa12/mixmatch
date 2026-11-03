const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const iconRefresh = () => { if (window.lucide) window.lucide.createIcons(); };
const toast = $('#toast'), toastMessage = $('#toastMessage');
let toastTimer;
function showToast(message) {
  if (!toast || !toastMessage) return;
  toastMessage.textContent = message; toast.classList.add('show'); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}
const readStore = (key, fallback) => { try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; } catch { return fallback; } };
const writeStore = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const escapeHTML = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

// Versi mandiri: semua data disimpan di browser (localStorage), tanpa PHP/MySQL.
const authScreen = $('#authScreen'), appShell = $('#appShell');
const loginForm = $('#loginForm'), registerForm = $('#registerForm');
const loginEmail = $('#loginEmail'), loginPassword = $('#loginPassword');
let currentUser = readStore('mixmatchUser', {name:'Pengguna MixMatch', email:'demo@mixmatch.local'});
let wardrobeItems = readStore('mixmatchWardrobe', []);
let wardrobeQuery = '';

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve('');
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Foto gagal dibaca.'));
    reader.readAsDataURL(file);
  });
}
async function wardrobeRequest(method='GET', action='', payload=null) {
  if (method === 'GET') {
    if (!wardrobeItems.length) {
      wardrobeItems = starterClothes.map((item, index) => ({
        id:index+1, name:item.name, category:item.category,
        color:item.detail, image:item.image
      }));
      writeStore('mixmatchWardrobe', wardrobeItems);
    }
    return {success:true, items:wardrobeItems};
  }
  if (payload instanceof FormData) {
    const id = payload.get('id');
    const name = String(payload.get('name') || '').trim();
    const category = String(payload.get('category') || 'Tops');
    const color = String(payload.get('color') || '').trim();
    const file = payload.get('image');
    const old = wardrobeItems.find(item => String(item.id) === String(id));
    const image = file && file.size ? await fileToDataURL(file) : (old?.image || '');
    if (!name) throw new Error('Nama pakaian wajib diisi.');
    if (action === 'update' && old) {
      wardrobeItems = wardrobeItems.map(item => String(item.id) === String(id) ? {...item,name,category,color,image} : item);
    } else {
      wardrobeItems.push({id:Date.now(),name,category,color,image});
    }
    writeStore('mixmatchWardrobe', wardrobeItems);
    return {success:true,items:wardrobeItems,message:action==='update'?'Pakaian berhasil diperbarui.':'Pakaian berhasil ditambahkan.'};
  }
  if (action === 'delete' && payload) {
    wardrobeItems = wardrobeItems.filter(item => String(item.id) !== String(payload.id));
    writeStore('mixmatchWardrobe', wardrobeItems);
    return {success:true,items:wardrobeItems,message:'Pakaian berhasil dihapus.'};
  }
  throw new Error('Aksi wardrobe tidak dikenali.');
}
async function loadWardrobe(showError=false) {
  try { const result = await wardrobeRequest(); wardrobeItems = result.items || []; if (currentPageName === 'My Wardrobe' || currentPageName === 'Outfit Creator') renderCurrentPage(); }
  catch (error) { if (showError) showToast(error.message); }
}
async function outfitRequest(action='list', payload={}) {
  if (action === 'list') return {success:true,outfits};
  if (action === 'create') {
    const selected = (payload.item_ids || []).map(id => wardrobeItems.find(item => Number(item.id) === Number(id))).filter(Boolean);
    const outfit = {id:Date.now(),name:payload.name,occasion:payload.occasion || '',items:selected};
    outfits.unshift(outfit); writeStore('mixmatchOutfits',outfits);
    return {success:true,outfits,message:'Outfit berhasil disimpan.'};
  }
  if (action === 'delete') {
    outfits = outfits.filter(item => Number(item.id) !== Number(payload.id));
    writeStore('mixmatchOutfits',outfits);
    return {success:true,outfits,message:'Outfit berhasil dihapus.'};
  }
  throw new Error('Aksi outfit tidak dikenali.');
}
async function loadOutfits(showError=false) {
  outfits = readStore('mixmatchOutfits', []);
  if (currentPageName === 'Outfit Creator') renderCurrentPage();
}
async function authRequest(action, payload = {}) {
  if (action === 'me') return {success:true,user:currentUser};
  if (action === 'login' || action === 'register') {
    const user = {name:payload.name || payload.email.split('@')[0], email:payload.email};
    currentUser = user; writeStore('mixmatchUser',user);
    return {success:true,user};
  }
  if (action === 'profile') {
    currentUser = {...currentUser,name:payload.name}; writeStore('mixmatchUser',currentUser);
    return {success:true,user:currentUser};
  }
  if (action === 'logout') {
    currentUser = {name:'Pengguna MixMatch',email:'demo@mixmatch.local'};
    writeStore('mixmatchUser',currentUser);
    return {success:true,user:currentUser};
  }
  throw new Error('Aksi akun tidak dikenali.');
}
function initials(name) { return (name || 'Mix Match').trim().split(/\s+/).slice(0,2).map(s => s[0] || '').join('').toUpperCase() || 'MM'; }
function setAuthMode(mode) {
  const isRegister = mode === 'register';
  loginForm.hidden = isRegister; registerForm.hidden = !isRegister;
  $('#showLoginBtn').classList.toggle('active', !isRegister);
  $('#showRegisterBtn').classList.toggle('active', isRegister);
  $('#showLoginBtn').setAttribute('aria-selected', String(!isRegister));
  $('#showRegisterBtn').setAttribute('aria-selected', String(isRegister));
  $('.auth-card h1').innerHTML = isRegister ? 'Create your <em>account.</em>' : 'Welcome <em>back.</em>';
  $('#authNote').textContent = isRegister ? 'Buat akun untuk mulai menyimpan gaya personalmu.' : 'Masuk dengan akun MixMatch kamu.';
  $('#authError').textContent = ''; $('#registerError').textContent = '';
  iconRefresh();
}
function setAuthenticated(user) {
  currentUser = user || readStore('mixmatchUser', {name:'Pengguna MixMatch',email:'demo@mixmatch.local'});
  // Aplikasi langsung terbuka tanpa halaman login/server.
  authScreen.hidden = true;
  appShell.hidden = false;
  updateDashboardDate();
  loadWardrobe();
  loadOutfits();
  const name = currentUser.name || currentUser.email.split('@')[0];
  $$('.profile-copy strong').forEach(el => el.textContent = name);
  $$('.avatar, .top-avatar').forEach(el => el.textContent = initials(name));
  $('#welcomeTitle').innerHTML = 'Your style, <em>your story.</em>';
  const subtitle = $('.welcome-subtitle');
  if (subtitle) subtitle.textContent = `Hi, ${name.split(' ')[0]}! Let's find something lovely to wear today.`;
  if ($('.top-avatar')) $('.top-avatar').title = name;
  iconRefresh();
}
$('#showLoginBtn').addEventListener('click', () => setAuthMode('login'));
$('#showRegisterBtn').addEventListener('click', () => setAuthMode('register'));
loginForm.addEventListener('submit', async event => {
  event.preventDefault(); const button=loginForm.querySelector('[type="submit"]'); button.disabled=true;
  try {
    const result=await authRequest('login',{email:loginEmail.value.trim(),password:loginPassword.value});
    $('#authError').textContent=''; setAuthenticated(result.user); showToast('Berhasil masuk ke MixMatch!');
  } catch(error) { $('#authError').textContent=error.message; }
  finally { button.disabled=false; }
});
registerForm.addEventListener('submit', async event => {
  event.preventDefault();
  const name=$('#registerName').value.trim(), email=$('#registerEmail').value.trim(), password=$('#registerPassword').value, confirm=$('#registerConfirmPassword').value;
  const error=$('#registerError');
  if(name.length<2){error.textContent='Nama minimal 2 karakter.';return;}
  if(password.length<6){error.textContent='Password minimal 6 karakter.';return;}
  if(password!==confirm){error.textContent='Konfirmasi password belum sama.';return;}
  const button=registerForm.querySelector('[type="submit"]');button.disabled=true;
  try { const result=await authRequest('register',{name,email,password}); error.textContent='';setAuthenticated(result.user);registerForm.reset();showToast('Akun berhasil dibuat. Selamat datang!'); }
  catch(err){error.textContent=err.message;}
  finally{button.disabled=false;}
});
function togglePassword(input, button) {
  const reveal = input.type === 'password'; input.type = reveal ? 'text' : 'password';
  button.innerHTML = `<i data-lucide="${reveal ? 'eye-off' : 'eye'}"></i>`;
  button.setAttribute('aria-label', reveal ? 'Sembunyikan password' : 'Tampilkan password'); iconRefresh();
}
$('#togglePassword').addEventListener('click', () => togglePassword(loginPassword, $('#togglePassword')));
$('#toggleRegisterPassword').addEventListener('click', () => togglePassword($('#registerPassword'), $('#toggleRegisterPassword')));
$('#logoutBtn').addEventListener('click', async () => {
  toggleSidebar(true);
  try { await authRequest('logout',{}); } catch(error) { showToast(error.message); return; }
  setAuthenticated(null); loginForm.reset(); setAuthMode('login'); showToast('Kamu sudah logout.');
});
// Sidebar
const sidebar = $('#sidebar'), sidebarScrim = $('#sidebarScrim');
function toggleSidebar(forceClose = false) {
  const open = forceClose ? false : !sidebar.classList.contains('open');
  sidebar.classList.toggle('open', open); sidebarScrim.classList.toggle('show', open); document.body.classList.toggle('nav-open', open);
}
$('#menuToggle').addEventListener('click', () => toggleSidebar()); sidebarScrim.addEventListener('click', () => toggleSidebar(true));


// Keep dashboard dates aligned with the user's actual local date.
function updateDashboardDate() {
  const now = new Date();
  const dateLabel = $('.welcome-row .eyebrow');
  if (dateLabel) {
    const formatted = now.toLocaleDateString('en-US', {weekday:'long', month:'long', day:'numeric', year:'numeric'}).toUpperCase();
    const line = dateLabel.querySelector('.eyebrow-line');
    dateLabel.innerHTML = `${line ? '<span class="eyebrow-line"></span>' : ''} ${formatted}`;
  }
  const upcomingDate = $('#upcomingDateNumber');
  const upcomingMonth = $('#upcomingDateMonth');
  const upcomingCopy = $('#upcomingDateCopy');
  if (upcomingDate) upcomingDate.textContent = String(now.getDate()).padStart(2, '0');
  if (upcomingMonth) upcomingMonth.textContent = now.toLocaleDateString('en-US', {month:'short'}).toUpperCase();
  if (upcomingCopy) upcomingCopy.textContent = `${now.toLocaleDateString('en-US', {weekday:'long'})} · Today`;
  const footerYear = $('.footer span:first-child');
  if (footerYear) footerYear.textContent = `© ${now.getFullYear()} MixMatch Studio`;
}

// Persistent demo data
const starterClothes = [
  {id:'linen',name:'Linen Shirt',category:'Tops',detail:'Beige · Relaxed fit',image:'https://images.unsplash.com/photo-1598554747436-c9293d6a588f?auto=format&fit=crop&w=620&q=85'},
  {id:'knit',name:'Soft Knit Top',category:'Tops',detail:'Cream · Minimal',image:'https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=620&q=85'},
  {id:'blazer',name:'Relaxed Blazer',category:'Tops',detail:'Camel · Smart casual',image:'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=620&q=85'},
  {id:'tee',name:'Everyday Tee',category:'Tops',detail:'White · Basic essential',image:'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=620&q=85'},
  {id:'jeans',name:'Straight Jeans',category:'Bottoms',detail:'Blue · High waist',image:'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=620&q=85'},
  {id:'trousers',name:'Tailored Trousers',category:'Bottoms',detail:'Taupe · Wide leg',image:'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=620&q=85'},
  {id:'skirt',name:'Midi Skirt',category:'Bottoms',detail:'Neutral · Flowy',image:'https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?auto=format&fit=crop&w=620&q=85'},
  {id:'sneakers',name:'Classic Sneakers',category:'Shoes',detail:'Ivory · Everyday',image:'assets/puma-speedcat.jpg'},
  {id:'loafers',name:'Classic Loafers',category:'Shoes',detail:'Brown · Timeless',image:'https://images.unsplash.com/photo-1533867617858-e7b97e060509?auto=format&fit=crop&w=620&q=85'},
  {id:'tote',name:'Everyday Tote',category:'Accessories',detail:'Brown · Canvas',image:'https://images.unsplash.com/photo-1590879343065-6b7c4b6b6c2b?auto=format&fit=crop&w=620&q=85'},
  {id:'shoulder',name:'Shoulder Bag',category:'Accessories',detail:'Chocolate · Daily bag',image:'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=620&q=85'},
  {id:'sunglasses',name:'Sunglasses',category:'Accessories',detail:'Tortoise · Classic',image:'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=620&q=85'}
];
// Add the expanded sample collection to an existing browser collection without overwriting the user's items.
const savedClothes = readStore('mixmatchClothes', null);
// Keep the user's existing collection, but refresh the bundled demo sneaker image to the requested PUMA Speedcat.
const migratedSavedClothes = savedClothes ? savedClothes.map(item => (item.id === 'sneakers' || item.name === 'Classic Sneakers') ? {...item, image:'assets/puma-speedcat.jpg', name:'PUMA Speedcat', detail:'Black · Retro low-profile'} : item) : null;
let clothes = migratedSavedClothes ? [...starterClothes.filter(item => !migratedSavedClothes.some(saved => saved.id === item.id)), ...migratedSavedClothes] : starterClothes;
let favorites = new Set(readStore('mixmatchFavorites', []));
let outfits = readStore('mixmatchOutfits', []);
let plans = readStore('mixmatchPlans', {});
let activeCategory = 'All';
const searchInput = $('#globalSearch');
const clothingGrid = $('#clothingGrid');
const emptyState = $('#emptyState');
function persistClothes() { writeStore('mixmatchClothes', clothes); writeStore('mixmatchFavorites', [...favorites]); }
function clothingCard(item) {
  const favorite = favorites.has(item.id);
  return `<article class="clothing-card" data-id="${escapeHTML(item.id)}" data-category="${escapeHTML(item.category)}" data-name="${escapeHTML(item.name.toLowerCase())}">
    <div class="clothing-image"><img src="${escapeHTML(item.image || '')}" alt="${escapeHTML(item.name)}" onerror="this.style.display='none'"><button class="favorite-toggle ${favorite?'is-favorite':''}" aria-label="${favorite?'Hapus dari favorit':'Tambah favorit'}" aria-pressed="${favorite}"><i data-lucide="heart"></i></button><span class="item-category">${escapeHTML(item.category.toUpperCase())}</span></div>
    <div class="clothing-info"><div><h3>${escapeHTML(item.name)}</h3><p>${escapeHTML(item.detail || item.category)}</p></div><button class="more-button" aria-label="Hapus item" title="Hapus item"><i data-lucide="trash-2"></i></button></div></article>`;
}
function renderClothes() {
  writeStore('mixmatchClothes', clothes);
  clothingGrid.innerHTML = clothes.slice(0, 8).map(clothingCard).join('');
  const totalItems = $('.stat-value'); if (totalItems) totalItems.innerHTML = `${clothes.length} <span>items</span>`;
  const statValues = $$('.stats-grid .stat-value');
  if (statValues[1]) statValues[1].innerHTML = `${outfits.length} <span>looks</span>`;
  if (statValues[2]) statValues[2].innerHTML = `${Object.keys(plans).length} <span>days</span>`;
  if (statValues[3]) statValues[3].innerHTML = `${favorites.size} <span>items</span>`;
  $$('.filter-chip').forEach(chip => { const count = chip.dataset.filter === 'All' ? clothes.length : clothes.filter(item => item.category === chip.dataset.filter).length; const span = chip.querySelector('span'); if (span) span.textContent = count; });
  const count = $('.nav-count'); if (count) count.textContent = clothes.length;
  bindClothingActions(); filterClothes(); iconRefresh();
}
function bindClothingActions() {
  $$('.favorite-toggle', clothingGrid).forEach(button => button.addEventListener('click', () => {
    const id = button.closest('.clothing-card').dataset.id;
    if (favorites.has(id)) { favorites.delete(id); showToast('Dihapus dari Favorites.'); }
    else { favorites.add(id); showToast('Ditambahkan ke Favorites.'); }
    persistClothes(); renderClothes();
  }));
  $$('.more-button', clothingGrid).forEach(button => button.addEventListener('click', () => {
    const card = button.closest('.clothing-card'), item = clothes.find(cloth => cloth.id === card.dataset.id);
    if (!item) return;
    if (confirm(`Hapus "${item.name}" dari wardrobe?`)) { clothes = clothes.filter(cloth => cloth.id !== item.id); favorites.delete(item.id); persistClothes(); renderClothes(); renderCurrentPage(); showToast('Item berhasil dihapus.'); }
  }));
}
function filterClothes() {
  const query = (searchInput?.value || '').trim().toLowerCase(); let visibleCount = 0;
  $$('.clothing-card', clothingGrid).forEach(card => {
    const isFavoritePage = $('#currentPage').textContent === 'Favorites';
    const visible = (activeCategory === 'All' || card.dataset.category === activeCategory)
      && (card.dataset.name.includes(query) || card.dataset.category.toLowerCase().includes(query) || card.textContent.toLowerCase().includes(query))
      && (!isFavoritePage || favorites.has(card.dataset.id));
    card.hidden = !visible; if (visible) visibleCount++;
  });
  emptyState.hidden = visibleCount > 0;
}
$$('.filter-chip').forEach(chip => chip.addEventListener('click', () => {
  activeCategory = chip.dataset.filter; $$('.filter-chip').forEach(item => item.classList.toggle('active', item === chip)); filterClothes();
}));
searchInput.addEventListener('input', () => { if (currentPageName === 'My Wardrobe') { wardrobeQuery = searchInput.value.trim(); renderCurrentPage(); } else filterClothes(); });

// Page navigation: existing features are shown in useful dedicated views.
function wardrobeCard(item) {
  const image = item.image ? item.image : 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=620&q=80';
  return `<article class="clothing-card wardrobe-db-card" data-wardrobe-id="${Number(item.id)}" data-category="${escapeHTML(item.category)}"><div class="clothing-image"><img src="${escapeHTML(image)}" alt="${escapeHTML(item.name)}" onerror="this.src='https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=620&q=80'"><span class="item-category">${escapeHTML(item.category.toUpperCase())}</span></div><div class="clothing-info"><div><h3>${escapeHTML(item.name)}</h3><p>${escapeHTML(item.color || item.category)}</p></div><div class="wardrobe-card-actions"><button type="button" class="edit-wardrobe-button" data-id="${Number(item.id)}" title="Edit pakaian" aria-label="Edit pakaian"><i data-lucide="pencil"></i></button><button type="button" class="delete-wardrobe-button" data-id="${Number(item.id)}" title="Hapus pakaian" aria-label="Hapus pakaian"><i data-lucide="trash-2"></i></button></div></div></article>`;
}
const dashboardView = $('#dashboardView'), dynamicPageView = $('#dynamicPageView');
let currentPageName = 'Dashboard';
function renderCurrentPage() {
  const page = currentPageName;
  $('#currentPage').textContent = page;
  $$('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.page === page));
  dashboardView.hidden = page !== 'Dashboard'; dynamicPageView.hidden = page === 'Dashboard';
  if (page === 'Dashboard') { filterClothes(); return; }
  let content = '';
  if (page === 'My Wardrobe') {
    const filtered = wardrobeItems.filter(item => (activeCategory === 'All' || item.category === activeCategory) && `${item.name} ${item.category} ${item.color || ''}`.toLowerCase().includes(wardrobeQuery.toLowerCase()));
    content = `<section class="welcome-row"><div><p class="eyebrow">YOUR COLLECTION</p><h1>My <em>Wardrobe.</em></h1><p class="welcome-subtitle">Simpan, cari, dan kelola pakaian yang benar-benar kamu punya.</p></div><button class="primary-button" id="addClothingBtn"><i data-lucide="plus"></i> Tambah pakaian</button></section>
    <section class="section-panel"><div class="section-heading"><div><p class="section-kicker">YOUR PERSONAL COLLECTION</p><h2>Koleksi pakaian (${wardrobeItems.length})</h2></div></div>
    <form class="add-item-form wardrobe-form" id="addClothingForm" enctype="multipart/form-data" hidden><input type="hidden" id="newClothingId" name="id"><input id="newClothingName" name="name" placeholder="Nama pakaian" maxlength="100" required><select id="newClothingCategory" name="category" required><option value="Tops">Tops / Atasan</option><option value="Bottoms">Bottoms / Bawahan</option><option value="Shoes">Shoes / Sepatu</option><option value="Accessories">Accessories / Aksesori</option></select><input id="newClothingDetail" name="color" placeholder="Warna / detail" maxlength="80"><label class="upload-field"><span>Foto pakaian (JPG, PNG, WEBP · maks. 5 MB)</span><input id="newClothingImage" name="image" type="file" accept="image/jpeg,image/png,image/webp"></label><div class="form-actions"><button class="primary-button" id="saveClothingBtn" type="submit">Simpan pakaian</button><button class="secondary-button" id="cancelClothingBtn" type="button">Batal</button></div></form>
    <div class="filter-row">${['All','Tops','Bottoms','Shoes','Accessories'].map(cat=>`<button class="filter-chip ${activeCategory===cat?'active':''}" data-filter="${cat}">${cat==='All'?'Semua item':cat}</button>`).join('')}</div><div class="clothing-grid page-clothing-grid" id="wardrobeGrid">${filtered.map(wardrobeCard).join('')}</div>${filtered.length ? '' : `<p class="empty-state">${wardrobeItems.length ? 'Tidak ada pakaian yang cocok. Coba kategori atau kata kunci lain.' : 'Wardrobe kamu masih kosong. Tambahkan pakaian pertama dan mulai susun gaya personalmu!'}</p>`}</section>`;
  } else if (page === 'Favorites') {
    const favItems = clothes.filter(item => favorites.has(item.id));
    content = `<section class="welcome-row"><div><p class="eyebrow">YOUR MOST-LOVED PIECES</p><h1>Favorite <em>items.</em></h1><p class="welcome-subtitle">Pakaian yang kamu tandai dengan ikon hati ada di sini.</p></div></section><section class="section-panel"><div class="clothing-grid">${favItems.map(clothingCard).join('')}</div>${favItems.length?'':'<p class="empty-state">Belum ada favorit. Klik ikon hati pada pakaian untuk menyimpannya.</p>'}</section>`;
  } else if (page === 'Outfit Creator') {
    const picked = new Set(window.mixmatchSelectedClothes || []);
    const selectable = wardrobeItems;
    content = `<section class="welcome-row"><div><p class="eyebrow">MIX YOUR OWN PIECES</p><h1>Outfit <em>Creator.</em></h1><p class="welcome-subtitle">Pilih pakaian dari wardrobe-mu, padukan, lalu simpan look untuk dipakai lagi.</p></div></section>
    <section class="section-panel outfit-builder-panel"><div class="section-heading"><div><p class="section-kicker">STEP 01 · BUILD YOUR LOOK</p><h2>Pilih pakaianmu</h2><p class="builder-help">Pilih minimal dua item. Item yang kamu tambahkan di My Wardrobe akan muncul di sini.</p></div><span class="selected-count" id="selectedClothesCount">${picked.size} dipilih</span></div>
    ${selectable.length ? `<div class="outfit-picker-grid">${selectable.map(item=>{const id=Number(item.id),img=item.image||'';return `<label class="outfit-pick-card ${picked.has(id)?'is-picked':''}"><input type="checkbox" class="outfit-pick-checkbox" value="${id}" ${picked.has(id)?'checked':''}><span class="pick-check"><i data-lucide="check"></i></span><img src="${escapeHTML(img)}" alt="${escapeHTML(item.name)}" ${img?'':'hidden'} onerror="this.style.display='none'"><span class="pick-item-info"><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(item.category)}${item.color?' · '+escapeHTML(item.color):''}</small></span></label>`}).join('')}</div>` : `<div class="empty-state outfit-empty"><i data-lucide="shirt"></i><h3>Wardrobe kamu masih kosong</h3><p>Tambahkan beberapa pakaian terlebih dahulu supaya kamu bisa mulai meracik outfit.</p><button type="button" class="primary-button" id="goWardrobeBtn">Tambah pakaian</button></div>`}
    <form id="outfitPageForm" class="outfit-save-form"><div class="outfit-form-fields"><label><span>Nama outfit</span><input id="outfitPageName" maxlength="100" placeholder="Contoh: Campus casual" required></label><label><span>Acara / suasana</span><input id="outfitPageOccasion" maxlength="100" placeholder="Kuliah, hangout, kerja..."></label></div><button class="primary-button" type="submit" ${selectable.length?'':'disabled'}><i data-lucide="bookmark-check"></i> Simpan outfit</button></form></section>
    <section class="section-panel saved-outfits-panel"><div class="section-heading"><div><p class="section-kicker">YOUR PERSONAL LOOKBOOK</p><h2>Outfit tersimpan (${outfits.length})</h2></div></div><div class="saved-outfits-grid">${outfits.map(o=>`<article class="saved-outfit outfit-db-card"><div class="saved-outfit-preview">${(o.items||[]).slice(0,3).map(item=>item.image?`<img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.name)}" onerror="this.style.display='none'">`:`<span class="saved-outfit-placeholder"><i data-lucide="shirt"></i></span>`).join('')}</div><span class="stat-icon sand"><i data-lucide="layers-2"></i></span><h3>${escapeHTML(o.name)}</h3><p>${escapeHTML(o.occasion||'Everyday look')}</p><small class="outfit-item-count">${(o.items||[]).length} item pakaian</small><div class="outfit-card-actions"><button type="button" class="text-link view-full-outfit" data-id="${Number(o.id)}">Lihat full outfit ↗</button><button type="button" class="text-link delete-outfit" data-id="${Number(o.id)}">Hapus outfit</button></div></article>`).join('')}</div>${outfits.length?'':'<p class="empty-state">Belum ada outfit tersimpan. Pilih pakaian di atas untuk membuat look pertamamu.</p>'}<div class="full-look-modal" id="fullLookModal" hidden><div class="full-look-backdrop" data-close-full-look></div><section class="full-look-dialog" role="dialog" aria-modal="true" aria-labelledby="fullLookTitle"><button type="button" class="full-look-close" data-close-full-look aria-label="Tutup">×</button><div class="full-look-copy"><p class="section-kicker">YOUR OUTFIT COMBINATION</p><h2 id="fullLookTitle">Full outfit</h2><p id="fullLookOccasion" class="full-look-occasion"></p><p class="full-look-description">Paduan item pilihanmu, disusun seperti flat lay tanpa model.</p><div id="fullLookItemList" class="full-look-item-list"></div></div><div id="fullLookCanvas" class="full-look-canvas" aria-label="Kolase seluruh item outfit"></div></section></div></section>`;
  } else if (page === 'Outfit Calendar') {
    content = `<section class="welcome-row"><div><p class="eyebrow">PLAN YOUR LOOKS</p><h1>Outfit <em>Calendar.</em></h1><p class="welcome-subtitle">Pilih tanggal untuk melihat atau menyimpan rencana outfit.</p></div></section><section class="section-panel calendar-full"><div class="section-heading"><div><p class="section-kicker">YOUR SCHEDULE</p><h2 id="fullCalendarMonth"></h2></div><div><button class="icon-button small" id="fullCalendarPrev" aria-label="Bulan sebelumnya"><i data-lucide="chevron-left"></i></button> <button class="icon-button small" id="fullCalendarNext" aria-label="Bulan berikutnya"><i data-lucide="chevron-right"></i></button></div></div><div id="fullCalendarGrid" class="calendar-grid full-calendar-grid"></div><form id="planForm" class="add-item-form"><input type="date" id="planDate" required><select id="planOutfit" required>${outfits.map(o=>`<option value="${escapeHTML(o.name)}">${escapeHTML(o.name)}</option>`).join('')}</select><button class="primary-button" type="submit" ${outfits.length?'':'disabled'}>Simpan jadwal</button></form><div id="planList" class="plan-list">${renderPlanList()}</div></section>`;
  } else if (page === 'Style Inspiration') {
    content = `<section class="welcome-row"><div><p class="eyebrow">IDE UNTUK HARI INI</p><h1>Style <em>Inspiration.</em></h1><p class="welcome-subtitle">Coba formula sederhana untuk menyusun outfit sehari-hari.</p></div></section><div class="inspiration-grid"><article class="section-panel inspiration-card"><img class="inspiration-photo" src="https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=85" alt="Inspirasi outfit netral sehari-hari"><span class="stat-icon sand"><i data-lucide="sun"></i></span><h2>Neutral everyday</h2><p>Padukan atasan cream, celana jeans, sneakers netral, dan tas cokelat.</p><button class="text-link use-inspiration" data-name="Neutral everyday">Gunakan ide ini →</button></article><article class="section-panel inspiration-card"><img class="inspiration-photo" src="https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=85" alt="Inspirasi gaya casual"><span class="stat-icon blush"><i data-lucide="coffee"></i></span><h2>Casual coffee date</h2><p>Pilih potongan yang nyaman, satu warna utama, dan aksesori sederhana.</p><button class="text-link use-inspiration" data-name="Casual coffee date">Gunakan ide ini →</button></article><article class="section-panel inspiration-card"><img class="inspiration-photo" src="https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?auto=format&fit=crop&w=900&q=85" alt="Inspirasi gaya smart casual"><span class="stat-icon sage"><i data-lucide="briefcase-business"></i></span><h2>Smart campus</h2><p>Kemeja relaxed fit, bawahan rapi, dan sepatu nyaman untuk aktivitas seharian.</p><button class="text-link use-inspiration" data-name="Smart campus">Gunakan ide ini →</button></article></div>`;
  } else if (page === 'Settings' || page === 'Profile') {
    content = `<section class="welcome-row"><div><p class="eyebrow">YOUR ACCOUNT</p><h1>Account <em>settings.</em></h1><p class="welcome-subtitle">Kelola informasi profil yang ditampilkan di MixMatch.</p></div></section><section class="section-panel settings-panel"><form id="profileForm"><label class="auth-label" for="profileName">Nama</label><input class="modal-input" id="profileName" value="${escapeHTML(currentUser?.name || '')}" required><label class="auth-label" for="profileEmail">Email</label><input class="modal-input" id="profileEmail" type="email" value="${escapeHTML(currentUser?.email || '')}" disabled><button class="primary-button" type="submit">Simpan profil</button></form><p class="auth-note">Data profil disimpan secara lokal di browser yang kamu gunakan.</p><button class="logout-button settings-logout" id="settingsLogout"><i data-lucide="log-out"></i> Logout</button></section>`;
  }
  dynamicPageView.innerHTML = content; iconRefresh(); bindPageActions(page);
}
function renderPlanList() {
  const entries = Object.entries(plans).sort(([a],[b])=>a.localeCompare(b));
  if (!entries.length) return '<p class="empty-state">Belum ada jadwal outfit.</p>';
  return entries.map(([date,name])=>`<div class="plan-row"><strong>${escapeHTML(date)}</strong><span>${escapeHTML(name)}</span><button class="text-link remove-plan" data-date="${escapeHTML(date)}">Hapus</button></div>`).join('');
}
function bindPageActions(page) {
  if (page === 'My Wardrobe') {
    const form=$('#addClothingForm');
    $('#addClothingBtn').addEventListener('click', () => { form.hidden=!form.hidden; if(!form.hidden) $('#newClothingName').focus(); });
    $('#cancelClothingBtn').addEventListener('click',()=>{form.reset();$('#newClothingId').value='';$('#saveClothingBtn').textContent='Simpan pakaian';form.hidden=true;});
    form.addEventListener('submit',async e=>{e.preventDefault();const button=$('#saveClothingBtn');button.disabled=true;button.textContent='Menyimpan...';try{const data=new FormData(form);const id=$('#newClothingId').value;const result=await wardrobeRequest('POST',id?'update':'create',data);await loadWardrobe();showToast(result.message); }catch(error){showToast(error.message);}finally{button.disabled=false;button.textContent=$('#newClothingId').value?'Simpan perubahan':'Simpan pakaian';}});
    $$('.filter-chip',dynamicPageView).forEach(chip=>chip.addEventListener('click',()=>{activeCategory=chip.dataset.filter;renderCurrentPage();}));
    $$('.edit-wardrobe-button',dynamicPageView).forEach(button=>button.addEventListener('click',()=>{const item=wardrobeItems.find(x=>Number(x.id)===Number(button.dataset.id));if(!item)return;form.hidden=false;$('#newClothingId').value=item.id;$('#newClothingName').value=item.name;$('#newClothingCategory').value=item.category;$('#newClothingDetail').value=item.color||'';$('#newClothingImage').value='';$('#saveClothingBtn').textContent='Simpan perubahan';$('#newClothingName').focus();form.scrollIntoView({behavior:'smooth',block:'center'});}));
    $$('.delete-wardrobe-button',dynamicPageView).forEach(button=>button.addEventListener('click',async()=>{const item=wardrobeItems.find(x=>Number(x.id)===Number(button.dataset.id));if(!item||!confirm(`Hapus "${item.name}" dari wardrobe?`))return;try{const result=await wardrobeRequest('POST','delete',{id:item.id});await loadWardrobe();showToast(result.message);}catch(error){showToast(error.message);}}));
  }
  if (page === 'Favorites') bindCardsIn(dynamicPageView);
  if (page === 'Outfit Creator') {
    const selected = new Set(window.mixmatchSelectedClothes || []);
    const updateSelection = () => {
      $$('.outfit-pick-checkbox', dynamicPageView).forEach(input => {
        const id=Number(input.value); if(input.checked) selected.add(id); else selected.delete(id);
        input.closest('.outfit-pick-card').classList.toggle('is-picked',input.checked);
      });
      window.mixmatchSelectedClothes=[...selected];
      const counter=$('#selectedClothesCount'); if(counter) counter.textContent=`${selected.size} dipilih`;
    };
    $$('.outfit-pick-checkbox',dynamicPageView).forEach(input=>input.addEventListener('change',updateSelection));
    $('#goWardrobeBtn')?.addEventListener('click',()=>{currentPageName='My Wardrobe';renderCurrentPage();});
    $('#outfitPageForm').addEventListener('submit',async e=>{
      e.preventDefault(); const name=$('#outfitPageName').value.trim(); const occasion=$('#outfitPageOccasion').value.trim();
      const item_ids=[...selected]; if(item_ids.length<2){showToast('Pilih minimal 2 pakaian terlebih dahulu.');return;}
      const button=e.currentTarget.querySelector('[type="submit"]');button.disabled=true;button.innerHTML='<i data-lucide="loader-circle"></i> Menyimpan...';iconRefresh();
      try{const result=await outfitRequest('create',{name,occasion,item_ids});outfits=result.outfits||[];window.mixmatchSelectedClothes=[];renderCurrentPage();showToast(result.message);}
      catch(error){showToast(error.message);button.disabled=false;button.innerHTML='<i data-lucide="bookmark-check"></i> Simpan outfit';iconRefresh();}
    });
    $$('.delete-outfit',dynamicPageView).forEach(btn=>btn.addEventListener('click',async()=>{if(!confirm('Hapus outfit ini?'))return;try{const result=await outfitRequest('delete',{id:Number(btn.dataset.id)});outfits=result.outfits||[];renderCurrentPage();showToast(result.message);}catch(error){showToast(error.message);}}));
    const fullLookModal=$('#fullLookModal',dynamicPageView);
    const closeFullLook=()=>{if(fullLookModal){fullLookModal.hidden=true;if(dynamicPageView && fullLookModal.parentElement===document.body)dynamicPageView.appendChild(fullLookModal);}document.body.classList.remove('full-look-open');};
    $$('[data-close-full-look]',dynamicPageView).forEach(el=>el.addEventListener('click',closeFullLook));
    $$('.view-full-outfit',dynamicPageView).forEach(btn=>btn.addEventListener('click',()=>{
      const outfit=outfits.find(o=>Number(o.id)===Number(btn.dataset.id)); if(!outfit||!fullLookModal)return;
      const items=outfit.items||[];
      $('#fullLookTitle',dynamicPageView).textContent=outfit.name;
      $('#fullLookOccasion',dynamicPageView).textContent=outfit.occasion||'Everyday look';
      const canvas=$('#fullLookCanvas',dynamicPageView);
      const list=$('#fullLookItemList',dynamicPageView);
      const categoryClass=category=>{
        const c=String(category||'').toLowerCase();
        if(c.includes('top')||c.includes('atas'))return 'flat-top';
        if(c.includes('bottom')||c.includes('bawah'))return 'flat-bottom';
        if(c.includes('shoe')||c.includes('sepatu')||c.includes('foot'))return 'flat-shoes';
        return 'flat-accessory';
      };
      const categoryLabel=category=>{
        const c=String(category||'').toLowerCase();
        if(c.includes('top')||c.includes('atas'))return 'Atasan';
        if(c.includes('bottom')||c.includes('bawah'))return 'Bawahan';
        if(c.includes('shoe')||c.includes('sepatu')||c.includes('foot'))return 'Sepatu';
        return 'Aksesori';
      };
      canvas.innerHTML=items.map((item,i)=>`<div class="flat-item ${categoryClass(item.category)}" style="--item-index:${i}">${item.image?`<img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.name)}" onerror="this.parentElement.classList.add('image-missing')">`:'<div class="flat-item-placeholder"><i data-lucide="shirt"></i></div>'}<span>${escapeHTML(item.name)}</span></div>`).join('');
      list.innerHTML=items.map(item=>`<div class="full-look-item-row"><span class="full-look-dot ${categoryClass(item.category)}"></span><div><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(categoryLabel(item.category))}${item.color?' · '+escapeHTML(item.color):''}</small></div></div>`).join('');
      document.body.appendChild(fullLookModal);fullLookModal.hidden=false;document.body.classList.add('full-look-open');iconRefresh();
    }));
  }
  if (page === 'Outfit Calendar') bindFullCalendar();
  if (page === 'Style Inspiration') $$('.use-inspiration').forEach(btn=>btn.addEventListener('click',()=>{window.mixmatchSuggestedOutfit=btn.dataset.name;currentPageName='Outfit Creator';renderCurrentPage();const nameInput=$('#outfitPageName');if(nameInput)nameInput.value=btn.dataset.name;showToast('Pilih pakaian yang ingin dipadukan untuk ide ini.');}));
  if (page === 'Settings' || page === 'Profile') {
    $('#profileForm').addEventListener('submit',async e=>{e.preventDefault();const name=$('#profileName').value.trim();if(!name)return;try{const result=await authRequest('profile',{name});setAuthenticated(result.user);renderCurrentPage();showToast('Profil berhasil diperbarui.');}catch(error){showToast(error.message);}});
    $('#settingsLogout').addEventListener('click',()=>$('#logoutBtn').click());
  }
}
function bindCardsIn(root) {
  $$('.favorite-toggle',root).forEach(button=>button.addEventListener('click',()=>{const id=button.closest('.clothing-card').dataset.id;if(favorites.has(id))favorites.delete(id);else favorites.add(id);persistClothes();renderCurrentPage();renderClothes();showToast(favorites.has(id)?'Ditambahkan ke Favorites.':'Dihapus dari Favorites.');}));
  $$('.more-button',root).forEach(button=>button.addEventListener('click',()=>{const id=button.closest('.clothing-card').dataset.id;const item=clothes.find(c=>c.id===id);if(item&&confirm(`Hapus "${item.name}" dari wardrobe?`)){clothes=clothes.filter(c=>c.id!==id);favorites.delete(id);persistClothes();renderClothes();renderCurrentPage();}}));
}
$$('[data-page]').forEach(button=>button.addEventListener('click',event=>{event.preventDefault();currentPageName=button.dataset.page;toggleSidebar(true);renderCurrentPage();if(currentPageName==='Dashboard')window.scrollTo({top:0,behavior:'smooth'});else window.scrollTo({top:0,behavior:'smooth'});}));

// Outfit modal on the dashboard saves to the same collection as Outfit Creator.
const modalBackdrop=$('#modalBackdrop'), outfitName=$('#outfitName');
function openOutfitModal(){modalBackdrop.hidden=false;outfitName.value='';setTimeout(()=>outfitName.focus(),50);}
function closeOutfitModal(){modalBackdrop.hidden=true;}
$('#createOutfitBtn').addEventListener('click',openOutfitModal);$('#exploreOutfitBtn').addEventListener('click',openOutfitModal);$('#modalClose').addEventListener('click',closeOutfitModal);
modalBackdrop.addEventListener('click',event=>{if(event.target===modalBackdrop)closeOutfitModal();});
$('#saveOutfitBtn').addEventListener('click',()=>{const name=outfitName.value.trim();if(!name){outfitName.focus();showToast('Isi nama outfit terlebih dahulu.');return;}window.mixmatchSuggestedOutfit=name;closeOutfitModal();currentPageName='Outfit Creator';renderCurrentPage();const nameInput=$('#outfitPageName');if(nameInput)nameInput.value=name;showToast('Pilih pakaian untuk melengkapi outfit ini.');});

// Mini calendar and full calendar share saved outfit plans.
let visibleMonth=new Date();
const calendarGrid=$('#calendarGrid'), calendarMonth=$('#calendarMonth');
function dateKey(year,month,day){return `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;}
function renderMiniCalendar(){const year=visibleMonth.getFullYear(),month=visibleMonth.getMonth();calendarMonth.textContent=visibleMonth.toLocaleDateString('id-ID',{month:'long',year:'numeric'});calendarGrid.innerHTML='';
  ['M','S','S','R','K','J','S'].forEach((day,i)=>{const el=document.createElement('span');el.className='calendar-day-name';el.textContent=['M','S','S','R','K','J','S'][i];calendarGrid.appendChild(el);});
  const firstDay=(new Date(year,month,1).getDay()+6)%7, daysInMonth=new Date(year,month+1,0).getDate();
  for(let i=0;i<42;i++){const day=i-firstDay+1;const cell=document.createElement('button');cell.type='button';cell.className='calendar-day';let date;
    if(day<1){date=new Date(year,month,day);cell.classList.add('muted');cell.textContent=date.getDate();}else if(day>daysInMonth){date=new Date(year,month,day);cell.classList.add('muted');cell.textContent=date.getDate();}else{date=new Date(year,month,day);cell.textContent=day;}
    const key=dateKey(date.getFullYear(),date.getMonth(),date.getDate());if(plans[key])cell.classList.add('planned');const now=new Date();if(date.toDateString()===now.toDateString())cell.classList.add('today');
    cell.title=plans[key]?`${plans[key]} — klik untuk detail`:key;cell.addEventListener('click',()=>showToast(plans[key]?`${key}: ${plans[key]}`:`${key}: belum ada outfit terjadwal.`));calendarGrid.appendChild(cell);
  }
}
$('#calendarPrev').addEventListener('click',()=>{visibleMonth=new Date(visibleMonth.getFullYear(),visibleMonth.getMonth()-1,1);renderMiniCalendar();});$('#calendarNext').addEventListener('click',()=>{visibleMonth=new Date(visibleMonth.getFullYear(),visibleMonth.getMonth()+1,1);renderMiniCalendar();});
function bindFullCalendar(){let month=new Date(visibleMonth);const grid=$('#fullCalendarGrid'),label=$('#fullCalendarMonth');function draw(){label.textContent=month.toLocaleDateString('id-ID',{month:'long',year:'numeric'});grid.innerHTML='';['Sen','Sel','Rab','Kam','Jum','Sab','Min'].forEach(d=>{const el=document.createElement('span');el.className='calendar-day-name';el.textContent=d;grid.appendChild(el);});const offset=(new Date(month.getFullYear(),month.getMonth(),1).getDay()+6)%7;const total=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();for(let i=0;i<offset;i++){const spacer=document.createElement('span');grid.appendChild(spacer);}for(let d=1;d<=total;d++){const btn=document.createElement('button');btn.type='button';btn.className='calendar-day';btn.textContent=d;const key=dateKey(month.getFullYear(),month.getMonth(),d);if(plans[key])btn.classList.add('planned');const now=new Date();if(key===dateKey(now.getFullYear(),now.getMonth(),now.getDate()))btn.classList.add('today');btn.addEventListener('click',()=>{$('#planDate').value=key;showToast(plans[key]?`${key}: ${plans[key]}`:`Tanggal ${key} dipilih.`);});grid.appendChild(btn);}}
  $('#fullCalendarPrev').addEventListener('click',()=>{month=new Date(month.getFullYear(),month.getMonth()-1,1);draw();});$('#fullCalendarNext').addEventListener('click',()=>{month=new Date(month.getFullYear(),month.getMonth()+1,1);draw();});
  const dateInput=$('#planDate');dateInput.value=dateKey(new Date().getFullYear(),new Date().getMonth(),new Date().getDate());
  $('#planForm').addEventListener('submit',e=>{e.preventDefault();const date=dateInput.value,name=$('#planOutfit').value;if(!date||!name)return;plans[date]=name;writeStore('mixmatchPlans',plans);$('#planList').innerHTML=renderPlanList();bindRemovePlans();draw();renderMiniCalendar();showToast('Jadwal outfit berhasil disimpan.');});bindRemovePlans();draw();
}
function bindRemovePlans(){$$('.remove-plan').forEach(btn=>btn.addEventListener('click',()=>{delete plans[btn.dataset.date];writeStore('mixmatchPlans',plans);$('#planList').innerHTML=renderPlanList();bindRemovePlans();renderMiniCalendar();showToast('Jadwal dihapus.');}));}
$('#notificationBtn').addEventListener('click',()=>{const total=Object.keys(plans).length;showToast(total?`Kamu punya ${total} jadwal outfit.`:'Belum ada jadwal outfit.');});

// Search shortcut, scroll reveal and initial state.
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeOutfitModal();if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();searchInput.focus();}});
const revealTargets=$$('.welcome-row, .hero-card, .stat-card, .section-panel, .quote-card, .footer, .clothing-card');
revealTargets.forEach((element,index)=>{element.classList.add('reveal-on-scroll');element.style.transitionDelay=`${Math.min(index%4,3)*70}ms`;});
if('IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target);}}),{threshold:.12});revealTargets.forEach(el=>observer.observe(el));}else revealTargets.forEach(el=>el.classList.add('is-visible'));
renderClothes();renderMiniCalendar();updateDashboardDate();setAuthMode('login');setAuthenticated(null);
authRequest('me').then(result=>setAuthenticated(result.user)).catch(()=>setAuthenticated(null));
