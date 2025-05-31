import plugin from "../../lib/plugins/plugin.js";
import common from "../../lib/common/common.js";
import fetch from "node-fetch";
import fs from "node:fs";

if (!fs.existsSync(`./resources/video/`)) {
    fs.mkdirSync(`./resources/video/`);
}

//是否在开启仅艾特的群响应小程序转发解析
const isonlyAt = true;

/**
 * 支持视频解析：
 * 哔哩哔哩(链接、小程序转发[两种格式])
 * QQ小世界(暂不支持)
 * 快手(极速版?)(链接、小程序)
 * 抖音链接
 * */
export class videojx extends plugin {
    constructor(e) {
        super({
            name: 'videojx',
            dsc: '视频解析(小程序&链接)',
            event: 'message',
            priority: -114514,
            rule: [{
                reg: '',
                fnc: 'dealUrl',
                log: false
            }]
        })
        if (e?.raw_message == '[json消息]' && isonlyAt)
            this.jsonUrl(e)
    }

    //处理json转url
    async jsonUrl(e) {
        let url;
        let msg = await JSON.parse(e.msg);
        if (msg.ver == '1.0.0.19' || msg.ver == '1.0.1.46') {
            url = msg.meta.detail_1.qqdocurl;
            if (msg.meta.detail_1.title == '哔哩哔哩') {
                this.bilibili(e, url);
            } else if (msg.meta.detail_1.title == '快手') {
                this.kuaishou(e, url);
            }
        } else if (msg.ver == '0.0.0.1' && msg.meta.video) {
            if (msg.meta.video.tag != '哔哩哔哩') return false
            url = msg.meta.video.jumpUrl;
            this.bilibili(e, url);
        } else {
            return false;
        }
    }

    //处理消息转url
    async dealUrl(e) {
        if (!isonlyAt) this.jsonUrl;
        let url;
        let reg = RegExp(/b23.tv|m.bilibili.com|www.bilibili.com|v.kuaishou.com|(v\.douyin\.com|douyin\.com)/);
        if (!reg.test(e.msg)) return false;
        if (e.message[0].type != 'text') return true;
        reg = /(https?|http|ftp|file):\/\/[-A-Za-z0-9+&@#/%?=~_|!:,.;]+[-A-Za-z0-9+&@#/%=~_|]/g;
        try {
            url = (e.msg.match(reg))[0];
        } catch (error) {
            return false;
        }
        if (RegExp(/v.douyin.com/).test(url)) {
            this.douyin(e, url);
        } else if (RegExp(/v.kuaishou.com/).test(url)) {
            this.kuaishou(e, url);
        } else {
            this.bilibili(e, url);
        }
    }

    // 哔哩哔哩解析(部分代码来自earth-k-plugin)
    async bilibili(e, url) {
        let res = await fetch(url);
        let cs = res.url.indexOf('BV');
        if (cs == -1) return false;
        let bvid = res.url.substring(cs, cs + 12);
        url = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`;
        res = await this.tourl(url);
        logger.info("[视频解析]-哔哩哔哩");
        e.reply([
            segment.image(res.pic),
            `标题:${res.title}\n简介:${res.desc}\n作者:${res.owner.name}\n\n点赞:${res.stat.like}      收藏:${res.stat.favorite}\n投币:${res.stat.coin}      转发:${res.stat.share}\n正在解析b站视频，请等待......`
        ]);
        let qn = this.autoQuality(e, res.duration);
        url = `https://api.bilibili.com/x/player/playurl?avid=${res.aid}&cid=${res.cid}&qn=${qn}`;
        res = await this.tourl(url);
        url = res.durl[0].url;
        let response = await fetch(url, {
            headers: {
                'referer': 'https://www.bilibili.com/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.198 Safari/537.36'
            }
        });
        this.buff(e, "bilibili", response);
    }

    //QQ小世界解析
    // async qqxsj (e,url) {
    //   logger.info("[视频解析]-QQ小世界");
    //   let nickName = url.userInfo.nickName
    //   if(!nickName){
    //       e.reply([
    //           segment.image(res.coverUrl),
    //           `简介:${res.content}\n作者:${nickName}\n\n点赞:${res.likeNum}      评论:${res.commentNum}\n火箭:${res.fuelNum}      转发:${res.shareNum}\n\n正在解析QQ小世界视频，请等待......`
    //       ])
    //   } else {}
    //   let res = url.feedInfo
    //   e.reply([
    //     segment.image(res.coverUrl),
    //     `简介:${res.content}\n作者:${nickName}\n\n点赞:${res.likeNum}      评论:${res.commentNum}\n火箭:${res.fuelNum}      转发:${res.shareNum}\n\n正在解析QQ小世界视频，请等待......`
    //   ])
    //   e.reply(segment.video(res.videoInfo.playUrl));
    //   return true
    // }

    //抖音解析
    async douyin(e, url) {
        try {
            logger.info(`[视频解析]-开始解析抖音URL: ${url}`);

            // 调用新API
            let apiUrl = `https://api.xinyew.cn/api/douyinjx?url=${encodeURIComponent(url)}`;
            let res = await fetch(apiUrl);

            if (!res.ok) {
                throw new Error(`API请求失败，状态码: ${res.status}`);
            }

            let data = await res.json();

            // 检查API返回状态
            if (data.code !== 200) {
                throw new Error(data.msg || 'API返回错误');
            }

            // 提取视频信息
            let videoInfo = {
                url: data.data.video_url || data.data.play_url,
                desc: data.data.additional_data[0].desc,
                author: data.data.additional_data[0].nickname,
                avatar: data.data.additional_data[0].url,
                signature: data.data.additional_data[0].signature
            };

            if (!videoInfo.url) {
                throw new Error('未获取到视频地址');
            }

            // 发送预览信息
            let msg = [];
            if (videoInfo.avatar) {
                msg.push(segment.image(videoInfo.avatar));
            }

            msg.push(
                `抖音视频解析成功\n` +
                `作者: ${videoInfo.author}\n` +
                `描述: ${videoInfo.desc}\n` +
                `签名: ${videoInfo.signature}\n` +
                `正在下载视频...`
            );

            await e.reply(msg);

            // 下载并发送视频
            let videoRes = await fetch(videoInfo.url);

            if (!videoRes.ok) {
              throw new Error('视频下载失败');
            }
            await this.buff(e, "douyin", videoRes);
            return true;

        } catch (err) {
            logger.error('[视频解析]-抖音解析错误:', err);
            await e.reply(`抖音解析失败: ${err.message}\n请检查链接是否正确或稍后再试`); // 修正这里
            return false;
        }
    }

    //快手解析
    async kuaishou(e, url) {
        let res = await fetch(`https://ks.090708.xyz/api/sp_jx/kuaishou.php?url=${url}`);
        res = await res.json();

        if (!res || res.code !== 200) {
            e.reply("快手解析失败，请稍后再试");
            return false;
        }

        const data = res.data;
        const title = data.title || "未知作者";
        const cover = data.cover;
        const videoUrl = data.url;
        const images = data.images || [];

        // 视频解析
        if (videoUrl && images.length === 0) {
            logger.info("[视频解析]-快手[视频]");
            let msg = [];
        
            if (cover) {
                msg.push(segment.image(cover));
            }
        
            msg.push(
                `视频作者: ${title}\n` +
                `解析时间: ${res.text.time}\n\n` +
                `正在解析快手视频，请等待......`
            );
        
            await e.reply(msg);
        
            try {
                let response = await fetch(videoUrl);
                await this.buff(e, "kuaishou", response);
                return true;
            } catch (err) {
                e.reply("视频下载失败");
                logger.error("[视频解析]-快手视频下载失败:", err);
                return false;
            }
        } 
        // 图集解析
        else if (!videoUrl && images.length > 0) {
            logger.info("[视频解析]-快手[图集]");
            let msg = [];
        
            if (cover) {
                msg.push(segment.image(cover));
            }
        
            msg.push(
                `图集作者: ${title}\n` +
                `解析时间: ${res.text.time}\n\n` +
                `共 ${images.length} 张图片，正在加载......`
            );
        
            await e.reply(msg);
        
            try {
                let forwardMsg = [];
                for (let imgUrl of images) {
                forwardMsg.push(segment.image(imgUrl));
                }
                e.reply(common.makeForwardMsg(e, forwardMsg, "快手图集"));
                return true;
            } catch (err) {
            e.reply("图集加载失败");
            logger.error("[视频解析]-快手图集加载失败:", err);
            return false;
        }
        } else {
            e.reply("不支持的快手内容类型");
            return false;
        }
    }

    //url统一处理方法
    async tourl(url) {
        let res = await fetch(url);
        res = await res.json();
        res = res.data;
        return res;
    }

    //保存视频统一处理
    async buff(e, ttl, response) {
        let buff = await response.arrayBuffer();
        if (buff) {
            fs.writeFile(`./resources/video/$ {ttl}.mp4`, Buffer.from(buff), "binary", function(err) {
                if (!err) {
                    e.reply(segment.video(`./resources/video/$ {ttl}.mp4`));
                } else {
                    e.reply("下载/发送视频出错");
                }
            });
        } else {
            e.reply("解析出错");
        }
        return true;
    }

    //哔站视频自动选择视频画质
    autoQuality(e, duration) {
        let qn = 80;
        if (duration >= 180) {
            e.reply("视频时长超过5分钟，已将视频画质降低至360p");
            qn = 16;
        }
        return qn;
    }
}