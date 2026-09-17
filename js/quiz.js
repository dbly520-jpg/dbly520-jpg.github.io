/**
 * quiz.js - 练习题渲染与判题模块
 * 支持：选择题（单选）、填空题、代码题
 */

const Quiz = {
  // 缓存当前天数据
  currentExercises: [],

  /**
   * 渲染练习题列表到指定容器
   * @param {Array} exercises - 练习题数据数组
   * @param {HTMLElement} container - 渲染容器
   */
  render(exercises, container) {
    if (!container) return;
    this.currentExercises = exercises || [];

    if (this.currentExercises.length === 0) {
      container.innerHTML = '<p class="loading">暂无练习题</p>';
      return;
    }

    container.innerHTML = '';
    this.currentExercises.forEach((ex, index) => {
      const card = this.createExerciseCard(ex, index);
      container.appendChild(card);
    });
  },

  /**
   * 创建单道练习题卡片
   * @param {Object} exercise - 练习题数据
   * @param {number} index - 题号索引
   * @returns {HTMLElement}
   */
  createExerciseCard(exercise, index) {
    const card = document.createElement('div');
    card.className = 'exercise-card';

    const typeName = {
      choice: '选择题',
      fill: '填空题',
      code: '代码题'
    }[exercise.type] || '题目';

    // 题目标签
    const typeLabel = document.createElement('span');
    typeLabel.className = 'exercise-type';
    typeLabel.textContent = typeName;
    card.appendChild(typeLabel);

    // 题目文本
    const question = document.createElement('div');
    question.className = 'exercise-question';
    question.textContent = `${index + 1}. ${exercise.question}`;
    card.appendChild(question);

    // 根据题型创建答题区
    if (exercise.type === 'choice') {
      this.renderChoice(card, exercise, index);
    } else if (exercise.type === 'fill') {
      this.renderFill(card, exercise, index);
    } else if (exercise.type === 'code') {
      this.renderCode(card, exercise, index);
    }

    return card;
  },

  /**
   * 渲染选择题
   */
  renderChoice(card, exercise, index) {
    const optionsDiv = document.createElement('div');
    optionsDiv.className = 'choice-options';

    exercise.options.forEach((opt, optIndex) => {
      const label = document.createElement('label');
      label.className = 'choice-option';

      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = `quiz_${index}`;
      radio.value = optIndex;

      const text = document.createElement('span');
      // 选项标记 A B C D
      const marker = String.fromCharCode(65 + optIndex);
      text.innerHTML = `<strong>${marker}.</strong> ${this.escapeHtml(opt)}`;

      label.appendChild(radio);
      label.appendChild(text);
      optionsDiv.appendChild(label);
    });
    card.appendChild(optionsDiv);

    // 提交按钮
    const submitBtn = document.createElement('button');
    submitBtn.className = 'btn btn-primary';
    submitBtn.textContent = '提交答案';
    submitBtn.addEventListener('click', () => {
      const selected = card.querySelector(`input[name="quiz_${index}"]:checked`);
      if (!selected) {
        this.showFeedback(card, false, '请先选择一个选项', exercise.explanation);
        return;
      }
      const userAnswer = parseInt(selected.value);
      const isCorrect = userAnswer === exercise.answer;

      // 标记选项对错
      optionsDiv.querySelectorAll('.choice-option').forEach((label, i) => {
        if (i === exercise.answer) {
          label.classList.add('correct');
        } else if (i === userAnswer && !isCorrect) {
          label.classList.add('wrong');
        }
      });

      this.showFeedback(card, isCorrect, isCorrect ? '回答正确！' : '回答错误', exercise.explanation);
      submitBtn.disabled = true;
      submitBtn.textContent = '已提交';
      submitBtn.style.opacity = '0.6';
    });
    card.appendChild(submitBtn);
  },

  /**
   * 渲染填空题
   */
  renderFill(card, exercise, index) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'fill-input';
    input.placeholder = '请输入答案...';
    card.appendChild(input);

    const submitBtn = document.createElement('button');
    submitBtn.className = 'btn btn-primary';
    submitBtn.textContent = '提交答案';
    submitBtn.addEventListener('click', () => {
      const userAnswer = input.value.trim();
      if (!userAnswer) {
        this.showFeedback(card, false, '请输入答案', exercise.explanation);
        return;
      }
      // 忽略大小写和首尾空格比较
      const isCorrect = userAnswer.toLowerCase() === String(exercise.answer).toLowerCase();

      input.classList.add(isCorrect ? 'correct' : 'wrong');

      this.showFeedback(card, isCorrect, isCorrect ? '回答正确！' : '回答错误', exercise.explanation);
      submitBtn.disabled = true;
      submitBtn.textContent = '已提交';
      submitBtn.style.opacity = '0.6';
    });
    card.appendChild(submitBtn);
  },

  /**
   * 渲染代码题
   */
  renderCode(card, exercise, index) {
    const textarea = document.createElement('textarea');
    textarea.className = 'code-textarea';
    textarea.placeholder = '请在此输入代码...';
    textarea.rows = 6;
    card.appendChild(textarea);

    const submitBtn = document.createElement('button');
    submitBtn.className = 'btn btn-primary';
    submitBtn.textContent = '提交答案';
    submitBtn.addEventListener('click', () => {
      const userCode = textarea.value.trim();
      if (!userCode) {
        this.showFeedback(card, false, '请输入代码', exercise.explanation);
        return;
      }

      // 代码题采用关键词匹配判题
      const isCorrect = this.checkCodeAnswer(userCode, exercise.answer);

      this.showFeedback(card, isCorrect, isCorrect ? '代码通过！' : '代码未通过，参考解析', exercise.explanation);
      submitBtn.disabled = true;
      submitBtn.textContent = '已提交';
      submitBtn.style.opacity = '0.6';
    });
    card.appendChild(submitBtn);
  },

  /**
   * 代码题判题：检查答案中关键内容是否出现
   * @param {string} userCode - 用户提交的代码
   * @param {string} answer - 参考答案
   * @returns {boolean}
   */
  checkCodeAnswer(userCode, answer) {
    // 提取参考答案中的关键字（标识符、函数名等）
    // 简化判断：去除注释和空白后，检查用户代码是否包含答案中的核心关键词
    const keywords = answer
      .replace(/\/\/.*$/gm, '')       // 去除行注释
      .replace(/\/\*[\s\S]*?\*\//g, '') // 去除块注释
      .replace(/["']/g, ' ')           // 去除引号
      .match(/[a-zA-Z_]\w{2,}/g) || []; // 提取标识符（3字符以上）

    // 去重关键词
    const uniqueKeywords = [...new Set(keywords)];
    // 至少匹配60%的关键词视为通过
    const threshold = Math.ceil(uniqueKeywords.length * 0.6);
    let matchCount = 0;

    uniqueKeywords.forEach((kw) => {
      if (userCode.includes(kw)) {
        matchCount++;
      }
    });

    return matchCount >= threshold && uniqueKeywords.length > 0;
  },

  /**
   * 显示答题反馈
   * @param {HTMLElement} card - 题目卡片
   * @param {boolean} isCorrect - 是否正确
   * @param {string} label - 反馈标签
   * @param {string} explanation - 解析
   */
  showFeedback(card, isCorrect, label, explanation) {
    // 移除已有反馈
    const existing = card.querySelector('.exercise-feedback');
    if (existing) existing.remove();

    const feedback = document.createElement('div');
    feedback.className = 'exercise-feedback show ' + (isCorrect ? 'correct' : 'wrong');

    const labelDiv = document.createElement('div');
    labelDiv.className = 'feedback-label';
    labelDiv.textContent = (isCorrect ? '✓ ' : '✗ ') + label;
    feedback.appendChild(labelDiv);

    if (explanation) {
      const expDiv = document.createElement('div');
      expDiv.className = 'feedback-explanation';
      expDiv.textContent = '解析：' + explanation;
      feedback.appendChild(expDiv);
    }

    card.appendChild(feedback);
  },

  /**
   * HTML 转义，防止 XSS
   * @param {string} text - 原始文本
   * @returns {string}
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

// 暴露到全局
window.Quiz = Quiz;
