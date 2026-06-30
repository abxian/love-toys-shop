# LOVE Toys — 静态展示站 + 轻量后台

一个**静态商品展示站**(WhatsApp 成交,无购物车/支付/登录)外加一个**零依赖的 Node 后台**。
后台用来管理商品、上下架、排序、分类、图片、价格货币、Pixel/WhatsApp 和访问统计。
页面在请求时由 `server.js` 实时处理(清理残留、注入购买区/分类网格/“More Products”、改货币、替换图片)。

> 说明:站内 HTML/图片源自对某品牌站点的抓取改造,仅作自有独立站展示用途。请自行确认所用图片/字体/文案的授权与合规,生产前建议替换为自有素材。

---

## 功能一览

- **商品管理**:基础资料、SKU、价格、描述、专属 WhatsApp;**一键上架 / 下架**(带状态徽章)。
- **展示管理(merchandising)**:拖拽排序、★ 置顶、批量上/下架、批量改价、批量改分类;**首页展示位**(精选商品网格)。
- **分类管理**:大分类 / 子分类,前台左侧分类导航与分类页跟着变。
- **商品详情页**:服务端生成的购买区(缩略图 + 大图 + 颜色色块切换主图 + 价格 + WhatsApp + 保障说明),底部“More Products”。
- **图片替换 / 区块编辑**:按页面替换图片、改文字(带实时预览)。
- **Pixel / WhatsApp / 货币**:注入像素代码、统一 WhatsApp 链接、全站货币(默认 OMR)。
- **访问统计**:页面浏览、商品点击、WhatsApp 点击,本地落盘。
- **自动清理 LELO 残留**:移除第三方追踪脚本、改写/禁用外链、品牌词替换、图片改用本地资源(详见 `README_ADMIN.md`)。

---

## 环境要求

- 本地运行:**Node.js 18+**(无 npm 依赖)。
- 部署:**Docker**(推荐)或任意能跑 Node 18 的环境。

---

## 本地快速开始

```bash
node server.js
```

- 前台:http://127.0.0.1:4173/
- 后台:http://127.0.0.1:4173/admin
- 默认密码:`admin123456`(生产环境务必用环境变量改掉,见下)

### 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `4173` | 监听端口 |
| `HOST` | `127.0.0.1` | 监听地址(**Docker/对外必须设 `0.0.0.0`**) |
| `ADMIN_PASSWORD` | `admin123456` | 后台密码,生产务必修改 |
| `SESSION_SECRET` | 随机 | 会话签名密钥(可选) |

```bash
ADMIN_PASSWORD="你的强密码" HOST="0.0.0.0" PORT="4173" node server.js
```

---

## 后台使用指南

进入 `/admin` 输入密码后,左侧菜单:

- **仪表盘**:浏览量、访客、WhatsApp 点击、转化率、近 14 天趋势、热门页面/商品。
- **商品管理**:按 分类 → 子分类 → 商品 选择;
  - 顶部 **上架 / 下架** 按钮即时生效(徽章显示「已上架 / 已下架」,下架商品在下拉里标 `[下架]`);
  - 「前端编辑」可直接点预览里的文字/图片修改;「基础资料 / 商品图片 / 颜色型号 / 商品参数」分页编辑;
  - 「新增商品和页面」可选一个现有商品页做模板;「删除」会把 HTML 备份到 `_deleted_products/`。
- **展示管理**:拖拽(或 ↑↓)排序 → `sortOrder`;★ 置顶让商品排到分类页最前;勾选后可**批量上/下架、批量改价、批量改分类**;下方「首页展示位」选择并排序首页精选商品(默认关闭,勾选「在首页显示」才出现)。
- **分类管理**:增删大分类/子分类,删除子分类时其下商品自动归到默认子分类。
- **页面管理**:页面启用/禁用、标题、Meta 描述。
- **图片替换 / 区块编辑**:按页面替换图片(URL 或上传)、改文字,带预览。
- **Pixel 像素**:插入 head / body 底部统计代码;开关内置访问统计。
- **WhatsApp**:全站 WhatsApp 链接与显示号码;**全站货币**(OMR/AED/SAR/USD…)。
- **访问记录**:事件明细,可清空。

---

## Docker 部署(推荐)

```bash
# 1) 在项目目录构建镜像
docker build -t toys-web .

# 2) 运行(端口 4173;挂载数据目录以持久化商品/上传图)
docker run -d --name toys --restart unless-stopped -p 4173:4173 \
  -e ADMIN_PASSWORD='你的强密码' \
  -v "$PWD/admin-data:/app/admin-data" \
  -v "$PWD/assets/admin-uploads:/app/assets/admin-uploads" \
  toys-web
```

- 镜像内已设 `HOST=0.0.0.0 PORT=4173`。
- 数据持久化:`admin-data/`(商品/设置/分类等)与 `assets/admin-uploads/`(上传图)挂载到宿主机,**改商品、重启/重建容器都不丢**。
- 反向代理:把你的域名(例如 `https://toys.example.com`)反代到宿主机 `4173` 即可。

### 更新代码

```bash
# 同步最新代码到部署目录后:
docker build -t toys-web . && docker rm -f toys && docker run -d --name toys --restart unless-stopped -p 4173:4173 \
  -e ADMIN_PASSWORD='你的强密码' \
  -v "$PWD/admin-data:/app/admin-data" \
  -v "$PWD/assets/admin-uploads:/app/assets/admin-uploads" \
  toys-web
```

---

## 数据与备份

`admin-data/` 下:

| 文件 | 内容 |
|---|---|
| `settings.json` | 站名、货币、WhatsApp、Pixel、统计开关 |
| `categories.json` | 分类导航 |
| `products.json` | 商品数据(分类/价格/上下架/排序/置顶/图片/参数等) |
| `pages.json` | 页面启用与 SEO |
| `images.json` / `blocks.json` | 图片替换 / 文字区块覆盖 |
| `events.ndjson` | 访问事件(**含访客 IP,已被 `.gitignore` 排除,不入库**) |

迁移/备份时复制整个 `admin-data/` 与 `assets/admin-uploads/` 即可。

---

更多关于「LELO 残留清理 / 货币 / 商品购买区」的实现细节见 [`README_ADMIN.md`](README_ADMIN.md)。
