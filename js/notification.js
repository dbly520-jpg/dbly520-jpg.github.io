/**
 * notification.js - 学习通知开关模块
 * 管理通知偏好设置，提供今日学习提醒
 */

const Notification = {
  // LocalStorage 键名
  STORAGE_KEY: 'embedded_learning_notif',

  /**
   * 获取通知开关状态
   * @returns {boolean} 是否开启通知
   */
  isEnabled() {
    try {
      return localStorage.getItem(this.STORAGE_KEY) === 'true';
    } catch (err) {
      return false;
    }
  },

  /**
   * 开启/关闭通知
   * @param {boolean} enabled - 是否开启
   */
  setEnabled(enabled) {
    try {
      localStorage.setItem(this.STORAGE_KEY, enabled ? 'true' : 'false');
    } catch (err) {
      console.error('[Notification] 保存通知设置失败:', err);
    }
  },

  /**
   * 切换通知开关状态
   * @returns {boolean} 切换后的状态
   */
  toggle() {
    const newState = !this.isEnabled();
    this.setEnabled(newState);
    return newState;
  },

  /**
   * 初始化通知按钮UI
   * 查找页面上 class="notif-toggle" 的按钮并绑定事件
   */
  initToggleButton() {
    const buttons = document.querySelectorAll('.notif-toggle');
    buttons.forEach((btn) => {
      this.updateButtonUI(btn);
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const newState = this.toggle();
        this.updateButtonUI(btn);
        // 同步更新页面上其他通知按钮
        document.querySelectorAll('.notif-toggle').forEach((b) => {
          this.updateButtonUI(b);
        });
        // 显示提示
        this.showToast(newState ? '通知已开启，将提醒每日学习' : '通知已关闭');
      });
    });
  },

  /**
   * 更新按钮显示状态
   * @param {HTMLElement} btn - 按钮元素
   */
  updateButtonUI(btn) {
    const enabled = this.isEnabled();
    if (enabled) {
      btn.classList.add('active');
      btn.classList.remove('inactive');
      btn.innerHTML = '&#128276;'; // 铃铛图标
      btn.setAttribute('aria-label', '关闭通知');
    } else {
      btn.classList.add('inactive');
      btn.classList.remove('active');
      btn.innerHTML = '&#128277;'; // 静音铃铛图标
      btn.setAttribute('aria-label', '开启通知');
    }
  },

  /**
   * 显示轻量提示消息
   * @param {string} message - 提示文本
   */
  showToast(message) {
    // 移除已有提示
    const existing = document.querySelector('.notif-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'notif-toast';
    toast.textContent = message;
    toast.style.cssText = [
      'position: fixed',
      'top: 70px',
      'left: 50%',
      'transform: translateX(-50%)',
      'background: rgba(30,41,59,0.9)',
      'color: #fff',
      'padding: 10px 20px',
      'border-radius: 8px',
      'font-size: 14px',
      'z-index: 2000',
      'transition: opacity 0.3s',
      'box-shadow: 0 4px 12px rgba(0,0,0,0.15)'
    ].join(';');
    document.body.appendChild(toast);

    // 2秒后淡出移除
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }
};

// 暴露到全局
window.Notification = Notification;
