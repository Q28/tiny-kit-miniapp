/**
 * 视频/图片下载与保存到相册。
 *
 * 多策略下载: wx.request(arraybuffer) → wx.downloadFile+header → wx.downloadFile 裸请求
 */

/** ArrayBuffer → String（微信无 TextDecoder，手动转换前若干字节用于诊断） */
function ab2str(buffer, maxLen) {
  maxLen = maxLen || 500;
  const bytes = new Uint8Array(buffer);
  const len = Math.min(bytes.length, maxLen);
  const chunks = [];
  for (let i = 0; i < len; i++) {
    chunks.push(String.fromCharCode(bytes[i]));
  }
  return chunks.join('');
}

/** 探测 URL 可达性 */
function probeUrl(url) {
  return new Promise((resolve) => {
    wx.request({
      url,
      success: (res) => {
        const ct = (res.header['Content-Type'] || res.header['content-type'] || '').toLowerCase();
        resolve({ statusCode: res.statusCode, contentType: ct });
      },
      fail: (err) => resolve({ error: err.errMsg })
    });
  });
}

/** 策略1: wx.request + arraybuffer + 完整 header */
function tryRequestArrayBuffer(url, onProgress) {
  return new Promise((resolve, reject) => {
    const task = wx.request({
      url,
      responseType: 'arraybuffer',
      header: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        'Referer': 'https://www.douyin.com/'
      },
      success: (res) => {
        if (res.statusCode !== 200) {
          reject(new Error('HTTP ' + res.statusCode));
          return;
        }
        const ct = (res.header['Content-Type'] || res.header['content-type'] || '').toLowerCase();
        const size = res.data && res.data.byteLength || 0;

        // 检测 JSON 错误响应
        if (ct.includes('json') || ct.includes('text/') || (size < 2000 && ct === '')) {
          try {
            const text = ab2str(res.data, 300);
            if (text.startsWith('{') || text.startsWith('[')) {
              reject(new Error('CDN 返回 JSON: ' + text));
            } else {
              reject(new Error('CDN 返回非视频数据, size=' + size + ', ct=' + ct + ', preview=' + text.substring(0, 80)));
            }
          } catch (_) {
            reject(new Error('CDN 返回非视频数据, size=' + size + ', ct=' + ct));
          }
          return;
        }

        // 推断扩展名
        let ext = '.mp4';
        if (ct.includes('image/jpeg')) ext = '.jpg';
        else if (ct.includes('image/png')) ext = '.png';
        else if (ct.includes('image/webp')) ext = '.webp';
        else if (ct.includes('image/gif')) ext = '.gif';

        const fs = wx.getFileSystemManager();
        const filePath = wx.env.USER_DATA_PATH + '/dy_' + Date.now() + ext;
        try {
          fs.writeFileSync(filePath, res.data);
        } catch (e) {
          reject(new Error('写文件失败: ' + e.message));
          return;
        }
        resolve({ path: filePath, size });
      },
      fail: (err) => reject(new Error(err.errMsg))
    });
    if (onProgress) task.onProgressUpdate((r) => onProgress(r.progress));
  });
}

/** 策略2: wx.downloadFile + 完整 header */
function tryDownloadFileHeaders(url, onProgress) {
  return new Promise((resolve, reject) => {
    const task = wx.downloadFile({
      url,
      timeout: 5 * 60 * 1000,
      header: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        'Referer': 'https://www.douyin.com/'
      },
      success: (res) => {
        if (res.statusCode === 200 && !res.tempFilePath.endsWith('.json')) {
          resolve({ path: res.tempFilePath });
        } else {
          reject(new Error('HTTP ' + res.statusCode + (res.tempFilePath.endsWith('.json') ? ' (JSON)' : '')));
        }
      },
      fail: (err) => reject(new Error(err.errMsg))
    });
    if (onProgress) task.onProgressUpdate((r) => onProgress(r.progress));
  });
}

/** 策略3: wx.downloadFile 无自定义 header */
function tryDownloadFileBare(url, onProgress) {
  return new Promise((resolve, reject) => {
    const task = wx.downloadFile({
      url,
      timeout: 5 * 60 * 1000,
      success: (res) => {
        if (res.statusCode === 200 && !res.tempFilePath.endsWith('.json')) {
          resolve({ path: res.tempFilePath });
        } else {
          reject(new Error('HTTP ' + res.statusCode));
        }
      },
      fail: (err) => reject(new Error(err.errMsg))
    });
    if (onProgress) task.onProgressUpdate((r) => onProgress(r.progress));
  });
}

/** 依次尝试所有策略 */
async function downloadWithFallback(url, onProgress) {
  const errors = [];

  // 诊断探测
  const probe = await probeUrl(url);
  console.log('[downloader] 探测:', JSON.stringify(probe));

  const strategies = [
    { name: 'request+arraybuffer', fn: () => tryRequestArrayBuffer(url, onProgress) },
    { name: 'downloadFile+headers', fn: () => tryDownloadFileHeaders(url, onProgress) },
    { name: 'downloadFile', fn: () => tryDownloadFileBare(url, onProgress) }
  ];

  for (const s of strategies) {
    try {
      console.log('[downloader] 尝试:', s.name);
      const result = await s.fn();
      console.log('[downloader] 成功:', s.name, JSON.stringify(result));
      return result.path;
    } catch (e) {
      console.warn('[downloader] 失败:', s.name, e.message);
      errors.push(s.name + ': ' + e.message);
    }
  }

  throw new Error('所有策略均失败。探测=' + JSON.stringify(probe) + ' | ' + errors.join(' ;; '));
}

/** 请求相册权限 */
function requestAlbumAuth() {
  return new Promise((resolve) => {
    wx.getSetting({
      success: (res) => {
        if (res.authSetting['scope.writePhotosAlbum']) return resolve(true);
        wx.authorize({
          scope: 'scope.writePhotosAlbum',
          success: () => resolve(true),
          fail: () => {
            wx.showModal({
              title: '需要相册权限',
              content: '请前往设置开启相册权限',
              confirmText: '去设置',
              success: (m) => {
                if (m.confirm) {
                  wx.openSetting({ success: (s) => resolve(!!s.authSetting['scope.writePhotosAlbum']) });
                } else {
                  resolve(false);
                }
              }
            });
          }
        });
      }
    });
  });
}

function saveVideo(filePath) {
  return new Promise((resolve, reject) => {
    wx.saveVideoToPhotosAlbum({
      filePath,
      success: () => resolve(),
      fail: (err) => reject(new Error('保存失败: ' + err.errMsg))
    });
  });
}

function saveImage(filePath) {
  return new Promise((resolve, reject) => {
    wx.saveImageToPhotosAlbum({
      filePath,
      success: () => resolve(),
      fail: (err) => reject(new Error('保存失败: ' + err.errMsg))
    });
  });
}

async function downloadAndSaveVideo(playUrl, onProgress) {
  console.log('[downloader] 视频 URL:', playUrl);
  const hasAuth = await requestAlbumAuth();
  if (!hasAuth) throw new Error('没有相册写入权限');

  const filePath = await downloadWithFallback(playUrl, onProgress);
  await saveVideo(filePath);
  console.log('[downloader] 已保存到相册');
}

async function downloadAndSaveImages(imageUrls, onProgress) {
  const hasAuth = await requestAlbumAuth();
  if (!hasAuth) throw new Error('没有相册写入权限');

  let saved = 0;
  const total = imageUrls.length;

  for (let i = 0; i < imageUrls.length; i++) {
    try {
      const filePath = await downloadWithFallback(imageUrls[i]);
      await saveImage(filePath);
      saved++;
    } catch (e) {
      console.error('[downloader] 图片 ' + (i + 1) + ' 失败:', e.message);
    }
    if (onProgress) onProgress({ current: i + 1, total, saved });
  }
  return { saved, total };
}

module.exports = { downloadAndSaveVideo, downloadAndSaveImages };
