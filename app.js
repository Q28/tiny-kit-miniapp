App({
  onLaunch() {
    // 检查相册权限
    wx.getSetting({
      success: (res) => {
        this.globalData.hasAlbumAuth = !!res.authSetting['scope.writePhotosAlbum'];
      }
    });
  },

  globalData: {
    // apiBaseUrl: 'http://127.0.0.1:3000',  // 暂未接入后端
    userInfo: null,
    // token: '',  // 暂未接入后端
    hasAlbumAuth: false
  }
});
