/**
 * reminder.js - 学习时间提醒引擎
 *
 * 设计原则（来自实战经验）：
 *   1. 不做精确分钟匹配，用"跨过阈值后补发"的容错策略
 *      —— 浏览器后台会节流定时器，精确匹配会漏掉提醒
 *   2. 当天去重：每个任务每天只弹一次提醒，避免刷屏
 *   3. 触发顺序：开关 → 去重 → 时间阈值
 *
 * 功能：
 *   - 加载每日时间段任务清单
 *   - 定时检查当前是否有"到点未做"的任务，弹出后果提醒
 *   - 提供首页"今日任务清单"渲染
 *   - 标记任务已完成（与打卡联动）
 */

const Reminder = {
  data: null,
  loaded: false,
  SENT_KEY: 'embedded_reminder_sent',   // 记录今天已弹过提醒的任务ID
  DONE_KEY: 'embedded_reminder_done',   // 记录今天已完成的任务ID
  timer: null,

  // HTML 转义
  escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  },

  /**
   * 加载提醒数据
   */
  async load() {
    if (this.loaded) return this.data;
    try {
      const res = await fetch('./data/reminders.json');
      if (!res.ok) throw new Error('网络响应异常: ' + res.status);
      this.data = await res.json();
      this.loaded = true;
      return this.data;
    } catch (err) {
      console.error('[Reminder] 加载提醒数据失败:', err);
      return null;
    }
  },

  getSchedule() {
    return this.data ? this.data.schedule : [];
  },

  // ====== 日期工具 ======
  todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  },

  // 把 "HH:MM" 转成今天的时间戳
  parseTimeToToday(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.getTime();
  },

  // 当前时间的分钟数（用于和任务时间比较）
  nowMinutes() {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  },

  taskMinutes(task) {
    const [h, m] = task.time.split(':').map(Number);
    return h * 60 + m;
  },

  // ====== 已发送记录（当天去重） ======
  getSentToday() {
    try {
      const raw = localStorage.getItem(this.SENT_KEY);
      if (!raw) return [];
      const obj = JSON.parse(raw);
      if (obj.date !== this.todayStr()) return [];
      return obj.ids || [];
    } catch (e) {
      return [];
    }
  },

  markSent(taskId) {
    const ids = this.getSentToday();
    if (!ids.includes(taskId)) {
      ids.push(taskId);
      localStorage.setItem(this.SENT_KEY, JSON.stringify({ date: this.todayStr(), ids }));
    }
  },

  // ====== 已完成记录 ======
  getDoneToday() {
    try {
      const raw = localStorage.getItem(this.DONE_KEY);
      if (!raw) return [];
      const obj = JSON.parse(raw);
      if (obj.date !== this.todayStr()) return [];
      return obj.ids || [];
    } catch (e) {
      return [];
    }
  },

  markDone(taskId) {
    const ids = this.getDoneToday();
    if (!ids.includes(taskId)) {
      ids.push(taskId);
      localStorage.setItem(this.DONE_KEY, JSON.stringify({ date: this.todayStr(), ids }));
    }
  },

  isDone(taskId) {
    return this.getDoneToday().includes(taskId);
  },

  /**
   * 检查当前是否有到点未做的任务，弹出后果提醒
   * 容错策略：只要当前时间 >= 任务时间，且今天没弹过、没完成，就弹
   */
  checkAndNotify() {
    if (!this.data) return;
    const now = this.nowMinutes();
    const sent = this.getSentToday();

    this.data.schedule.forEach((task) => {
      const taskMin = this.taskMinutes(task);
      // 容错：当前时间跨过任务时间即触发，不要求精确等于
      if (now >= taskMin && !sent.includes(task.id) && !this.isDone(task.id)) {
        this.showReminder(task);
        this.markSent(task.id);
      }
    });
  },

  /**
   * 弹出后果提醒（浏览器通知 + 页面内 toast）
   */
  showReminder(task) {
    const title = '⏰ ' + task.time + ' · ' + task.title + ' 提醒';
    const body = '该做：' + task.task + '\n不做的后果：' + task.consequence_short;

    // 浏览器系统通知
    if (window.Notification && Notification.permission === 'granted') {
      try {
        new Notification(title, { body: body, icon: './icons/icon-192.svg' });
      } catch (e) { /* 忽略 */ }
    }

    // 页面内 toast（无论浏览器通知是否开启都显示）
    this.showToast(task);
  },

  showToast(task) {
    const toast = document.createElement('div');
    toast.className = 'reminder-toast';
    toast.innerHTML = `
      <div class="reminder-toast-head">
        <span class="reminder-toast-icon">${this.escapeHtml(task.icon)}</span>
        <div>
          <div class="reminder-toast-title">${this.escapeHtml(task.time)} · ${this.escapeHtml(task.title)}</div>
          <div class="reminder-toast-task">${this.escapeHtml(task.task)}</div>
        </div>
      </div>
      <div class="reminder-toast-consequence">
        <strong>⚠️ 不做的后果：</strong>${this.escapeHtml(task.consequence_short)}
      </div>
      <div class="reminder-toast-actions">
        <button class="reminder-toast-btn reminder-toast-ignore" data-action="ignore">稍后</button>
        <button class="reminder-toast-btn reminder-toast-done" data-action="done" data-id="${this.escapeHtml(task.id)}">已完成 ✓</button>
      </div>
    `;
    document.body.appendChild(toast);

    // 动画进入
    requestAnimationFrame(() => toast.classList.add('show'));

    // 自动消失（15秒）
    const timer = setTimeout(() => this.dismissToast(toast), 15000);

    toast.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      if (btn.dataset.action === 'done') {
        this.markDone(task.id);
      }
      clearTimeout(timer);
      this.dismissToast(toast);
    });
  },

  dismissToast(toast) {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  },

  /**
   * 启动定时检查（每 60 秒一次，容错）
   */
  start() {
    if (this.timer) return;
    // 立即检查一次
    this.checkAndNotify();
    // 每 60 秒检查（不做精确分钟匹配，跨过即补发）
    this.timer = setInterval(() => this.checkAndNotify(), 60000);
  },

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },

  /**
   * 渲染"今日任务清单"卡片（用于首页）
   * @param {HTMLElement} container
   */
  renderDailyList(container) {
    if (!container) return;
    const schedule = this.getSchedule();
    if (schedule.length === 0) {
      container.innerHTML = '<div class="loading">暂无任务</div>';
      return;
    }

    const now = this.nowMinutes();
    const done = this.getDoneToday();

    let html = '<div class="reminder-list">';
    schedule.forEach((task) => {
      const taskMin = this.taskMinutes(task);
      const isDone = done.includes(task.id);
      const isOverdue = !isDone && now >= taskMin;
      const isCurrent = !isDone && now >= taskMin - 30 && now < taskMin + 60;
      let statusClass = 'pending';
      let statusText = '待完成';
      if (isDone) { statusClass = 'done'; statusText = '已完成'; }
      else if (isOverdue) { statusClass = 'overdue'; statusText = '已逾期'; }
      else if (isCurrent) { statusClass = 'current'; statusText = '进行中'; }

      html += `
        <div class="reminder-item ${statusClass}">
          <div class="reminder-item-time">${this.escapeHtml(task.time)}</div>
          <div class="reminder-item-icon">${this.escapeHtml(task.icon)}</div>
          <div class="reminder-item-body">
            <div class="reminder-item-title">${this.escapeHtml(task.title)}</div>
            <div class="reminder-item-task">${this.escapeHtml(task.task)}</div>
            <div class="reminder-item-duration">⏱ ${this.escapeHtml(task.duration)}</div>
            ${statusClass === 'overdue' ? '<div class="reminder-item-consequence">⚠️ ' + this.escapeHtml(task.consequence_short) + '</div>' : ''}
          </div>
          <div class="reminder-item-status status-${statusClass}">${statusText}</div>
          <button class="reminder-item-check ${isDone ? 'checked' : ''}" data-id="${this.escapeHtml(task.id)}" aria-label="标记完成">
            ${isDone ? '✓' : ''}
          </button>
        </div>
      `;
    });
    html += '</div>';

    container.innerHTML = html;

    // 绑定完成按钮
    container.querySelectorAll('.reminder-item-check').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if (this.isDone(id)) return;
        this.markDone(id);
        // 重新渲染
        this.renderDailyList(container);
      });
    });
  }
};

// 暴露到全局
window.Reminder = Reminder;
