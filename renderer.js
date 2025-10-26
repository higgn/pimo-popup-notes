const { ipcRenderer } = require('electron');

let data = { pages: [], current: 0 };
let isSlid = false;

const textArea = document.getElementById('text-area');
const imageContainer = document.getElementById('image-container');
const container = document.getElementById('container');
const imageModal = document.getElementById('image-modal');
const modalImg = document.getElementById('modal-img');
const closeModal = document.getElementById('close-modal');
const downloadBtn = document.getElementById('download-img');
const homeModal = document.getElementById('home-modal');
const homeList = document.getElementById('home-list');
const closeHome = document.getElementById('close-home');
const slideBtn = document.getElementById('slide-btn');
const smallBtn = document.getElementById('small-btn');
const maxBtn = document.getElementById('max-btn');
const minimizeBtn = document.getElementById('minimize-btn');
const quitBtn = document.getElementById('quit-btn');
const fileInput = document.getElementById('file-input');
const addImgBtn = document.getElementById('add-img-btn');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const exportBtn = document.getElementById('export-btn');
const importBtn = document.getElementById('import-btn');
const importInput = document.getElementById('import-input');
const closeSettings = document.getElementById('close-settings');

// Load data and initialize pages
ipcRenderer.on('load-data', (event, loadedData) => {
  const incoming = loadedData || {};
  // If old format (text/images), convert to single page
  if (incoming.text !== undefined || incoming.images !== undefined) {
    const page = {
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      text: incoming.text || '',
      images: Array.isArray(incoming.images) ? incoming.images : []
    };
    data.pages = [page];
    data.current = 0;
  } else if (Array.isArray(incoming.pages) && incoming.pages.length) {
    data.pages = incoming.pages;
    data.current = incoming.current || 0;
  } else {
    // no data — create an empty page
    data.pages = [{ id: Date.now(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), text: '', images: [] }];
    data.current = 0;
  }

  // Normalize images across pages
  data.pages.forEach(page => {
    if (!Array.isArray(page.images)) page.images = [];
    const normalized = [];
    page.images.forEach(item => {
      if (typeof item === 'string' && item.startsWith('data:')) normalized.push(item);
      else if (typeof item === 'string') {
        try {
          if (item.startsWith('file://') || item.includes('\\') || item.match(/^[A-Za-z]:\\/)) {
            if (item.startsWith('file://')) item = item.replace('file:///', '');
            const p = decodeURI(item);
            if (fs.existsSync(p)) {
              const ext = path.extname(p).toLowerCase();
              const buffer = fs.readFileSync(p);
              let mime = 'image/png';
              if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
              else if (ext === '.gif') mime = 'image/gif';
              else if (ext === '.webp') mime = 'image/webp';
              else if (ext === '.bmp') mime = 'image/bmp';
              const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;
              normalized.push(dataUrl);
            }
          }
        } catch (e) {
          console.warn('Failed to normalize saved image', e);
        }
      }
    });
    page.images = normalized;
  });

  renderPage();
  // indicate saved state on load
  setSaveStatus('saved');
  // settings are now displayed as static info (author: higgn)
});

async function saveData() {
  // update current page timestamps and text
  const p = data.pages[data.current];
  if (p) {
    p.text = textArea.value;
    p.updatedAt = new Date().toISOString();
  }
  // show saving indicator
  setSaveStatus('saving');
  try {
    const res = await ipcRenderer.invoke('save-data', data);
    if (res && res.success) setSaveStatus('saved');
    else setSaveStatus('error');
  } catch (err) {
    console.error('saveData invoke failed', err);
    setSaveStatus('error');
  }
}

// Save status UI
const saveDot = document.getElementById('save-dot');
let saveTimer = null;
function setSaveStatus(state) {
  if (!saveDot) return;
  saveDot.classList.remove('dot-saving', 'dot-saved', 'dot-error');
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (state === 'saving') {
    saveDot.classList.add('dot-saving');
  } else if (state === 'saved') {
    saveDot.classList.add('dot-saved');
    // show saved briefly, then return to idle
    saveTimer = setTimeout(() => {
      saveDot.classList.remove('dot-saved');
      saveTimer = null;
    }, 1800);
  } else if (state === 'error') {
    saveDot.classList.add('dot-error');
    saveTimer = setTimeout(() => {
      saveDot.classList.remove('dot-error');
      saveTimer = null;
    }, 3000);
  }
}

// Auto save every 5 seconds
setInterval(() => {
  saveData();
}, 5000);

// Slide button
slideBtn.addEventListener('click', () => {
  if (isSlid) {
    ipcRenderer.send('restore-window');
    slideBtn.classList.remove('slid');
    isSlid = false;
  } else {
    ipcRenderer.send('slide-window', 'left');
    slideBtn.classList.add('slid');
    isSlid = true;
  }
});

// Page controls
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const newPageBtn = document.getElementById('new-page');
const deletePageBtn = document.getElementById('delete-page');
const homeBtn = document.getElementById('home-btn');
const pageDateEl = document.getElementById('page-date');

function renderPage() {
  // ensure there is at least one page
  if (!Array.isArray(data.pages) || data.pages.length === 0) {
    data.pages = [{ id: Date.now(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), text: '', images: [] }];
    data.current = 0;
  }
  const page = data.pages[data.current];
  if (!page) return;
  textArea.value = page.text || '';
  renderImages();

  const pageInfoEl = document.getElementById('page-info');
  const created = new Date(page.createdAt).toLocaleString();
  if (pageInfoEl) {
    pageInfoEl.innerHTML = `Page ${data.current + 1} — <span id="page-date">${created}</span>`;
  }
}

function addPage() {
  const page = { id: Date.now(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), text: '', images: [] };
  data.pages.push(page);
  data.current = data.pages.length - 1;
  renderPage();
  saveData();
}

function deletePage() {
  if (!confirm('Delete this page? This action cannot be undone.')) return;
  if (!Array.isArray(data.pages) || data.pages.length === 0) return;
  data.pages.splice(data.current, 1);
  // adjust current index
  if (data.current >= data.pages.length) data.current = Math.max(0, data.pages.length - 1);
  // if no pages remain, create one
  if (data.pages.length === 0) {
    data.pages = [{ id: Date.now(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), text: '', images: [] }];
    data.current = 0;
  }
  renderPage();
  saveData();
}

// Open userData folder
if (homeBtn) homeBtn.addEventListener('click', () => {
  // request list of saved files from main
  ipcRenderer.send('list-user-files');
});

// receive list of files and show in home modal
ipcRenderer.on('home-data', (event, files) => {
  if (!homeModal || !homeList) return;
  homeList.innerHTML = '';
  if (!files || files.length === 0) {
    homeList.textContent = 'No saved files found.';
  } else {
    files.forEach(f => {
      const row = document.createElement('div');
      row.className = 'home-row';
      const name = document.createElement('div');
      name.textContent = f.name;
      name.className = 'home-name';
      const meta = document.createElement('div');
      meta.textContent = f.mtime;
      meta.className = 'home-meta';
      const btn = document.createElement('button');
      btn.textContent = 'Reveal';
      btn.addEventListener('click', () => ipcRenderer.send('reveal-file', f.path));
      row.appendChild(name);
      row.appendChild(meta);
      row.appendChild(btn);
      homeList.appendChild(row);
    });
  }
  homeModal.style.display = 'flex';
});

if (deletePageBtn) deletePageBtn.addEventListener('click', deletePage);

function prevPage() {
  if (data.current > 0) {
    data.current -= 1;
    renderPage();
  }
}

function nextPage() {
  if (data.current < data.pages.length - 1) {
    data.current += 1;
    renderPage();
  }
}

if (prevPageBtn) prevPageBtn.addEventListener('click', prevPage);
if (nextPageBtn) nextPageBtn.addEventListener('click', nextPage);
if (newPageBtn) newPageBtn.addEventListener('click', addPage);

// Small button
smallBtn.addEventListener('click', () => {
  ipcRenderer.send('restore-small');
  isSlid = false;
  slideBtn.classList.remove('slid');
});

// Max view button
maxBtn.addEventListener('click', () => {
  ipcRenderer.send('maximize-window');
});

// Minimize button
minimizeBtn.addEventListener('click', () => {
  ipcRenderer.send('minimize-window');
});

// Quit button
quitBtn.addEventListener('click', () => {
  ipcRenderer.send('quit-window');
});

// Drag and drop images (handle files and file:// URIs from Explorer)
const fs = require('fs');
const path = require('path');

function handleFilePathAsDataUrl(filePath) {
  try {
    // normalize file path (strip file://)
    if (filePath.startsWith('file://')) {
      // on Windows, file:///<drive>:/path
      filePath = filePath.replace('file:///', '');
    }
    filePath = decodeURI(filePath);
    if (!fs.existsSync(filePath)) return;
    const ext = path.extname(filePath).toLowerCase();
    const buffer = fs.readFileSync(filePath);
    let mime = 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
    else if (ext === '.gif') mime = 'image/gif';
    else if (ext === '.webp') mime = 'image/webp';
    else if (ext === '.bmp') mime = 'image/bmp';
  const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;
  const page = data.pages[data.current];
  if (page) page.images.push(dataUrl);
  renderImages();
  } catch (err) {
    console.error('Failed to load dropped image', err);
  }
}

async function fetchUrlAsDataUrl(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Network response not ok');
    const contentType = res.headers.get('content-type') || 'image/png';
    const buffer = Buffer.from(await res.arrayBuffer());
  const dataUrl = `data:${contentType};base64,${buffer.toString('base64')}`;
  const page = data.pages[data.current];
  if (page) page.images.push(dataUrl);
  renderImages();
  } catch (err) {
    console.error('Failed to fetch image URL', err);
  }
}

// Reusable drop handler - allows dropping images anywhere in the `container` or on the image area
async function handleDropEvent(e) {
  e.preventDefault();
  e.stopPropagation();

  // ensure a page exists to receive images
  if (!Array.isArray(data.pages) || data.pages.length === 0) {
    data.pages = [{ id: Date.now(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), text: '', images: [] }];
    data.current = 0;
  }

  // Prefer items when available (better support for browser drag of images)
  const items = Array.from(e.dataTransfer.items || []);
  if (items.length) {
    for (const item of items) {
      try {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file && file.type && file.type.startsWith('image/')) {
            const reader = new FileReader();
            await new Promise((resolve) => {
              reader.onload = () => {
                const page = data.pages[data.current];
                if (page) page.images.push(reader.result);
                resolve();
              };
              reader.readAsDataURL(file);
            });
          } else if (file && file.path) {
            handleFilePathAsDataUrl(file.path);
          }
        } else if (item.kind === 'string') {
          // text/html will often contain an <img src="..."> when dragging from a webpage
          if (item.type === 'text/html') {
            await new Promise((resolve) => {
              item.getAsString(async (html) => {
                // try to find an img src
                const m = html && html.match(/<img[^>]+src=["']?([^"' >]+)/i);
                if (m && m[1]) {
                  const src = m[1];
                  if (src.startsWith('data:')) {
                    const page = data.pages[data.current];
                    if (page) page.images.push(src);
                  } else if (src.startsWith('http://') || src.startsWith('https://')) {
                    await fetchUrlAsDataUrl(src);
                  } else if (src.startsWith('file://')) {
                    handleFilePathAsDataUrl(src);
                  }
                } else {
                  // fallback: treat html as possible URI list
                  if (html && (html.startsWith('http://') || html.startsWith('https://') || html.startsWith('file://'))) {
                    if (html.startsWith('http')) await fetchUrlAsDataUrl(html.trim());
                    else handleFilePathAsDataUrl(html.trim());
                  }
                }
                resolve();
              });
            });
          } else if (item.type === 'text/uri-list' || item.type === 'text/plain') {
            await new Promise((resolve) => {
              item.getAsString(async (s) => {
                const lines = s.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                for (const line of lines) {
                  if (line.startsWith('http://') || line.startsWith('https://')) await fetchUrlAsDataUrl(line);
                  else handleFilePathAsDataUrl(line);
                }
                resolve();
              });
            });
          }
        }
      } catch (err) {
        console.warn('Error handling dragged item', err);
      }
    }
    renderImages();
    saveData();
    return;
  }

  // Fallback: plain files list (older behavior)
  const files = Array.from(e.dataTransfer.files || []);
  if (files.length) {
    files.forEach(file => {
      if (file.type && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          const page = data.pages[data.current];
          if (page) page.images.push(reader.result);
          renderImages();
          saveData();
        };
        reader.readAsDataURL(file);
      } else if (file.path) {
        // Electron File object may have a path
        handleFilePathAsDataUrl(file.path);
      }
    });
    return;
  }

  // Some sources (Explorer drag) provide a text/uri-list with file:// URLs
  const uriList = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
  if (uriList) {
    // can contain multiple lines; take each
    const lines = uriList.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      if (line.startsWith('http://') || line.startsWith('https://')) {
        // try to download the image data
        await fetchUrlAsDataUrl(line);
      } else {
        handleFilePathAsDataUrl(line);
      }
    }
    renderImages();
    saveData();
  }
}

// Wire the handler to both the specific image container and the whole app container
imageContainer.addEventListener('drop', handleDropEvent);
if (container) container.addEventListener('drop', handleDropEvent);

// Document-level drop: avoid default navigation when dropping anywhere
document.addEventListener('drop', (e) => {
  e.preventDefault();
  e.stopPropagation();
});

document.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.stopPropagation();
});

// image container dragover visual and dropEffect
imageContainer.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  imageContainer.classList.add('drag-over');
});
imageContainer.addEventListener('dragleave', (e) => {
  imageContainer.classList.remove('drag-over');
});

// Render images
function renderImages() {
  imageContainer.innerHTML = '';
  const page = data.pages[data.current] || { images: [] };
  page.images.forEach((src, index) => {
    const wrap = document.createElement('div');
    wrap.className = 'thumb-wrap';
    const img = document.createElement('img');
    img.src = src;
    img.addEventListener('click', () => {
      modalImg.src = src;
      imageModal.style.display = 'flex';
    });
    const del = document.createElement('button');
    del.className = 'thumb-del';
    del.title = 'Delete image';
    del.textContent = '✕';
    del.addEventListener('click', (ev) => {
      ev.stopPropagation();
      page.images.splice(index, 1);
      renderImages();
      saveData();
    });
    wrap.appendChild(img);
    wrap.appendChild(del);
    imageContainer.appendChild(wrap);
  });
}

// Close modal
closeModal.addEventListener('click', () => {
  imageModal.style.display = 'none';
});

// download image from modal
if (downloadBtn) {
  downloadBtn.addEventListener('click', async () => {
    try {
      const src = modalImg.src;
      if (!src) return;
      const res = await fetch(src);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = blob.type.split('/') && blob.type.split('/')[1] ? blob.type.split('/')[1] : 'png';
      a.download = `pimo-image-${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download image', err);
    }
  });
}

// Prevent drop on textarea from pasting non-image data, but allow image drops
textArea.addEventListener('drop', (e) => {
  // if drop contains files or items that look like images, forward to handler
  const items = Array.from((e.dataTransfer && e.dataTransfer.items) || []);
  const hasImage = items.some(it => it.kind === 'file' || (it.type && (it.type.startsWith('image/') || it.type === 'text/html' || it.type === 'text/uri-list')));
  if (hasImage) {
    handleDropEvent(e);
  } else {
    // otherwise prevent default to stop URL/text from being dropped into textarea
    e.preventDefault();
    e.stopPropagation();
  }
});

// Ctrl+S to save manually (Cmd+S on macOS)
document.addEventListener('keydown', (e) => {
  const key = e.key || e.keyCode;
  const isS = (typeof key === 'string' && key.toLowerCase() === 's') || key === 's' || key === 83;
  if ((e.ctrlKey || e.metaKey) && isS) {
    e.preventDefault();
    setSaveStatus('saving');
    saveData();
  }
});

// File input + add image button
if (addImgBtn && fileInput) {
  addImgBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (ev) => {
    const files = Array.from(ev.target.files || []);
    files.forEach(file => {
      if (file.type && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          const page = data.pages[data.current];
          if (page) page.images.push(reader.result);
          renderImages();
          saveData();
        };
        reader.readAsDataURL(file);
      }
    });
    fileInput.value = '';
  });
}

// Settings modal: export/import
if (settingsBtn && settingsModal) {
  settingsBtn.addEventListener('click', () => { settingsModal.style.display = 'flex'; });
}
if (closeSettings) closeSettings.addEventListener('click', () => { settingsModal.style.display = 'none'; });

if (exportBtn) exportBtn.addEventListener('click', () => {
  // prepare data and trigger download
  saveData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pimo-export-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

if (importBtn && importInput) {
  importBtn.addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', (ev) => {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        // basic validation
        if (imported.pages && Array.isArray(imported.pages)) {
          data = imported;
          data.current = data.current || 0;
          renderPage();
          saveData();
          settingsModal.style.display = 'none';
        } else {
          alert('Imported file does not look like Pimo data.');
        }
      } catch (e) { alert('Failed to import: ' + e.message); }
    };
    reader.readAsText(f);
    importInput.value = '';
  });
}

// Home modal close
if (closeHome) closeHome.addEventListener('click', () => { if (homeModal) homeModal.style.display = 'none'; });

// handle reveal-file errors or confirmations (optional)
ipcRenderer.on('reveal-result', (event, res) => {
  if (!res || !res.success) alert('Failed to reveal file: ' + (res && res.error));
});

// settings modal now contains static information; no save action required