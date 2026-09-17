/**
 * progress.js - 学习进度管理模块
 * 使用 LocalStorage 存储学习进度（打卡状态、练习完成情况）
 */

const Progress = {
  // LocalStorage 存储键名
  STORAGE_KEY: 'embedded_learning_progress',
  NOTES_KEY: 'embedded_learning_notes',

  /**
   * 从 LocalStorage 读取进度数据
   * @returns {Object} 进度对象 { dayId: true, ... }
   */
  getProgress() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch (err) {
      console.error('[Progress] 读取进度失败:', err);
      return {};
    }
  },

  /**
   * 保存进度数据到 LocalStorage
   * @param {Object} progress - 进度对象
   */
  saveProgress(progress) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(progress));
    } catch (err) {
      console.error('[Progress] 保存进度失败:', err);
    }
  },

  /**
   * 标记某天为已完成（打卡）
   * @param {number} dayId - 全局天ID
   */
  markDayComplete(dayId) {
    const progress = this.getProgress();
    progress[dayId] = true;
    this.saveProgress(progress);
  },

  /**
   * 取消某天的完成状态
   * @param {number} dayId - 全局天ID
   */
  unmarkDay(dayId) {
    const progress = this.getProgress();
    delete progress[dayId];
    this.saveProgress(progress);
  },

  /**
   * 检查某天是否已完成
   * @param {number} dayId - 全局天ID
   * @returns {boolean}
   */
  isDayComplete(dayId) {
    const progress = this.getProgress();
    return !!progress[dayId];
  },

  /**
   * 获取已完成天数
   * @returns {number}
   */
  getCompletedCount() {
    const progress = this.getProgress();
    return Object.keys(progress).filter((k) => progress[k] === true).length;
  },

  /**
   * 获取总进度百分比
   * @param {number} totalDays - 总天数
   * @returns {number} 0-100
   */
  getOverallProgress(totalDays) {
    const completed = this.getCompletedCount();
    return totalDays > 0 ? Math.round((completed / totalDays) * 100) : 0;
  },

  /**
   * 获取某周的完成进度
   * @param {Array} dayIds - 该周所有天的全局ID列表
   * @returns {Object} { completed, total, percent }
   */
  getWeekProgress(dayIds) {
    const progress = this.getProgress();
    let completed = 0;
    dayIds.forEach((id) => {
      if (progress[id] === true) completed++;
    });
    const total = dayIds.length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { completed, total, percent };
  },

  /**
   * 计算某天在课程中的全局序号
   * @param {number} weekId - 周序号（1-16）
   * @param {number} dayInWeek - 周内天数（1-7）
   * @returns {number} 全局天ID（1-112）
   */
  calcDayId(weekId, dayInWeek) {
    return (weekId - 1) * 7 + dayInWeek;
  },

  /**
   * 保存笔记内容到 LocalStorage
   * @param {number} dayId - 全局天ID
   * @param {string} content - 笔记内容
   */
  saveNote(dayId, content) {
    try {
      const notes = this.getAllNotes();
      notes[dayId] = content;
      localStorage.setItem(this.NOTES_KEY, JSON.stringify(notes));
    } catch (err) {
      console.error('[Progress] 保存笔记失败:', err);
    }
  },

  /**
   * 获取某天的笔记内容
   * @param {number} dayId - 全局天ID
   * @returns {string} 笔记内容
   */
  getNote(dayId) {
    const notes = this.getAllNotes();
    return notes[dayId] || '';
  },

  /**
   * 获取所有笔记
   * @returns {Object} { dayId: content, ... }
   */
  getAllNotes() {
    try {
      const data = localStorage.getItem(this.NOTES_KEY);
      return data ? JSON.parse(data) : {};
    } catch (err) {
      console.error('[Progress] 读取笔记失败:', err);
      return {};
    }
  }
};

// 暴露到全局
window.Progress = Progress;
