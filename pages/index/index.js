const parser = require('../../utils/parser');
const downloader = require('../../utils/downloader');

Page({
  data: {
    inputText: '',
    parsing: false,
    downloading: false,
    downloadingCover: false,
    videoInfo: null,
    downloadProgress: -1,
    statusMsg: '',
    statusType: '',
    videoLoadError: false
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value });
  },

  setStatus(msg, type) {
    this.setData({ statusMsg: msg, statusType: type });
    if (type === 'success' || type === 'error') {
      setTimeout(() => {
        if (this.data.statusMsg === msg) {
          this.setData({ statusMsg: '', statusType: '' });
        }
      }, 6000);
    }
  },

  onPaste() {
    wx.getClipboardData({
      success: (res) => {
        this.setData({ inputText: res.data || '' });
      },
      fail: () => {
        wx.showToast({ title: '读取剪贴板失败', icon: 'none' });
      }
    });
  },

  onClear() {
    this.setData({
      inputText: '',
      videoInfo: null,
      downloadProgress: -1,
      statusMsg: '',
      statusType: '',
      videoLoadError: false,
      downloadingCover: false
    });
  },

  async onParse() {
    const input = this.data.inputText.trim();
    if (!input) {
      wx.showToast({ title: '请先输入分享文案', icon: 'none' });
      return;
    }

    this.setData({
      parsing: true,
      videoInfo: null,
      downloadProgress: -1,
      statusMsg: '',
      statusType: '',
      videoLoadError: false,
      downloadingCover: false
    });

    try {
      const info = await parser.parse(input);

      const isImage = info.awemeType === 2;
      this.setData({
        videoInfo: {
          ...info,
          isImage,
          durationSec: (info.durationMs / 1000).toFixed(1),
          playUrlPreview: info.playUrl ? info.playUrl.substring(0, 100) : ''
        }
      });
      const playInfo = info.playUrl ? ' | 播放地址已就绪' : '';
      this.setStatus(
        (isImage ? '解析成功，共 ' + info.imageUrls.length + ' 张图片' : '解析成功' + playInfo),
        'success'
      );
    } catch (e) {
      console.error('[index] 解析失败:', e.message);
      wx.showToast({ title: '解析失败: ' + e.message, icon: 'none', duration: 3000 });
    } finally {
      this.setData({ parsing: false });
    }
  },

  onVideoError(e) {
    console.error('[index] 视频加载失败:', e.detail);
    this.setData({ videoLoadError: true });
  },

  onCopyPlayUrl() {
    const url = this.data.videoInfo && this.data.videoInfo.playUrl;
    if (!url) return;
    wx.setClipboardData({ data: url });
  },

  onCopyCoverUrl() {
    const url = this.data.videoInfo && this.data.videoInfo.coverUrl;
    if (!url) return;
    wx.setClipboardData({ data: url });
  },

  async onDownloadCover() {
    const { videoInfo } = this.data;
    if (!videoInfo || !videoInfo.coverUrl) return;

    this.setData({ downloadingCover: true });
    try {
      const result = await downloader.downloadAndSaveImages([videoInfo.coverUrl]);
      if (result.saved > 0) {
        wx.showToast({ title: '封面已保存到相册', icon: 'success' });
      } else {
        wx.showToast({ title: '封面保存失败', icon: 'none' });
      }
    } catch (e) {
      console.error('[index] 封面下载失败:', e.message);
      wx.showToast({ title: '封面下载失败', icon: 'none' });
    } finally {
      this.setData({ downloadingCover: false });
    }
  },

  async onDownload() {
    const { videoInfo } = this.data;
    if (!videoInfo) return;

    this.setData({ downloading: true, downloadProgress: videoInfo.isImage ? -1 : 0 });

    try {
      if (videoInfo.isImage) {
        this.setStatus('正在下载图片...', 'info');
        const result = await downloader.downloadAndSaveImages(
          videoInfo.imageUrls,
          (progress) => {
            this.setStatus(
              '下载中: ' + progress.current + ' / ' + progress.total + '（已保存 ' + progress.saved + ' 张）',
              'info'
            );
          }
        );
        this.setStatus('完成！成功保存 ' + result.saved + ' / ' + result.total + ' 张图片到相册', 'success');
      } else {
        this.setStatus('正在下载视频...', 'info');
        await downloader.downloadAndSaveVideo(
          videoInfo.playUrl,
          (progress) => {
            this.setData({ downloadProgress: progress });
          }
        );
        this.setData({ downloadProgress: 100 });
        wx.showToast({ title: '视频已保存到相册', icon: 'success' });
      }
    } catch (e) {
      console.error('[index] 下载失败:', e.message);
      wx.showToast({ title: '下载失败', icon: 'none' });
      this.setStatus('下载失败: ' + e.message, 'error');
    } finally {
      this.setData({ downloading: false });
    }
  }
});
