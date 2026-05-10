/**
 * 抖音 SSR 页面数据解析器。
 *
 * 从分享页 HTML 中提取 window._ROUTER_DATA，
 * 无需调用 API 接口，无需签名/加密。
 *
 * 数据路径: loaderData → "(video|note)_(id)/page" → videoInfoRes → item_list → [0]
 */

// 匹配短链接
const SHORT_URL_RE = /https?:\/\/v\.douyin\.com\/[\w\/]+/;

function extractShareUrl(input) {
  const m = input.match(SHORT_URL_RE);
  if (m) return m[0];
  const trimmed = input.trim();
  if (/^https?:\/\//.test(trimmed)) return trimmed;
  return null;
}

function fetchSSRPage(shareUrl) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: shareUrl,
      header: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) ' +
          'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
      },
      followRedirect: true,
      success: (res) => {
        if (res.statusCode === 200 && typeof res.data === 'string') {
          resolve(res.data);
        } else {
          reject(new Error('获取页面失败: HTTP ' + res.statusCode + ' dataType=' + typeof res.data));
        }
      },
      fail: (err) => reject(new Error('网络请求失败: ' + err.errMsg))
    });
  });
}

function extractRouterDataJson(html) {
  const idx = html.indexOf('window._ROUTER_DATA');
  if (idx < 0) throw new Error('HTML 中未找到 _ROUTER_DATA');

  let start = html.indexOf('{', idx);
  if (start < 0) throw new Error('_ROUTER_DATA 后未找到 JSON');

  let depth = 0;
  let end = start;
  for (let i = start; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  return html.substring(start, end);
}

function findPageKey(loaderData) {
  for (const key of Object.keys(loaderData)) {
    if (key.includes('/page') && loaderData[key] !== null) return key;
  }
  for (const key of Object.keys(loaderData)) {
    if (key.startsWith('video') && loaderData[key] !== null) return key;
  }
  for (const key of Object.keys(loaderData)) {
    if (key.startsWith('note') && loaderData[key] !== null) return key;
  }
  return null;
}

function parseVideoItem(item) {
  const awemeType = item.aweme_type || 0;
  const result = {
    videoId: item.aweme_id || '',
    title: item.desc || '无标题',
    author: (item.author && item.author.nickname) || '未知作者',
    awemeType,
    durationMs: (item.video && item.video.duration) || 0,
    coverUrl: '',
    playUrl: '',
    imageUrls: []
  };

  // 封面
  const cover = item.video && item.video.cover;
  if (cover && cover.url_list && cover.url_list.length > 0) {
    result.coverUrl = cover.url_list[0];
  }

  // 视频类型: aweme_type 0/4/68
  if (awemeType === 0 || awemeType === 4 || awemeType === 68) {
    const videoNode = item.video;
    if (videoNode) {
      const playAddr = videoNode.play_addr;
      console.log('[parser] video keys:', Object.keys(videoNode).join(', '));
      if (playAddr) {
        const urlList = playAddr.url_list;
        console.log('[parser] play_addr keys:', Object.keys(playAddr).join(', '));
        if (urlList && urlList.length > 0) {
          const rawUrl = urlList[0];
          console.log('[parser] 原始 play_url:', rawUrl);
          result.playUrl = rawUrl.replace('/playwm/', '/play/');
          console.log('[parser] 去水印后 play_url:', result.playUrl);
        } else {
          console.warn('[parser] play_addr.url_list 为空');
        }
      } else {
        console.warn('[parser] play_addr 不存在, video 结构:', JSON.stringify(videoNode).substring(0, 500));
      }
    } else {
      console.warn('[parser] item.video 不存在, item keys:', Object.keys(item).join(', '));
    }
  }

  // 图文类型: aweme_type = 2
  if (awemeType === 2) {
    const imageUrls = [];

    if (Array.isArray(item.images)) {
      for (const img of item.images) {
        if (img.url_list && img.url_list.length > 0) {
          imageUrls.push(img.url_list[0]);
        }
      }
    }

    if (imageUrls.length === 0 && item.image_infos) {
      for (const key of Object.keys(item.image_infos)) {
        const img = item.image_infos[key];
        if (img.url_list && img.url_list.length > 0) {
          imageUrls.push(img.url_list[0]);
        }
      }
    }

    result.imageUrls = imageUrls;
    console.log('[parser] 图文: ' + imageUrls.length + ' 张图片');
  }

  return result;
}

async function parse(input) {
  const shareUrl = extractShareUrl(input);
  if (!shareUrl) throw new Error('未在输入中找到抖音分享链接');
  console.log('[parser] 分享链接:', shareUrl);

  const html = await fetchSSRPage(shareUrl);
  console.log('[parser] SSR 页面获取成功，大小:', html.length);

  const routerDataJson = extractRouterDataJson(html);
  console.log('[parser] _ROUTER_DATA 长度:', routerDataJson.length);

  const routerData = JSON.parse(routerDataJson);

  const loaderData = routerData.loaderData;
  if (!loaderData) throw new Error('未找到 loaderData');

  console.log('[parser] loaderData keys:', Object.keys(loaderData).join(', '));

  const pageKey = findPageKey(loaderData);
  if (!pageKey) throw new Error('未找到视频数据节点');

  console.log('[parser] 选中的 pageKey:', pageKey);

  const pageData = loaderData[pageKey];
  const videoInfoRes = pageData.videoInfoRes;
  if (!videoInfoRes) throw new Error('未找到 videoInfoRes');

  const itemList = videoInfoRes.item_list;
  if (!Array.isArray(itemList) || itemList.length === 0) {
    throw new Error('item_list 为空');
  }

  const info = parseVideoItem(itemList[0]);
  console.log('[parser] 解析完成 - 标题:', info.title, '作者:', info.author, '类型:', info.awemeType,
    'playUrl:', info.playUrl ? info.playUrl.substring(0, 80) + '...' : '(空)');

  return info;
}

module.exports = { parse };
