# 《我们》私人艺术馆

纯静态网站：HTML + CSS + 原生 JS，不依赖任何框架、CDN 或外部字体，国内任何静态托管都能直接部署。

## 本地预览

```
node D:\codex\us-gallery-tools\serve.cjs D:\codex\us-gallery 5173
```

电脑打开 http://localhost:5173 。
手机和电脑连同一个 Wi-Fi 时，手机打开 `http://电脑的局域网IP:5173` 。

## 替换内容

所有内容只需要改 `js/data.js`，里面每一块都有注释。

| 内容 | 位置 |
| --- | --- |
| 在一起的起始日（大厅天数） | `togetherSince` |
| 故事展品 | `stories`，同一主题内按日期自动排序 |
| 时间长廊 | `timeline` |
| 胶片墙照片 | `photos` |
| 纪念日 | `dates`，`mode` 可选 `since` / `annual` / `until` |
| 地图地点 | `places`（经纬度）和 `route`（连线顺序） |
| 结尾文案 | `ending` |

- 照片：放进 `assets/photos/`，在对应条目里填 `'assets/photos/文件名.jpg'`。留空时显示艺术化占位。建议照片长边压到 2000px 以内、单张 500KB 以内，手机打开会快很多。
- 音乐：把《天外来物》的 mp3 放到 `assets/music/bgm.mp3`。找不到这个文件时会自动播放一段柔和的合成环境音。

## 上线（国内访问）

1. 把整个 `us-gallery` 文件夹上传到阿里云 OSS、腾讯云 COS 或七牛云的静态网站托管。
2. 在中国大陆用自己的域名访问需要 ICP 备案。不想备案的话，可以用托管商提供的默认域名，或者选香港节点（速度稍慢，但不需要备案）。
3. 用最终网址生成二维码。
