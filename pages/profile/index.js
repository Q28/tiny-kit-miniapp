Page({
  data: {
    userInfo: null,
    showLoginPanel: false,
    tempAvatarUrl: '',
    tempNickname: ''
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
    const app = getApp();
    this.setData({
      userInfo: app.globalData.userInfo || null
    });
  },

  /** 显示授权弹窗 */
  onShowLoginPanel() {
    this.setData({ showLoginPanel: true, tempAvatarUrl: '', tempNickname: '' });
  },

  /** 关闭授权弹窗 */
  onHideLoginPanel() {
    this.setData({ showLoginPanel: false });
  },

  /** 选择头像 */
  onChooseAvatar(e) {
    const avatarUrl = e.detail.avatarUrl;
    console.log('chooseAvatar:', avatarUrl);
    this.setData({ tempAvatarUrl: avatarUrl });
  },

  /** 昵称输入 */
  onNicknameInput(e) {
    this.setData({ tempNickname: e.detail.value });
  },

  /** 昵称确认 */
  onNicknameBlur(e) {
    const nickname = e.detail.value || '';
    console.log('nickname:', nickname);
    this.setData({ tempNickname: nickname });
  },

  /** 确认登录 */
  onConfirmLogin() {
    const { tempAvatarUrl, tempNickname } = this.data;
    if (!tempAvatarUrl || !tempNickname) {
      wx.showToast({ title: '请先选择头像和昵称', icon: 'none' });
      return;
    }

    const userInfo = {
      nickName: tempNickname,
      avatarUrl: tempAvatarUrl
    };
    console.log('登录 userInfo:', JSON.stringify(userInfo));

    const app = getApp();
    // 保留之前绑定的手机号
    if (app.globalData.userInfo && app.globalData.userInfo.phone) {
      userInfo.phone = app.globalData.userInfo.phone;
    }
    app.globalData.userInfo = userInfo;
    wx.setStorageSync('userInfo', userInfo);

    this.setData({
      userInfo,
      showLoginPanel: false,
      tempAvatarUrl: '',
      tempNickname: ''
    });

    wx.showToast({ title: '登录成功', icon: 'success' });
  },

  /** 手机号授权 */
  onGetPhoneNumber(e) {
    console.log('getPhoneNumber 完整返回:', JSON.stringify(e.detail));
    const { code, errMsg } = e.detail;
    console.log('code:', code);

    if (errMsg !== 'getPhoneNumber:ok') {
      console.log('手机号授权取消');
      return;
    }

    if (code) {
      console.log('=== 拿到 code，需要后端解密手机号 ===');
      wx.showToast({ title: '手机号授权成功，需后端解密', icon: 'none' });

      const app = getApp();
      const userInfo = app.globalData.userInfo || {};
      userInfo.phoneCode = code;
      app.globalData.userInfo = userInfo;
      wx.setStorageSync('userInfo', userInfo);
      this.setData({ userInfo });
    }
  },

  onLogout() {
    const app = getApp();
    app.globalData.userInfo = null;
    wx.removeStorageSync('userInfo');
    this.setData({ userInfo: null, showLoginPanel: false });
    wx.showToast({ title: '已退出', icon: 'none' });
  }
});
