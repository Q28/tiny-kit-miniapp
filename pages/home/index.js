Page({
  data: {
    userInfo: null
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
    const app = getApp();
    const cacheUser = wx.getStorageSync('userInfo');
    if (cacheUser) {
      app.globalData.userInfo = cacheUser;
    }
    this.setData({
      userInfo: app.globalData.userInfo || null
    });
  },

  goDouyinParser() {
    wx.navigateTo({ url: '/pages/index/index' });
  },

  goLottery() {
    wx.navigateTo({ url: '/pages/lottery/index' });
  }
});
