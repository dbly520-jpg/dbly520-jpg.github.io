/**
 * english.js - 嵌入式英语学习模块
 * 功能：词汇卡片（翻面记忆）、词汇测试、句型展示、学习进度跟踪
 */

// ====== 英语数据加载与管理 ======
const EnglishData = {
  data: null,
  loaded: false,

  async load() {
    if (this.loaded) return this.data;
    try {
      const response = await fetch('./data/english.json');
      if (!response.ok) {
        throw new Error('网络响应异常: ' + response.status);
      }
      this.data = await response.json();
      this.loaded = true;
      return this.data;
    } catch (err) {
      console.error('[EnglishData] 加载英语数据失败:', err);
      throw err;
    }
  },

  getCourse() {
    return this.data ? this.data.course : null;
  },

  getLevels() {
    return this.data ? this.data.course.levels : [];
  },

  getLevel(levelId) {
    const levels = this.getLevels();
    return levels.find((l) => l.id === levelId) || null;
  },

  getLesson(levelId, lessonId) {
    const level = this.getLevel(levelId);
    if (!level) return null;
    return level.lessons.find((ls) => ls.id === lessonId) || null;
  }
};

// ====== 英语学习进度管理（独立存储键，与课程进度分离） ======
const EnglishProgress = {
  STORAGE_KEY: 'embedded_english_progress',

  getProgress() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch (err) {
      console.error('[EnglishProgress] 读取进度失败:', err);
      return {};
    }
  },

  saveProgress(progress) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(progress));
    } catch (err) {
      console.error('[EnglishProgress] 保存进度失败:', err);
    }
  },

  // 生成课程唯一键
  lessonKey(levelId, lessonId) {
    return 'L' + levelId + '_' + lessonId;
  },

  // 标记单词已学习（通过索引记录已学单词集合）
  markWordLearned(levelId, lessonId, wordIdx) {
    const progress = this.getProgress();
    const key = this.lessonKey(levelId, lessonId);
    if (!progress[key]) progress[key] = { learned: [], quizScore: 0 };
    if (!progress[key].learned.includes(wordIdx)) {
      progress[key].learned.push(wordIdx);
    }
    this.saveProgress(progress);
  },

  // 获取某课已学单词索引
  getLearnedWords(levelId, lessonId) {
    const progress = this.getProgress();
    const key = this.lessonKey(levelId, lessonId);
    return progress[key] && progress[key].learned ? progress[key].learned : [];
  },

  // 保存某课测验得分
  saveQuizScore(levelId, lessonId, score) {
    const progress = this.getProgress();
    const key = this.lessonKey(levelId, lessonId);
    if (!progress[key]) progress[key] = { learned: [], quizScore: 0 };
    if (score > (progress[key].quizScore || 0)) {
      progress[key].quizScore = score;
    }
    this.saveProgress(progress);
  },

  getQuizScore(levelId, lessonId) {
    const progress = this.getProgress();
    const key = this.lessonKey(levelId, lessonId);
    return progress[key] && progress[key].quizScore ? progress[key].quizScore : 0;
  },

  // 判断课程是否完成（已学完所有单词且测验合格）
  isLessonComplete(levelId, lessonId, totalWords) {
    const learned = this.getLearnedWords(levelId, lessonId);
    const score = this.getQuizScore(levelId, lessonId);
    return learned.length >= totalWords && score >= 60;
  },

  // 获取级别整体进度
  getLevelProgress(level) {
    if (!level || !level.lessons) return { completed: 0, total: 0, percent: 0 };
    let completed = 0;
    const total = level.lessons.length;
    level.lessons.forEach((lesson) => {
      const totalWords = lesson.words ? lesson.words.length : 0;
      if (this.isLessonComplete(level.id, lesson.id, totalWords)) completed++;
    });
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { completed, total, percent };
  },

  // 获取全部进度
  getOverallProgress() {
    const levels = EnglishData.getLevels();
    if (!levels || levels.length === 0) return { completed: 0, total: 0, percent: 0 };
    let completed = 0;
    let total = 0;
    levels.forEach((level) => {
      const p = this.getLevelProgress(level);
      completed += p.completed;
      total += p.total;
    });
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { completed, total, percent };
  }
};

// ====== 英语学习主应用 ======
const EnglishApp = {
  // HTML 转义
  escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  },

  // 获取 URL 参数
  getParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      levelId: parseInt(params.get('level')) || 0,
      lessonId: parseInt(params.get('lesson')) || 0,
      action: params.get('action') || ''
    };
  },

  // 主入口：根据参数路由到不同视图
  async render() {
    const container = document.getElementById('main-content');
    if (!container) return;

    try {
      await EnglishData.load();
      // 启动提醒引擎
      if (window.Reminder) {
        Reminder.load().then(() => Reminder.start());
      }
    } catch (err) {
      container.innerHTML = '<div class="error-msg">英语数据加载失败: ' + this.escapeHtml(err.message) + '</div>';
      return;
    }

    const { levelId, lessonId, action } = this.getParams();

    if (levelId && lessonId) {
      // 渲染某课详情
      this.renderLessonView(container, levelId, lessonId);
    } else if (levelId) {
      // 渲染某级别详情
      this.renderLevelView(container, levelId);
    } else {
      // 渲染首页（级别列表）
      this.renderHomeView(container);
    }
  },

  // ====== 首页：级别列表 ======
  renderHomeView(container) {
    const course = EnglishData.getCourse();
    const levels = EnglishData.getLevels();
    const overall = EnglishProgress.getOverallProgress();

    let html = `
      <section class="english-hero">
        <h1>嵌入式英语学习</h1>
        <p>${this.escapeHtml(course.description)}</p>
        <div class="english-overall">
          <div class="progress-bar light">
            <div class="progress-fill" style="width:${overall.percent}%"></div>
          </div>
          <div class="progress-label">
            <span>总进度</span>
            <span>${overall.completed} / ${overall.total} 课 · ${overall.percent}%</span>
          </div>
        </div>
      </section>

      <section class="english-levels">
        <h2 class="section-title"><span class="icon">📚</span> 学习单元</h2>
        <div class="english-level-list">
    `;

    levels.forEach((level) => {
      const p = EnglishProgress.getLevelProgress(level);
      html += `
        <a class="card card-link english-level-card" href="./english.html?level=${level.id}">
          <div class="card-subtitle">第 ${level.id} 阶段 · 共 ${level.lessons.length} 课</div>
          <div class="card-title">${this.escapeHtml(level.title)}</div>
          <p class="english-level-goal">${this.escapeHtml(level.goal)}</p>
          <div class="week-progress">
            <div class="week-progress-bar">
              <div class="week-progress-fill" style="width:${p.percent}%"></div>
            </div>
            <span class="week-progress-text">${p.completed}/${p.total} 课</span>
          </div>
        </a>
      `;
    });

    html += `
        </div>
      </section>
    `;
    container.innerHTML = html;
  },

  // ====== 级别详情：课程列表 ======
  renderLevelView(container, levelId) {
    const level = EnglishData.getLevel(levelId);
    if (!level) {
      container.innerHTML = '<div class="error-msg">未找到该阶段</div>';
      return;
    }
    const p = EnglishProgress.getLevelProgress(level);

    let html = `
      <section class="english-breadcrumb">
        <a href="./english.html">英语学习</a> › <span>${this.escapeHtml(level.title)}</span>
      </section>

      <section class="card mb-16">
        <div class="card-subtitle">第 ${level.id} 阶段</div>
        <h1 style="font-size:22px;font-weight:800;">${this.escapeHtml(level.title)}</h1>
        <p style="margin-top:8px;color:var(--color-text-secondary);font-size:14px;">🎯 ${this.escapeHtml(level.goal)}</p>
        <div class="week-progress" style="margin-top:12px;">
          <div class="week-progress-bar">
            <div class="week-progress-fill" style="width:${p.percent}%"></div>
          </div>
          <span class="week-progress-text">${p.completed}/${p.total} 课</span>
        </div>
      </section>

      <section>
        <h2 class="section-title"><span class="icon">📖</span> 课程列表</h2>
        <div class="day-list">
    `;

    level.lessons.forEach((lesson) => {
      const totalWords = lesson.words ? lesson.words.length : 0;
      const learned = EnglishProgress.getLearnedWords(level.id, lesson.id).length;
      const score = EnglishProgress.getQuizScore(level.id, lesson.id);
      const complete = EnglishProgress.isLessonComplete(level.id, lesson.id, totalWords);
      const iconClass = complete ? 'done' : 'undone';
      const iconText = complete ? '✓' : (lesson.id);

      html += `
        <a class="day-card" href="./english.html?level=${level.id}&lesson=${lesson.id}">
          <div class="day-icon ${iconClass}">${iconText}</div>
          <div class="day-info">
            <div class="day-label">第${lesson.id}课 · ${totalWords}词</div>
            <div class="day-title">${this.escapeHtml(lesson.title)}</div>
          </div>
          <span class="day-arrow">›</span>
        </a>
      `;
    });

    html += `
        </div>
      </section>
    `;
    container.innerHTML = html;
  },

  // ====== 课程详情：单词卡片 + 句型 + 测验 ======
  renderLessonView(container, levelId, lessonId) {
    const lesson = EnglishData.getLesson(levelId, lessonId);
    const level = EnglishData.getLevel(levelId);
    if (!lesson || !level) {
      container.innerHTML = '<div class="error-msg">未找到该课程</div>';
      return;
    }

    // 更新导航标题
    const navTitle = document.getElementById('english-nav-title');
    if (navTitle) navTitle.textContent = lesson.title;

    const backLink = document.getElementById('back-to-level');
    if (backLink) backLink.href = './english.html?level=' + levelId;

    const totalWords = lesson.words ? lesson.words.length : 0;
    const learned = EnglishProgress.getLearnedWords(level.id, lesson.id);
    const learnedCount = learned.length;
    const score = EnglishProgress.getQuizScore(level.id, lesson.id);

    let html = `
      <section class="english-breadcrumb">
        <a href="./english.html">英语</a> › <a href="./english.html?level=${level.id}">${this.escapeHtml(level.title)}</a> › <span>${this.escapeHtml(lesson.title)}</span>
      </section>

      <section class="card mb-16">
        <div class="card-subtitle">${this.escapeHtml(level.title)} · 第${lesson.id}课</div>
        <h1 style="font-size:22px;font-weight:800;">${this.escapeHtml(lesson.title)}</h1>
        <p style="margin-top:8px;color:var(--color-text-secondary);font-size:14px;">🎯 ${this.escapeHtml(lesson.goal)}</p>
        <div class="english-lesson-stats">
          <span class="english-stat">📘 ${learnedCount}/${totalWords} 词已学</span>
          <span class="english-stat">📝 测验最高分: ${score}</span>
        </div>
      </section>

      <section class="english-section">
        <h2 class="section-title"><span class="icon">🔤</span> 词汇卡片</h2>
        <p class="english-hint">点击卡片查看中文释义，标记"已学"可记录进度</p>
        <div class="english-word-grid" id="english-word-grid"></div>
      </section>

      <section class="english-section">
        <h2 class="section-title"><span class="icon">💬</span> 常用句型</h2>
        <div class="english-sentence-list" id="english-sentence-list"></div>
      </section>

      <section class="english-section">
        <h2 class="section-title"><span class="icon">🎓</span> 费曼练习：用英语教别人</h2>
        <p class="english-hint">假装面前坐着一个不懂英语的朋友，用刚学的词汇/句型，<strong>用英语</strong>给他讲明白这节课的核心概念。讲不清的地方，就是你要补的洞。</p>
        <div id="english-feynman-area"></div>
      </section>

      <section class="english-section">
        <h2 class="section-title"><span class="icon">✏️</span> 词汇测验</h2>
        <p class="english-hint">通过测验检验学习效果，60分以上且全部单词已学即为完成</p>
        <div id="english-quiz-area"></div>
        <button class="btn btn-primary btn-full mt-16" id="english-start-quiz">开始测验</button>
      </section>

      <section class="day-nav-bottom">
        ${this.renderLessonNav(level, lesson)}
      </section>
    `;
    container.innerHTML = html;

    // 渲染单词卡片
    this.renderWordCards(lesson, levelId, lessonId);
    // 渲染句型
    this.renderSentences(lesson);
    // 渲染费曼练习
    const feynmanArea = document.getElementById('english-feynman-area');
    if (feynmanArea && window.Feynman) {
      const conceptKey = 'e' + levelId + '_' + lessonId + '_lesson';
      // 提取类比提示：从课程标题和前3个词汇
      const hints = [lesson.title];
      if (lesson.words && lesson.words.length > 0) {
        lesson.words.slice(0, 3).forEach((w) => {
          hints.push(w.word + ' = ' + w.meaning);
        });
      }
      Feynman.render(feynmanArea, conceptKey, lesson.title, hints);
    }
    // 绑定测验按钮
    const startBtn = document.getElementById('english-start-quiz');
    if (startBtn) {
      startBtn.addEventListener('click', () => this.startQuiz(lesson, levelId, lessonId));
    }
  },

  // 渲染上一课/下一课导航
  renderLessonNav(level, currentLesson) {
    const lessons = level.lessons;
    const idx = lessons.findIndex((l) => l.id === currentLesson.id);
    let prevHtml = '';
    let nextHtml = '';
    if (idx > 0) {
      const prev = lessons[idx - 1];
      prevHtml = `<a class="btn btn-secondary" href="./english.html?level=${level.id}&lesson=${prev.id}">← 上一课</a>`;
    } else {
      prevHtml = `<a class="btn btn-secondary" href="./english.html?level=${level.id}">← 返回列表</a>`;
    }
    if (idx < lessons.length - 1) {
      const next = lessons[idx + 1];
      nextHtml = `<a class="btn btn-primary" href="./english.html?level=${level.id}&lesson=${next.id}">下一课 →</a>`;
    } else {
      nextHtml = `<a class="btn btn-primary" href="./english.html?level=${level.id}">完成 ✓</a>`;
    }
    return prevHtml + nextHtml;
  },

  // 渲染单词卡片（翻面记忆）
  renderWordCards(lesson, levelId, lessonId) {
    const grid = document.getElementById('english-word-grid');
    if (!grid) return;
    if (!lesson.words || lesson.words.length === 0) {
      grid.innerHTML = '<div class="loading">暂无词汇</div>';
      return;
    }
    const learned = EnglishProgress.getLearnedWords(levelId, lessonId);

    lesson.words.forEach((word, idx) => {
      const card = document.createElement('div');
      card.className = 'english-word-card';
      if (learned.includes(idx)) card.classList.add('learned');
      card.innerHTML = `
        <div class="english-word-front">
          <div class="english-word-word">${this.escapeHtml(word.word)}</div>
          <div class="english-word-phonetic">${this.escapeHtml(word.phonetic)}</div>
          <div class="english-word-pos">${this.escapeHtml(word.pos)}</div>
          <div class="english-word-hint">轻触查看中文</div>
        </div>
        <div class="english-word-back">
          <div class="english-word-meaning">${this.escapeHtml(word.meaning)}</div>
          <div class="english-word-example-en">${this.escapeHtml(word.example_en)}</div>
          <div class="english-word-example-cn">${this.escapeHtml(word.example_cn)}</div>
        </div>
        <button class="english-word-mark ${learned.includes(idx) ? 'marked' : ''}" data-idx="${idx}" aria-label="标记已学">
          ${learned.includes(idx) ? '✓ 已学' : '标记已学'}
        </button>
      `;
      // 翻面逻辑
      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('english-word-mark')) return;
        card.classList.toggle('flipped');
      });
      // 标记已学按钮
      const markBtn = card.querySelector('.english-word-mark');
      if (markBtn) {
        markBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          EnglishProgress.markWordLearned(levelId, lessonId, idx);
          markBtn.classList.add('marked');
          markBtn.textContent = '✓ 已学';
          card.classList.add('learned');
          this.refreshLessonStats(levelId, lessonId);
        });
      }
      grid.appendChild(card);
    });
  },

  // 渲染句型
  renderSentences(lesson) {
    const list = document.getElementById('english-sentence-list');
    if (!list) return;
    if (!lesson.sentences || lesson.sentences.length === 0) {
      list.innerHTML = '<div class="loading">暂无句型</div>';
      return;
    }
    list.innerHTML = '';
    lesson.sentences.forEach((s) => {
      const item = document.createElement('div');
      item.className = 'english-sentence-item';
      item.innerHTML = `
        <div class="english-sentence-en">${this.escapeHtml(s.en)}</div>
        <div class="english-sentence-cn">${this.escapeHtml(s.cn)}</div>
      `;
      list.appendChild(item);
    });
  },

  // 刷新课程统计
  refreshLessonStats(levelId, lessonId) {
    const lesson = EnglishData.getLesson(levelId, lessonId);
    if (!lesson) return;
    const totalWords = lesson.words ? lesson.words.length : 0;
    const learned = EnglishProgress.getLearnedWords(levelId, lessonId).length;
    const statsEls = document.querySelectorAll('.english-lesson-stats .english-stat');
    if (statsEls.length >= 1) {
      statsEls[0].textContent = '📘 ' + learned + '/' + totalWords + ' 词已学';
    }
  },

  // ====== 测验：选择题（中译英 / 英译中） ======
  startQuiz(lesson, levelId, lessonId) {
    const quizArea = document.getElementById('english-quiz-area');
    const startBtn = document.getElementById('english-start-quiz');
    if (startBtn) startBtn.style.display = 'none';
    if (!quizArea) return;
    quizArea.innerHTML = '<div class="loading">测验生成中...</div>';

    // 生成题目：每题给英文，选中文释义
    const words = lesson.words || [];
    if (words.length < 2) {
      quizArea.innerHTML = '<div class="error-msg">词汇不足，无法生成测验</div>';
      return;
    }
    const questions = this.generateQuiz(words);
    this.renderQuiz(quizArea, questions, levelId, lessonId);
  },

  generateQuiz(words) {
    // 随机抽取5题（不足5题则全用）
    const pool = [...words];
    // 简单洗牌
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const numQ = Math.min(5, pool.length);
    const questions = [];
    for (let i = 0; i < numQ; i++) {
      const correct = pool[i];
      // 4个选项
      const optionsSet = new Set();
      optionsSet.add(correct.meaning);
      while (optionsSet.size < 4 && optionsSet.size < words.length) {
        const randIdx = Math.floor(Math.random() * words.length);
        optionsSet.add(words[randIdx].meaning);
      }
      const options = Array.from(optionsSet);
      // 洗牌选项
      for (let k = options.length - 1; k > 0; k--) {
        const j = Math.floor(Math.random() * (k + 1));
        [options[k], options[j]] = [options[j], options[k]];
      }
      questions.push({
        word: correct.word,
        phonetic: correct.phonetic,
        answer: correct.meaning,
        options: options
      });
    }
    return questions;
  },

  renderQuiz(container, questions, levelId, lessonId) {
    let html = '<form id="english-quiz-form" class="english-quiz-form">';
    questions.forEach((q, idx) => {
      html += `
        <div class="exercise-card" data-q="${idx}">
          <span class="exercise-type">第 ${idx + 1} 题</span>
          <div class="exercise-question">
            <div class="english-quiz-word">${this.escapeHtml(q.word)}</div>
            <div class="english-quiz-phonetic">${this.escapeHtml(q.phonetic)}</div>
            <div class="english-quiz-prompt">选择正确的中文释义</div>
          </div>
          <div class="choice-options">
      `;
      q.options.forEach((opt) => {
        html += `
          <label class="choice-option">
            <input type="radio" name="q${idx}" value="${this.escapeHtml(opt)}">
            <span>${this.escapeHtml(opt)}</span>
          </label>
        `;
      });
      html += `
          </div>
          <div class="exercise-feedback" data-feedback="${idx}"></div>
        </div>
      `;
    });
    html += `
      </form>
      <button class="btn btn-primary btn-full mt-16" id="english-submit-quiz">提交答案</button>
    `;
    container.innerHTML = html;

    const submitBtn = document.getElementById('english-submit-quiz');
    if (submitBtn) {
      submitBtn.addEventListener('click', () => {
        this.gradeQuiz(questions, levelId, lessonId);
      });
    }
  },

  gradeQuiz(questions, levelId, lessonId) {
    let correct = 0;
    questions.forEach((q, idx) => {
      const selected = document.querySelector(`input[name="q${idx}"]:checked`);
      const feedback = document.querySelector(`[data-feedback="${idx}"]`);
      const card = document.querySelector(`[data-q="${idx}"]`);
      if (!feedback || !card) return;
      if (selected && selected.value === q.answer) {
        correct++;
        feedback.className = 'exercise-feedback show correct';
        feedback.innerHTML = '<div class="feedback-label">✓ 正确</div>';
      } else {
        feedback.className = 'exercise-feedback show wrong';
        feedback.innerHTML = '<div class="feedback-label">✗ 错误</div><div class="feedback-explanation">正确答案: ' + this.escapeHtml(q.answer) + '</div>';
      }
      // 标记选项
      card.querySelectorAll('.choice-option').forEach((opt) => {
        const input = opt.querySelector('input[type="radio"]');
        if (input && input.value === q.answer) {
          opt.classList.add('correct');
        } else if (input && input.checked) {
          opt.classList.add('wrong');
        }
      });
    });
    const total = questions.length;
    const score = Math.round((correct / total) * 100);
    EnglishProgress.saveQuizScore(levelId, lessonId, score);
    this.refreshLessonStats(levelId, lessonId);

    // 显示结果
    const submitBtn = document.getElementById('english-submit-quiz');
    if (submitBtn) {
      submitBtn.outerHTML = `
        <div class="english-quiz-result">
          <div class="english-quiz-score ${score >= 60 ? 'pass' : 'fail'}">
            得分: ${score} 分 (${correct}/${total})
          </div>
          <button class="btn btn-secondary btn-full mt-16" id="english-retry-quiz">重新测验</button>
        </div>
      `;
      const retryBtn = document.getElementById('english-retry-quiz');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => {
          const lesson = EnglishData.getLesson(levelId, lessonId);
          if (lesson) this.startQuiz(lesson, levelId, lessonId);
        });
      }
    }
  }
};

// 暴露到全局
window.EnglishData = EnglishData;
window.EnglishProgress = EnglishProgress;
window.EnglishApp = EnglishApp;
