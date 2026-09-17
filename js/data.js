/**
 * data.js - 课程数据加载与管理模块
 * 负责：加载 curriculum.json，提供数据查询接口
 */

// 课程数据全局对象
const CourseData = {
  data: null,
  loaded: false,

  /**
   * 异步加载课程数据
   * @returns {Promise<Object>} 课程数据对象
   */
  async load() {
    if (this.loaded) {
      return this.data;
    }
    try {
      const response = await fetch('./data/curriculum.json');
      if (!response.ok) {
        throw new Error('网络响应异常: ' + response.status);
      }
      this.data = await response.json();
      this.loaded = true;
      return this.data;
    } catch (err) {
      console.error('[CourseData] 加载课程数据失败:', err);
      throw err;
    }
  },

  /**
   * 获取课程基本信息
   */
  getCourseInfo() {
    return this.data ? this.data.course : null;
  },

  /**
   * 获取所有月份
   * @returns {Array} 月份列表
   */
  getMonths() {
    return this.data ? this.data.course.months : [];
  },

  /**
   * 获取所有周（扁平化）
   * @returns {Array} 所有周的列表
   */
  getAllWeeks() {
    const weeks = [];
    if (!this.data) return weeks;
    this.data.course.months.forEach((month) => {
      month.weeks.forEach((week) => {
        weeks.push({
          ...week,
          monthId: month.id,
          monthTitle: month.title,
          monthTheme: month.theme
        });
      });
    });
    return weeks;
  },

  /**
   * 根据周ID获取周数据
   * @param {number} weekId - 周序号（1-16）
   * @returns {Object|null} 周数据
   */
  getWeek(weekId) {
    const weeks = this.getAllWeeks();
    return weeks.find((w) => w.id === weekId) || null;
  },

  /**
   * 获取指定周的所有天
   * @param {number} weekId - 周序号
   * @returns {Array} 天列表
   */
  getDaysByWeek(weekId) {
    const week = this.getWeek(weekId);
    return week ? week.days : [];
  },

  /**
   * 根据周序号和天数获取某天的数据
   * @param {number} weekId - 周序号（1-16）
   * @param {number} dayId - 天序号（1-7，对应周内第几天）
   * @returns {Object|null} 天数据
   */
  getDay(weekId, dayId) {
    const days = this.getDaysByWeek(weekId);
    // dayId 是周内第几天（1-7），通过索引获取
    const index = dayId - 1;
    if (index >= 0 && index < days.length) {
      return days[index];
    }
    return null;
  },

  /**
   * 根据全局天ID获取天数据（跨周查找）
   * @param {number} globalDayId - 全局天ID（1-112）
   * @returns {Object|null} 天数据，含 weekId 信息
   */
  getDayByGlobalId(globalDayId) {
    if (!this.data) return null;
    for (const month of this.data.course.months) {
      for (const week of month.weeks) {
        for (let i = 0; i < week.days.length; i++) {
          if (week.days[i].id === globalDayId) {
            return {
              ...week.days[i],
              weekId: week.id,
              dayInWeek: i + 1
            };
          }
        }
      }
    }
    return null;
  },

  /**
   * 获取总天数
   * @returns {number} 总天数
   */
  getTotalDays() {
    return this.data ? this.data.course.totalDays : 112;
  },

  /**
   * 获取总周数
   * @returns {number} 总周数
   */
  getTotalWeeks() {
    return this.data ? this.data.course.totalWeeks : 16;
  },

  /**
   * 根据天ID推算属于第几周、周内第几天
   * @param {number} dayId - 全局天ID（1-112）
   * @returns {Object} { weekId, dayInWeek }
   */
  getWeekAndDayById(dayId) {
    const day = this.getDayByGlobalId(dayId);
    if (day) {
      return { weekId: day.weekId, dayInWeek: day.dayInWeek };
    }
    return { weekId: 1, dayInWeek: 1 };
  }
};

// 暴露到全局
window.CourseData = CourseData;
