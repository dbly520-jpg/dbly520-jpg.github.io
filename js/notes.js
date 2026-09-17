/**
 * notes.js - 学习笔记自动保存模块
 * 功能：加载已有笔记、输入时自动保存（防抖）、保存状态提示
 */

const Notes = {
  // 防抖定时器
  saveTimer: null,
  // 防抖延迟（毫秒）
  DEBOUNCE_DELAY: 800,
  // 当前天ID
  currentDayId: null,

  /**
   * 初始化笔记区域
   * @param {number} dayId - 全局天ID
   * @param {HTMLElement} textarea - 笔记文本域
   * @param {HTMLElement} statusEl - 状态提示元素
   */
  init(dayId, textarea, statusEl) {
    this.currentDayId = dayId;
    this.textarea = textarea;
    this.statusEl = statusEl;

    // 加载已有笔记
    const existingNote = Progress.getNote(dayId);
    textarea.value = existingNote;

    // 显示初始状态
    this.updateStatus(existingNote ? '已保存' : '可开始记笔记', existingNote ? 'saved' : '');

    // 绑定输入事件（防抖自动保存）
    textarea.addEventListener('input', () => {
      this.updateStatus('正在输入...', '');
      this.scheduleSave();
    });

    // 页面离开前保存
    window.addEventListener('beforeunload', () => {
      this.saveNow();
    });
  },

  /**
   * 安排防抖保存
   */
  scheduleSave() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(() => {
      this.saveNow();
    }, this.DEBOUNCE_DELAY);
  },

  /**
   * 立即保存笔记
   */
  saveNow() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (!this.currentDayId || !this.textarea) return;

    const content = this.textarea.value;
    Progress.saveNote(this.currentDayId, content);
    this.updateStatus('已自动保存', 'saved');
  },

  /**
   * 更新保存状态提示
   * @param {string} text - 状态文本
   * @param {string} className - 附加样式类（saved 等）
   */
  updateStatus(text, className) {
    if (!this.statusEl) return;
    this.statusEl.textContent = text;
    this.statusEl.className = 'notes-status' + (className ? ' ' + className : '');
  }
};

// 暴露到全局
window.Notes = Notes;
