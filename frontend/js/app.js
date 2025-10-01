// ========== 全局变量 ==========
let treeData = { folders: [], documents: [] };
let currentDocId = null;
let currentFolderId = null;
let easyMDE = null;
let autoSaveTimer = null;
let expandedFolders = new Set();  // 记录展开的文件夹

const API_BASE_URL = 'http://127.0.0.1:5000/api';

// ========== 搜索相关变量 ==========
let searchKeyword = '';

// ========== 页面加载完成后执行 ==========
document.addEventListener('DOMContentLoaded', function() {
    console.log('📚 文档系统启动...');

    initMarkdownEditor();
    initSearch();
    initKeyboardShortcuts();
    initTitleEdit();
    loadTreeData();
    bindEvents();
    addStatsBar();

    console.log('✅ 系统初始化完成！');
});

// ========== 初始化 Markdown 编辑器 ==========
function initMarkdownEditor() {
    console.log('初始化 Markdown 编辑器...');
    
    const textarea = document.getElementById('mdEditor');
    
    easyMDE = new EasyMDE({
        element: textarea,
        autofocus: false,
        spellChecker: false,
        placeholder: '开始编写你的文档...',
        toolbar: [
            'bold', 'italic', 'heading', '|',
            'quote', 'unordered-list', 'ordered-list', '|',
            'link', 'image', '|',
            'preview', 'side-by-side', 'fullscreen', '|',
            'guide'
        ],
        status: ['lines', 'words', 'cursor'],
        tabSize: 4,
    });
    
    easyMDE.codemirror.on('change', function() {
        clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(function() {
            if (currentDocId) {
                autoSaveDocument();
            }
        }, 3000);
    });
}

// ========== 加载树形数据 ==========
async function loadTreeData() {
    console.log('📡 加载树形数据...');
    
    try {
        const response = await fetch(`${API_BASE_URL}/tree`);
        const result = await response.json();
        
        if (result.success) {
            treeData = result.data;
            console.log(`✅ 加载成功: ${treeData.folders.length} 个文件夹, ${treeData.documents.length} 个文档`);
            
            renderTree();
            
            // 如果有文档，选中第一个
            if (treeData.documents.length > 0) {
                selectDocument(treeData.documents[0].id);
            } else if (hasAnyDocument(treeData.folders)) {
                // 查找第一个文档
                const firstDoc = findFirstDocument(treeData.folders);
                if (firstDoc) {
                    selectDocument(firstDoc.id);
                }
            } else {
                // 没有文档时创建默认文档
                createDefaultDocument();
            }
        } else {
            console.error('❌ 加载失败:', result.message);
            showNotification('❌ 加载数据失败！');
        }
    } catch (error) {
        console.error('❌ 网络错误:', error);
        showNotification('❌ 无法连接到服务器！');
    }
}

// ========== 检查是否有文档 ==========
function hasAnyDocument(folders) {
    for (const folder of folders) {
        if (folder.documents && folder.documents.length > 0) {
            return true;
        }
        if (folder.children && hasAnyDocument(folder.children)) {
            return true;
        }
    }
    return false;
}

// ========== 查找第一个文档 ==========
function findFirstDocument(folders) {
    for (const folder of folders) {
        if (folder.documents && folder.documents.length > 0) {
            return folder.documents[0];
        }
        if (folder.children) {
            const doc = findFirstDocument(folder.children);
            if (doc) return doc;
        }
    }
    return null;
}

// ========== 渲染树形结构 ==========
function renderTree() {
    console.log('渲染树形结构...');
    
    const container = document.getElementById('treeContainer');
    container.innerHTML = '';
    
    // 渲染根文件夹
    treeData.folders.forEach(folder => {
        const folderElement = createFolderElement(folder);
        container.appendChild(folderElement);
    });
    
    // 渲染根目录文档
    treeData.documents.forEach(doc => {
        const docElement = createDocumentElement(doc);
        container.appendChild(docElement);
    });
    
    if (treeData.folders.length === 0 && treeData.documents.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">暂无内容<br>点击上方按钮创建</div>';
    }
    updateStats();
}

// ========== 创建文件夹元素 ==========
function createFolderElement(folder, level = 0) {
    const item = document.createElement('div');
    item.className = 'tree-item';
    item.style.marginLeft = `${level * 20}px`;
    
    const isExpanded = expandedFolders.has(folder.id);
    
    const node = document.createElement('div');
    node.className = 'tree-node folder';
    node.dataset.folderId = folder.id;
    
    const hasChildren = (folder.children && folder.children.length > 0) || 
                       (folder.documents && folder.documents.length > 0);
    
    node.innerHTML = `
        <span class="tree-toggle ${hasChildren ? '' : 'empty'}">${isExpanded ? '▼' : '▶'}</span>
        <span class="tree-icon">📁</span>
        <span class="tree-label">${folder.name}</span>
    `;
    
    // 点击展开/折叠
    const toggle = node.querySelector('.tree-toggle');
    if (hasChildren) {
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFolder(folder.id);
        });
    }
    
    // 右键菜单
    node.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showContextMenu(e, 'folder', folder.id);
    });
    
    item.appendChild(node);
    
    // 子元素容器
    if (hasChildren) {
        const children = document.createElement('div');
        children.className = `tree-children ${isExpanded ? 'expanded' : ''}`;
        
        // 添加子文件夹
        if (folder.children) {
            folder.children.forEach(childFolder => {
                children.appendChild(createFolderElement(childFolder, 0));
            });
        }
        
        // 添加文档
        if (folder.documents) {
            folder.documents.forEach(doc => {
                children.appendChild(createDocumentElement(doc, 0));
            });
        }
        
        item.appendChild(children);
    }
    
    return item;
}

// ========== 创建文档元素 ==========
function createDocumentElement(doc, level = 0) {
    const item = document.createElement('div');
    item.className = 'tree-item';
    item.style.marginLeft = `${level * 20}px`;
    
    const node = document.createElement('div');
    node.className = 'tree-node document';
    node.dataset.docId = doc.id;
    
    if (doc.id === currentDocId) {
        node.classList.add('active');
    }
    
    node.innerHTML = `
        <span class="tree-toggle empty"></span>
        <span class="tree-icon">📄</span>
        <span class="tree-label">${doc.title}</span>
    `;
    
    // 点击选中文档
    node.addEventListener('click', () => {
        selectDocument(doc.id);
    });
    
    // 右键菜单
    node.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showContextMenu(e, 'document', doc.id);
    });
    
    item.appendChild(node);
    return item;
}

// ========== 展开/折叠文件夹 ==========
function toggleFolder(folderId) {
    if (expandedFolders.has(folderId)) {
        expandedFolders.delete(folderId);
    } else {
        expandedFolders.add(folderId);
    }
    renderTree();
}

// ========== 显示右键菜单 ==========
function showContextMenu(event, type, id) {
    // 移除已存在的菜单
    const existingMenu = document.querySelector('.context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = `${event.clientX}px`;
    menu.style.top = `${event.clientY}px`;
    
    if (type === 'folder') {
        menu.innerHTML = `
            <div class="context-menu-item" data-action="rename">重命名</div>
            <div class="context-menu-item" data-action="delete" class="danger">删除文件夹</div>
        `;
    } else {
        menu.innerHTML = `
            <div class="context-menu-item" data-action="rename">重命名</div>
            <div class="context-menu-divider"></div>
            <div class="context-menu-item danger" data-action="delete">删除文档</div>
        `;
    }
    
    menu.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        if (action === 'rename') {
            if (type === 'folder') {
                renameFolder(id);
            } else {
                renameDocument(id);
            }
        } else if (action === 'delete') {
            if (type === 'folder') {
                deleteFolderById(id);
            } else {
                deleteDocumentById(id);
            }
        }
        menu.remove();
    });
    
    document.body.appendChild(menu);
    
    // 点击其他地方关闭菜单
    setTimeout(() => {
        document.addEventListener('click', function closeMenu() {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        });
    }, 0);
}

// ========== 绑定事件 ==========
function bindEvents() {
    console.log('绑定事件...');

    document.getElementById('btnNewFolder').addEventListener('click', createNewFolder);
    document.getElementById('btnNewDoc').addEventListener('click', createNewDocument);
    document.getElementById('btnSave').addEventListener('click', saveCurrentDocument);
    document.getElementById('btnDelete').addEventListener('click', deleteCurrentDocument);

    // 监听编辑器变化
    easyMDE.codemirror.on('change', function() {
        updateSaveStatus('editing');
        clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(function() {
            if (currentDocId) {
                updateSaveStatus('saving');
                autoSaveDocument();
            }
        }, 3000);
    });
}

// ========== 创建新文件夹 ==========
async function createNewFolder() {
    const name = prompt('请输入文件夹名称：', '新文件夹');
    
    if (!name || name.trim() === '') {
        alert('❌ 文件夹名称不能为空！');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/folders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                name: name.trim(),
                parent_id: currentFolderId 
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            await loadTreeData();
            showNotification('✅ 文件夹创建成功！');
        } else {
            showNotification('❌ 创建失败：' + result.message);
        }
    } catch (error) {
        console.error('❌ 网络错误:', error);
        showNotification('❌ 无法连接到服务器！');
    }
}

// ========== 创建新文档 ==========
async function createNewDocument() {
    const title = prompt('请输入文档标题：', '新文档');
    
    if (!title || title.trim() === '') {
        alert('❌ 文档标题不能为空！');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/documents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: title.trim(),
                content: `# ${title.trim()}\n\n开始编写你的内容...`,
                folder_id: currentFolderId
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            await loadTreeData();
            selectDocument(result.data.id);
            showNotification('✅ 文档创建成功！');
        } else {
            showNotification('❌ 创建失败：' + result.message);
        }
    } catch (error) {
        console.error('❌ 网络错误:', error);
        showNotification('❌ 无法连接到服务器！');
    }
}

// ========== 创建默认文档 ==========
async function createDefaultDocument() {
    const defaultDoc = {
        title: '欢迎使用文档系统',
        content: `# 欢迎使用我的文档系统！ 📚

这是一个类似**语雀**的文档管理系统，现在支持文件夹功能！

## 功能特性 ✨

- ✅ 创建和管理文档
- ✅ 文件夹分类
- ✅ 树形结构显示
- ✅ Markdown 编辑器
- ✅ 实时预览
- ✅ 自动保存
- ✅ 数据库存储

## 开始使用 🚀

1. 点击左上角的 **📁+** 按钮创建文件夹
2. 点击 **📄+** 按钮创建文档
3. 右键点击可以重命名或删除
4. 点击文件夹前的箭头展开/折叠

## Markdown 语法

### 标题
\`\`\`
# 一级标题
## 二级标题
### 三级标题
\`\`\`

### 列表
- 无序列表项 1
- 无序列表项 2

### 代码
\`\`\`python
def hello():
    print("Hello, World!")
\`\`\`

**开始创建你的知识库吧！** 🎉`
    };
    
    try {
        const response = await fetch(`${API_BASE_URL}/documents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(defaultDoc)
        });
        
        const result = await response.json();
        
        if (result.success) {
            await loadTreeData();
            selectDocument(result.data.id);
        }
    } catch (error) {
        console.error('❌ 创建默认文档失败:', error);
    }
}

// ========== 选择文档 ==========
function selectDocument(docId) {
    if (currentDocId === docId) return;

    currentDocId = docId;
    document.getElementById('btnEditTitle').style.display = 'inline-block';
    renderTree();
    showDocument(docId);
}

// ========== 显示文档 ==========
async function showDocument(docId) {
    try {
        const response = await fetch(`${API_BASE_URL}/documents/${docId}`);
        const result = await response.json();
        
        if (result.success) {
            const doc = result.data;
            document.getElementById('currentDocTitle').textContent = doc.title;
            easyMDE.value(doc.content);
            console.log('✅ 文档加载完成');
        } else {
            showNotification('❌ 加载文档失败！');
        }
    } catch (error) {
        console.error('❌ 网络错误:', error);
        showNotification('❌ 无法连接到服务器！');
    }
}

// ========== 保存文档 ==========
async function saveCurrentDocument() {
    if (!currentDocId) {
        alert('❌ 请先选择一个文档！');
        return;
    }

    updateSaveStatus('saving');
    const content = easyMDE.value();

    try {
        const response = await fetch(`${API_BASE_URL}/documents/${currentDocId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });

        const result = await response.json();

        if (result.success) {
            await loadTreeData();
            updateSaveStatus('saved');
            showNotification('💾 文档已保存！');
        } else {
            updateSaveStatus('');
            showNotification('❌ 保存失败：' + result.message);
        }
    } catch (error) {
        updateSaveStatus('');
        console.error('❌ 网络错误:', error);
        showNotification('❌ 无法连接到服务器！');
    }
}

// ========== 自动保存 ==========
async function autoSaveDocument() {
    if (!currentDocId) return;

    const content = easyMDE.value();

    try {
        const response = await fetch(`${API_BASE_URL}/documents/${currentDocId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });

        const result = await response.json();

        if (result.success) {
            await loadTreeData();
            updateSaveStatus('saved');
            showNotification('🔄 已自动保存', 1500);
        }
    } catch (error) {
        console.error('❌ 自动保存失败:', error);
    }
}

// ========== 删除当前文档 ==========
async function deleteCurrentDocument() {
    if (!currentDocId) {
        alert('❌ 请先选择一个文档！');
        return;
    }
    
    if (!confirm(`确定要删除当前文档吗？\n此操作无法撤销！`)) {
        return;
    }
    
    await deleteDocumentById(currentDocId);
}

// ========== 删除文档（通过ID） ==========
async function deleteDocumentById(docId) {
    try {
        const response = await fetch(`${API_BASE_URL}/documents/${docId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            if (currentDocId === docId) {
                currentDocId = null;
                document.getElementById('currentDocTitle').textContent = '选择一个文档开始编辑';
                easyMDE.value('');
            }
            
            await loadTreeData();
            showNotification('🗑️ 文档已删除！');
        } else {
            showNotification('❌ 删除失败：' + result.message);
        }
    } catch (error) {
        console.error('❌ 网络错误:', error);
        showNotification('❌ 无法连接到服务器！');
    }
}

// ========== 重命名文档 ==========
async function renameDocument(docId) {
    const newTitle = prompt('请输入新标题：');
    
    if (!newTitle || newTitle.trim() === '') {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/documents/${docId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newTitle.trim() })
        });
        
        const result = await response.json();
        
        if (result.success) {
            await loadTreeData();
            if (currentDocId === docId) {
                document.getElementById('currentDocTitle').textContent = newTitle.trim();
            }
            showNotification('✅ 重命名成功！');
        } else {
            showNotification('❌ 重命名失败：' + result.message);
        }
    } catch (error) {
        console.error('❌ 网络错误:', error);
        showNotification('❌ 无法连接到服务器！');
    }
}

// ========== 删除文件夹 ==========
async function deleteFolderById(folderId) {
    if (!confirm('确定要删除此文件夹吗？\n文件夹必须为空才能删除！')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/folders/${folderId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            await loadTreeData();
            showNotification('🗑️ 文件夹已删除！');
        } else {
            showNotification('❌ ' + result.message);
        }
    } catch (error) {
        console.error('❌ 网络错误:', error);
        showNotification('❌ 无法连接到服务器！');
    }
}

// ========== 重命名文件夹 ==========
async function renameFolder(folderId) {
    const newName = prompt('请输入新名称：');
    
    if (!newName || newName.trim() === '') {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/folders/${folderId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName.trim() })
        });
        
        const result = await response.json();
        
        if (result.success) {
            await loadTreeData();
            showNotification('✅ 重命名成功！');
        } else {
            showNotification('❌ 重命名失败：' + result.message);
        }
    } catch (error) {
        console.error('❌ 网络错误:', error);
        showNotification('❌ 无法连接到服务器！');
    }
}

// ========== 显示通知 ==========
function showNotification(message, duration = 2000) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, duration);
}

// ========== 初始化搜索功能 ==========
function initSearch() {
    const searchInput = document.getElementById('searchInput');
    const btnClearSearch = document.getElementById('btnClearSearch');

    // 实时搜索
    searchInput.addEventListener('input', function(e) {
        searchKeyword = e.target.value.trim().toLowerCase();

        if (searchKeyword) {
            btnClearSearch.style.display = 'block';
            filterTree();
        } else {
            btnClearSearch.style.display = 'none';
            renderTree();
        }
    });

    // 清除搜索
    btnClearSearch.addEventListener('click', function() {
        searchInput.value = '';
        searchKeyword = '';
        btnClearSearch.style.display = 'none';
        renderTree();
    });

    // 按 ESC 键清除搜索
    searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            searchInput.value = '';
            searchKeyword = '';
            btnClearSearch.style.display = 'none';
            renderTree();
        }
    });
}

// ========== 过滤树形结构 ==========
function filterTree() {
    const container = document.getElementById('treeContainer');
    container.innerHTML = '';

    let hasResults = false;

    // 搜索根文档
    treeData.documents.forEach(doc => {
        if (doc.title.toLowerCase().includes(searchKeyword)) {
            const docElement = createDocumentElement(doc);
            highlightText(docElement, searchKeyword);
            container.appendChild(docElement);
            hasResults = true;
        }
    });

    // 搜索文件夹中的文档
    treeData.folders.forEach(folder => {
        const results = searchInFolder(folder);
        results.forEach(item => {
            container.appendChild(item);
            hasResults = true;
        });
    });

    if (!hasResults) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🔍</div>
                <div class="empty-state-text">
                    未找到匹配的文档<br>
                    关键词：<strong>${searchKeyword}</strong>
                </div>
            </div>
        `;
    }
}

// ========== 在文件夹中搜索 ==========
function searchInFolder(folder) {
    const results = [];

    // 搜索当前文件夹的文档
    if (folder.documents) {
        folder.documents.forEach(doc => {
            if (doc.title.toLowerCase().includes(searchKeyword)) {
                const docElement = createDocumentElement(doc);
                highlightText(docElement, searchKeyword);

                // 添加路径提示
                const pathHint = document.createElement('div');
                pathHint.style.fontSize = '11px';
                pathHint.style.color = '#999';
                pathHint.style.marginLeft = '44px';
                pathHint.textContent = `位于: 📁 ${folder.name}`;
                docElement.appendChild(pathHint);

                results.push(docElement);
            }
        });
    }

    // 递归搜索子文件夹
    if (folder.children) {
        folder.children.forEach(childFolder => {
            const childResults = searchInFolder(childFolder);
            results.push(...childResults);
        });
    }

    return results;
}

// ========== 高亮搜索关键词 ==========
function highlightText(element, keyword) {
    const label = element.querySelector('.tree-label');
    if (label) {
        const text = label.textContent;
        const regex = new RegExp(`(${keyword})`, 'gi');
        label.innerHTML = text.replace(regex, '<span class="highlight">$1</span>');
    }
}

// ========== 快捷键支持 ==========
function initKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        // Ctrl/Cmd + S: 保存
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            if (currentDocId) {
                saveCurrentDocument();
            }
        }

        // Ctrl/Cmd + N: 新建文档
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            createNewDocument();
        }

        // Ctrl/Cmd + F: 聚焦搜索框
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            document.getElementById('searchInput').focus();
        }
    });
}

// ========== 标题内联编辑 ==========
function initTitleEdit() {
    const btnEditTitle = document.getElementById('btnEditTitle');
    const titleElement = document.getElementById('currentDocTitle');

    btnEditTitle.addEventListener('click', function() {
        if (!currentDocId) return;

        const currentTitle = titleElement.textContent;
        const newTitle = prompt('请输入新标题：', currentTitle);

        if (newTitle && newTitle.trim() !== '' && newTitle !== currentTitle) {
            renameDocument(currentDocId);
        }
    });
}

// ========== 保存状态指示器 ==========
function updateSaveStatus(status) {
    const statusElement = document.getElementById('saveStatus');

    switch(status) {
        case 'editing':
            statusElement.textContent = '编辑中...';
            statusElement.className = 'save-status';
            break;
        case 'saving':
            statusElement.textContent = '保存中...';
            statusElement.className = 'save-status saving';
            break;
        case 'saved':
            statusElement.textContent = '✓ 已保存';
            statusElement.className = 'save-status saved';
            setTimeout(() => {
                statusElement.textContent = '';
            }, 2000);
            break;
        default:
            statusElement.textContent = '';
            statusElement.className = 'save-status';
    }
}

// ========== 添加统计栏 ==========
function addStatsBar() {
    const sidebar = document.querySelector('.sidebar');
    const statsBar = document.createElement('div');
    statsBar.className = 'stats-bar';
    statsBar.id = 'statsBar';

    sidebar.appendChild(statsBar);
    updateStats();
}

// ========== 更新统计信息 ==========
function updateStats() {
    const statsBar = document.getElementById('statsBar');
    if (!statsBar) return;

    let folderCount = countFolders(treeData.folders);
    let docCount = treeData.documents.length + countDocuments(treeData.folders);

    statsBar.innerHTML = `
        <div class="stat-item">
            <span>📁 ${folderCount} 个文件夹</span>
        </div>
        <div class="stat-item">
            <span>📄 ${docCount} 个文档</span>
        </div>
    `;
}

// ========== 计数函数 ==========
function countFolders(folders) {
    let count = folders.length;
    folders.forEach(folder => {
        if (folder.children) {
            count += countFolders(folder.children);
        }
    });
    return count;
}

function countDocuments(folders) {
    let count = 0;
    folders.forEach(folder => {
        if (folder.documents) {
            count += folder.documents.length;
        }
        if (folder.children) {
            count += countDocuments(folder.children);
        }
    });
    return count;
}
