/**
 * app.js - 首页逻辑模块
 * 负责：渲染Hero进度区、月份/周卡片、今日推荐、注册Service Worker
 */

(function () {
  'use strict';

  /**
   * 页面初始化入口
   */
  async function init() {
    // 初始化通知按钮
    Notification.initToggleButton();

    // 加载课程数据
    try {
      await CourseData.load();
      renderHero();
      renderStats();
      renderReminderList();
      renderMonths();
      renderTodayRecommend();
      // 启动提醒引擎
      if (window.Reminder) {
        Reminder.load().then(() => Reminder.start());
      }
    } catch (err) {
      const main = document.getElementById('main-content');
      if (main) {
        main.innerHTML = '<div class="error-msg">课程数据加载失败，请检查网络或刷新重试。<br>' + err.message + '</div>';
      }
    }
  }

  /**
   * 渲染 Hero 区域（总进度）
   */
  function renderHero() {
    const course = CourseData.getCourseInfo();
    const totalDays = CourseData.getTotalDays();
    const completed = Progress.getCompletedCount();
    const percent = Progress.getOverallProgress(totalDays);

    const heroEl = document.getElementById('hero-area');
    if (!heroEl) return;

    heroEl.innerHTML = `
      <h1>${course.title}</h1>
      <p>${course.subtitle}</p>
      <div class="hero-progress">
        <div class="hero-progress-text">总进度：已完成 ${completed} / ${totalDays} 天</div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${percent}%"></div>
        </div>
        <div class="hero-progress-text mt-16">${percent}%</div>
      </div>
    `;
  }

  /**
   * 渲染月份卡片区（含每周卡片）
   */
  function renderMonths() {
    const container = document.getElementById('months-container');
    if (!container) return;

    const months = CourseData.getMonths();
    container.innerHTML = '';

    months.forEach((month) => {
      const monthSection = document.createElement('section');
      monthSection.className = 'month-section';

      // 月份标题（可折叠）
      const header = document.createElement('div');
      header.className = 'month-header';
      header.innerHTML = `
        <span class="toggle">▼</span>
        <h2>${month.title} · ${month.theme}</h2>
        <span class="month-badge">${month.weeks.length}周</span>
      `;
      // 点击折叠/展开
      header.addEventListener('click', () => {
        monthSection.classList.toggle('collapsed');
      });
      monthSection.appendChild(header);

      // 周卡片网格
      const weekGrid = document.createElement('div');
      weekGrid.className = 'week-grid';

      month.weeks.forEach((week) => {
        weekGrid.appendChild(createWeekCard(week));
      });

      monthSection.appendChild(weekGrid);
      container.appendChild(monthSection);
    });
  }

  /**
   * 创建单个周卡片
   * @param {Object} week - 周数据
   * @returns {HTMLElement}
   */
  function createWeekCard(week) {
    const card = document.createElement('a');
    card.className = 'week-card';
    card.href = `./week.html?week=${week.id}`;

    // 计算本周进度
    const dayIds = week.days.map((d) => d.id);
    const weekProgress = Progress.getWeekProgress(dayIds);

    card.innerHTML = `
      <div class="week-number">${week.title}</div>
      <div class="week-theme">${week.theme}</div>
      <div class="week-goal">${week.goal}</div>
      <div class="week-progress">
        <div class="week-progress-bar">
          <div class="week-progress-fill" style="width: ${weekProgress.percent}%"></div>
        </div>
        <span class="week-progress-text">${weekProgress.completed}/${weekProgress.total}</span>
      </div>
    `;

    return card;
  }

  /**
   * 渲染学习数据统计卡片
   */
  function renderStats() {
    const totalDays = CourseData.getTotalDays();
    const completed = Progress.getCompletedCount();
    const daysEl = document.getElementById('stat-days');
    const streakEl = document.getElementById('stat-streak');
    const feynmanEl = document.getElementById('stat-feynman');
    const exercisesEl = document.getElementById('stat-exercises');

    if (daysEl) daysEl.textContent = completed;

    // 连续打卡：从已完成的天 ID 中找最大连续段
    if (streakEl) {
      const progress = Progress.getProgress();
      const doneIds = Object.keys(progress)
        .filter((k) => progress[k] === true)
        .map((k) => parseInt(k))
        .sort((a, b) => a - b);
      let streak = 0;
      if (doneIds.length > 0) {
        let cur = 1;
        for (let i = 1; i < doneIds.length; i++) {
          if (doneIds[i] === doneIds[i - 1] + 1) {
            cur++;
          } else {
            streak = Math.max(streak, cur);
            cur = 1;
          }
        }
        streak = Math.max(streak, cur);
      }
      streakEl.textContent = streak;
    }

    // 费曼笔记数量
    if (feynmanEl && window.Feynman) {
      feynmanEl.textContent = Object.keys(Feynman.getAll()).length;
    } else if (feynmanEl) {
      feynmanEl.textContent = 0;
    }

    // 已做练习题数（取 localStorage 里的练习记录，没有则显示打卡天数估算）
    if (exercisesEl) {
      try {
        const quizData = localStorage.getItem('embedded_quiz_history');
        const count = quizData ? Object.keys(JSON.parse(quizData)).length : 0;
        exercisesEl.textContent = count || completed;
      } catch (e) {
        exercisesEl.textContent = completed;
      }
    }
  }

  /**
   * 渲染今日任务清单
   */
  async function renderReminderList() {
    const container = document.getElementById('reminder-list-container');
    const progressText = document.getElementById('reminder-progress-text');
    if (!container) return;

    if (window.Reminder) {
      await Reminder.load();
      Reminder.renderDailyList(container);
      // 更新进度
      const done = Reminder.getDoneToday().length;
      const total = Reminder.getSchedule().length;
      if (progressText) progressText.textContent = done + '/' + total;
    }
  }

  /**
   * 渲染今日推荐区域
   */
  function renderTodayRecommend() {
    const container = document.getElementById('today-recommend');
    if (!container) return;

    const totalDays = CourseData.getTotalDays();
    const completed = Progress.getCompletedCount();

    // 推荐学习天数 = 已完成天数 + 1（不超总数）
    const recommendDay = Math.min(completed + 1, totalDays);

    // 查找推荐天对应的数据
    const dayData = CourseData.getDayByGlobalId(recommendDay);
    if (!dayData) {
      container.style.display = 'none';
      return;
    }

    if (completed >= totalDays) {
      // 全部完成
      container.innerHTML = `
        <h3>🎉 恭喜！全部 ${totalDays} 天学习已完成！</h3>
        <p>你已完成了整个嵌入式学习之旅，回顾知识巩固提升吧！</p>
        <a href="./day.html?week=1&day=1" class="btn btn-primary">复习第1天</a>
      `;
      return;
    }

    container.innerHTML = `
      <h3>📌 今日推荐学习</h3>
      <p>第${dayData.weekId}周 第${dayData.dayInWeek}天：${dayData.title}</p>
      <a href="./day.html?week=${dayData.weekId}&day=${dayData.dayInWeek}" class="btn btn-primary">开始今日学习</a>
    `;
  }

  /**
   * 注册 Service Worker（仅首页注册）
   */
  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('./sw.js')
          .then((reg) => {
            console.log('[App] Service Worker 注册成功，范围:', reg.scope);
          })
          .catch((err) => {
            console.warn('[App] Service Worker 注册失败:', err);
          });
      });
    }
  }

  // 启动初始化
  document.addEventListener('DOMContentLoaded', () => {
    init();
    registerServiceWorker();
  });
})();
