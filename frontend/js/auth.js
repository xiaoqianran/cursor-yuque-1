// ========== 全局变量 ==========
const API_BASE_URL = 'http://127.0.0.1:5000/api';

// ========== 页面加载完成后执行 ==========
document.addEventListener('DOMContentLoaded', function() {
    // 检查是否已登录
    checkLoginStatus();
    
    // 绑定登录表单
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // 绑定注册表单
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
});

// ========== 检查登录状态 ==========
async function checkLoginStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/current`, {
            credentials: 'include'
        });
        
        const result = await response.json();
        
        if (result.success) {
            // 已登录，跳转到主页
            window.location.href = 'index.html';
        }
    } catch (error) {
        // 未登录，留在当前页面
        console.log('未登录');
    }
}

// ========== 处理登录 ==========
async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    
    if (!username || !password) {
        alert('请填写完整信息！');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ username, password })
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('登录成功！');
            window.location.href = 'index.html';
        } else {
            alert('登录失败：' + result.message);
        }
    } catch (error) {
        console.error('登录错误:', error);
        alert('登录失败，请检查网络连接！');
    }
}

// ========== 处理注册 ==========
async function handleRegister(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm_password').value;
    
    // 验证
    if (!username || !email || !password || !confirmPassword) {
        alert('请填写完整信息！');
        return;
    }
    
    if (password !== confirmPassword) {
        alert('两次输入的密码不一致！');
        return;
    }
    
    if (password.length < 6) {
        alert('密码长度至少6位！');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ username, email, password })
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('注册成功！');
            window.location.href = 'index.html';
        } else {
            alert('注册失败：' + result.message);
        }
    } catch (error) {
        console.error('注册错误:', error);
        alert('注册失败，请检查网络连接！');
    }
}

