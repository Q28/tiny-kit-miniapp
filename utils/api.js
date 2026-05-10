function postParseDouyin(shareText) {
  const app = getApp();
  const baseUrl = app.globalData.apiBaseUrl;

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${baseUrl}/api/parse-douyin`,
      method: "POST",
      data: { shareText },
      header: {
        "content-type": "application/json"
      },
      success: (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`请求失败，状态码：${res.statusCode}`));
          return;
        }
        if (!res.data || res.data.code !== 0) {
          reject(new Error((res.data && res.data.message) || "解析失败"));
          return;
        }
        resolve(res.data.data);
      },
      fail: (err) => {
        reject(new Error(err.errMsg || "网络请求失败"));
      }
    });
  });
}

module.exports = {
  postParseDouyin
};
