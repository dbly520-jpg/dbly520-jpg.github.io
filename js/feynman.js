/**
 * feynman.js - 费曼学习法模块
 * 核心理念：用"教别人"的方式学习，把复杂概念用大白话讲清楚
 *
 * 四步循环：
 *   1. 选定一个概念（系统根据当前学习内容自动提供）
 *   2. 用自己的话解释（假装在教一个完全不懂的人）
 *   3. 自检：哪里卡壳、哪里还在堆术语
 *   4. 回顾简化：用类比 + 大白话重写，可以多次迭代
 *
 * 存储独立于普通笔记，用 feynman_notes 键。
 */

const Feynman = {
  STORAGE_KEY: 'embedded_feynman_notes',

  // 默认自检清单（用户可勾选）
  DEFAULT_CHECKLIST: [
    { id: 'analogy', label: '我用了类比或比喻来解释（比如把 GPIO 比作水龙头开关）', tip: '类比是费曼学习法的灵魂——把陌生的东西接到熟悉的东西上。' },
    { id: 'plain', label: '我没有堆砌术语，而是用大白话讲明白了', tip: '如果你只能用术语复述，说明你还没真正理解。' },
    { id: 'outsider', label: '一个完全没学过的人也能听懂我写的解释', tip: '终极检验：找一个不懂的人（或假装），他能不能看懂。' },
    { id: 'gap', label: '我发现了自己哪里没讲清楚，并标记了疑惑', tip: '讲不清的地方，就是你需要回头补的洞。' }
  ],

  // HTML 转义
  escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  },

  // 读取所有费曼笔记
  getAll() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch (err) {
      console.error('[Feynman] 读取笔记失败:', err);
      return {};
    }
  },

  saveAll(notes) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(notes));
    } catch (err) {
      console.error('[Feynman] 保存笔记失败:', err);
    }
  },

  // 获取某概念的笔记
  getNote(conceptKey) {
    const all = this.getAll();
    return all[conceptKey] || null;
  },

  // 保存解释（同时把上一版推入 history）
  saveExplanation(conceptKey, concept, explanation, checklistState) {
    const all = this.getAll();
    const existing = all[conceptKey];
    const now = new Date().toISOString();

    if (existing) {
      // 把上一版推入历史
      if (!existing.history) existing.history = [];
      existing.history.unshift({
        explanation: existing.explanation,
        checklist: existing.checklist,
        updatedAt: existing.updatedAt
      });
      // 只保留最近 10 版，避免 localStorage 膨胀
      if (existing.history.length > 10) existing.history.length = 10;
      existing.explanation = explanation;
      existing.checklist = checklistState;
      existing.updatedAt = now;
    } else {
      all[conceptKey] = {
        concept: concept,
        explanation: explanation,
        checklist: checklistState,
        updatedAt: now,
        history: []
      };
    }
    this.saveAll(all);
    return all[conceptKey];
  },

  // 标记概念为"已掌握"
  markMastered(conceptKey) {
    const all = this.getAll();
    if (!all[conceptKey]) return false;
    all[conceptKey].mastered = !all[conceptKey].mastered;
    this.saveAll(all);
    return all[conceptKey].mastered;
  },

  isMastered(conceptKey) {
    const note = this.getNote(conceptKey);
    return !!(note && note.mastered);
  },

  // 获取某概念下已完成费曼练习的数量（用于统计）
  countCompleted(prefix) {
    const all = this.getAll();
    let count = 0;
    Object.keys(all).forEach((key) => {
      if (key.indexOf(prefix) === 0 && all[key].explanation && all[key].explanation.trim().length > 0) {
        count++;
      }
    });
    return count;
  },

  /**
   * 渲染一个费曼练习卡片
   * @param {HTMLElement} container - 容器
   * @param {string} conceptKey - 概念唯一键（如 "d5_0" 或 "e2_1_3"）
   * @param {string} concept - 概念标题
   * @param {string[]} hints - 可选的类比/提示词列表
   */
  render(container, conceptKey, concept, hints) {
    if (!container) return;
    const existing = this.getNote(conceptKey);
    const explanation = (existing && existing.explanation) || '';
    const checklist = (existing && existing.checklist) || {};
    const mastered = this.isMastered(conceptKey);
    const historyLen = (existing && existing.history) ? existing.history.length : 0;

    // 自检清单 HTML
    let checklistHtml = '';
    this.DEFAULT_CHECKLIST.forEach((item) => {
      const checked = checklist[item.id] ? 'checked' : '';
      checklistHtml += `
        <label class="feynman-check-item">
          <input type="checkbox" data-check="${this.escapeHtml(item.id)}" ${checked}>
          <span class="feynman-check-text">${this.escapeHtml(item.label)}</span>
          <span class="feynman-check-tip">${this.escapeHtml(item.tip)}</span>
        </label>
      `;
    });

    // 类比提示 HTML
    let hintsHtml = '';
    if (hints && hints.length > 0) {
      hintsHtml = '<div class="feynman-hints">';
      hints.forEach((h) => {
        hintsHtml += `<span class="feynman-hint-chip">${this.escapeHtml(h)}</span>`;
      });
      hintsHtml += '</div>';
    }

    const card = document.createElement('section');
    card.className = 'feynman-card' + (mastered ? ' mastered' : '');
    card.innerHTML = `
      <div class="feynman-header">
        <span class="feynman-icon">🎓</span>
        <div class="feynman-title">费曼学习法 · 用大白话教别人</div>
        <span class="feynman-badge ${mastered ? 'on' : ''}" data-master-badge>${mastered ? '已掌握' : '未掌握'}</span>
      </div>
      <div class="feynman-concept">
        <span class="feynman-concept-label">本次要讲清楚的概念：</span>
        <strong class="feynman-concept-name">${this.escapeHtml(concept)}</strong>
      </div>
      <p class="feynman-instruction">
        假装面前坐着一个完全不懂嵌入式的朋友，<strong>用你自己的话</strong>把这个概念讲给他听。
        不许照抄原文、不许堆术语——能讲明白，才是真的懂。
      </p>
      ${hintsHtml}
      <textarea class="feynman-textarea" placeholder="比如：GPIO 就像家里的电灯开关……我按一下，电路通了，灯就亮了……" data-explanation>${this.escapeHtml(explanation)}</textarea>
      <div class="feynman-save-status" data-save-status>${explanation ? '已保存' : '未保存'}</div>

      <div class="feynman-checklist">
        <div class="feynman-checklist-title">📋 自检清单（写完后逐条问自己）</div>
        ${checklistHtml}
      </div>

      <div class="feynman-actions">
        <button class="btn btn-primary feynman-save" data-action="save">保存这版解释</button>
        <button class="btn btn-secondary feynman-master" data-action="master">${mastered ? '取消掌握' : '我讲明白了 ✓'}</button>
        <button class="btn btn-secondary feynman-history" data-action="history">历史版本 (${historyLen})</button>
      </div>

      <div class="feynman-history-panel" data-history-panel style="display:none;"></div>
    `;

    container.appendChild(card);

    // === 绑定事件 ===
    const textarea = card.querySelector('[data-explanation]');
    const saveStatus = card.querySelector('[data-save-status]');
    let saveTimer = null;

    // 自动保存（防抖 800ms）
    textarea.addEventListener('input', () => {
      saveStatus.textContent = '编辑中…';
      saveStatus.className = 'feynman-save-status editing';
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        this.collectAndSave(card, conceptKey, concept);
      }, 800);
    });

    // 手动保存
    card.querySelector('[data-action="save"]').addEventListener('click', () => {
      this.collectAndSave(card, conceptKey, concept);
      saveStatus.textContent = '已保存 ✓';
      saveStatus.className = 'feynman-save-status saved';
    });

    // 标记掌握
    card.querySelector('[data-action="master"]').addEventListener('click', (e) => {
      // 先保存当前内容
      this.collectAndSave(card, conceptKey, concept);
      const nowMastered = this.markMastered(conceptKey);
      card.classList.toggle('mastered', nowMastered);
      const badge = card.querySelector('[data-master-badge]');
      badge.textContent = nowMastered ? '已掌握' : '未掌握';
      badge.classList.toggle('on', nowMastered);
      e.target.textContent = nowMastered ? '取消掌握' : '我讲明白了 ✓';
    });

    // 历史版本
    card.querySelector('[data-action="history"]').addEventListener('click', () => {
      this.toggleHistory(card, conceptKey);
    });
  },

  // 收集表单数据并保存
  collectAndSave(card, conceptKey, concept) {
    const textarea = card.querySelector('[data-explanation]');
    const explanation = textarea.value;
    const checks = card.querySelectorAll('[data-check]');
    const checklist = {};
    checks.forEach((c) => {
      checklist[c.getAttribute('data-check')] = c.checked;
    });
    this.saveExplanation(conceptKey, concept, explanation, checklist);
  },

  // 切换历史版本面板
  toggleHistory(card, conceptKey) {
    const panel = card.querySelector('[data-history-panel]');
    if (panel.style.display === 'none') {
      const note = this.getNote(conceptKey);
      const history = (note && note.history) || [];
      if (history.length === 0) {
        panel.innerHTML = '<div class="feynman-history-empty">还没有历史版本，多改几次吧~</div>';
      } else {
        let html = '<div class="feynman-history-title">📜 历史版本（最近 10 版）</div>';
        history.forEach((h, idx) => {
          const time = h.updatedAt ? new Date(h.updatedAt).toLocaleString('zh-CN') : '未知时间';
          html += `
            <div class="feynman-history-item">
              <div class="feynman-history-meta">第 ${history.length - idx} 版 · ${this.escapeHtml(time)}</div>
              <div class="feynman-history-text">${this.escapeHtml(h.explanation || '(空)')}</div>
            </div>
          `;
        });
        panel.innerHTML = html;
      }
      panel.style.display = 'block';
    } else {
      panel.style.display = 'none';
    }
  }
};

// 暴露到全局
window.Feynman = Feynman;
