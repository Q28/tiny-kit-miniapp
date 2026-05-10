Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/home/index', text: '首页' },
      { pagePath: '/pages/profile/index', text: '我的' }
    ]
  },

  methods: {
    switchTab(e) {
      const { index, path } = e.currentTarget.dataset;
      if (this.data.selected === index) return;
      wx.switchTab({ url: path });
    }
  }
});
